import { buildSeed } from "./seed";
import { distanceMetres } from "./utils";
import type {
  CategoryId,
  Complaint,
  ComplaintEvent,
  ComplaintStatus,
  DepartmentId,
  DuplicateMatch,
  Priority,
} from "./types";

/* ============================================================
   DATA ACCESS
   Every page and action talks to this module and nothing else.
   Today it is an in-memory store seeded with a week of Lahore
   traffic. When Supabase credentials arrive we implement the
   same functions against Postgres and no caller changes.
   ============================================================ */

interface Db {
  complaints: Complaint[];
  events: ComplaintEvent[];
  sequence: number;
}

/* Survive Next.js hot reloads — otherwise the demo city resets
   every time a file is saved. */
const globalRef = globalThis as unknown as { __awaazDb?: Db };

function db(): Db {
  if (!globalRef.__awaazDb) {
    const seeded = buildSeed(64);
    globalRef.__awaazDb = {
      complaints: seeded.complaints,
      events: seeded.events,
      sequence: 1000,
    };
  }
  return globalRef.__awaazDb;
}

export interface ComplaintFilters {
  status?: ComplaintStatus | "open" | "all";
  department?: DepartmentId | "all";
  priority?: Priority | "all";
  category?: CategoryId | "all";
  search?: string;
  /** Cluster children are real complaints but noise in a queue — the
      console lists parents and shows the corroboration count instead. */
  parentsOnly?: boolean;
  limit?: number;
}

const OPEN_STATUSES: ComplaintStatus[] = [
  "submitted",
  "routed",
  "acknowledged",
  "in_progress",
];

export async function listComplaints(f: ComplaintFilters = {}): Promise<Complaint[]> {
  let rows = [...db().complaints];

  if (f.status && f.status !== "all") {
    rows =
      f.status === "open"
        ? rows.filter((c) => OPEN_STATUSES.includes(c.status))
        : rows.filter((c) => c.status === f.status);
  }
  if (f.department && f.department !== "all") {
    rows = rows.filter((c) => c.department_id === f.department);
  }
  if (f.priority && f.priority !== "all") {
    rows = rows.filter((c) => c.priority === f.priority);
  }
  if (f.category && f.category !== "all") {
    rows = rows.filter((c) => c.category === f.category);
  }
  if (f.parentsOnly) {
    rows = rows.filter((c) => c.is_cluster_parent);
  }
  if (f.search?.trim()) {
    const q = f.search.trim().toLowerCase();
    rows = rows.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.tracking_id.toLowerCase().includes(q) ||
        c.raw_text.toLowerCase().includes(q) ||
        (c.neighbourhood ?? "").toLowerCase().includes(q),
    );
  }

  return f.limit ? rows.slice(0, f.limit) : rows;
}

export async function getComplaint(idOrTracking: string): Promise<Complaint | null> {
  const key = idOrTracking.trim().toUpperCase();
  return (
    db().complaints.find(
      (c) => c.id === idOrTracking || c.tracking_id.toUpperCase() === key,
    ) ?? null
  );
}

export async function getEvents(complaintId: string): Promise<ComplaintEvent[]> {
  return db()
    .events.filter((e) => e.complaint_id === complaintId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function insertComplaint(c: Complaint, timeline: ComplaintEvent[]) {
  const store = db();
  store.complaints.unshift(c);
  store.events.push(...timeline);
  return c;
}

export function nextSequence(): number {
  return ++db().sequence;
}

export async function updateStatus(
  id: string,
  status: ComplaintStatus,
  note: string,
): Promise<Complaint | null> {
  const store = db();
  const c = store.complaints.find((x) => x.id === id);
  if (!c) return null;

  c.status = status;
  c.updated_at = new Date().toISOString();
  if (status === "resolved") c.resolved_at = c.updated_at;

  store.events.push({
    id: `${id}-ev-${Date.now()}`,
    complaint_id: id,
    created_at: c.updated_at,
    kind: status === "resolved" ? "resolved" : "status_changed",
    actor: "officer",
    message: note,
    meta: null,
  });
  return c;
}

/* ------------------------------------------------------------
   DUPLICATE DETECTION
   Mirrors match_duplicates() in db/schema.sql. Without embeddings
   available in-memory we approximate semantic similarity with
   category identity plus token overlap — the geometry and the
   category test are identical either way.
   ------------------------------------------------------------ */
export async function findDuplicates(input: {
  category: CategoryId;
  lat: number | null;
  lng: number | null;
  text: string;
  radiusM?: number;
}): Promise<DuplicateMatch[]> {
  if (input.lat == null || input.lng == null) return [];
  const radius = input.radiusM ?? 300;
  const tokens = tokenise(input.text);

  return db()
    .complaints.filter(
      (c) =>
        c.category === input.category &&
        c.status !== "resolved" &&
        c.lat != null &&
        c.lng != null,
    )
    .map((c) => {
      const distance_m = distanceMetres(
        { lat: input.lat!, lng: input.lng! },
        { lat: c.lat!, lng: c.lng! },
      );
      return {
        complaint_id: c.id,
        tracking_id: c.tracking_id,
        similarity: jaccard(tokens, tokenise(`${c.raw_text} ${c.title}`)),
        distance_m,
        created_at: c.created_at,
      };
    })
    .filter((m) => m.distance_m <= radius && m.similarity >= 0.1)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 50);
}

function tokenise(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/* ------------------------------------------------------------
   AGGREGATES for the console header and the landing counters
   ------------------------------------------------------------ */
export interface Stats {
  total: number;
  open: number;
  resolved: number;
  overdue: number;
  critical: number;
  resolvedPct: number;
  medianHours: number;
  byDepartment: { id: DepartmentId; count: number; overdue: number }[];
  byPriority: Record<Priority, number>;
  last24h: number;
}

export async function getStats(now: Date = new Date()): Promise<Stats> {
  // A merged report is not a separate case. Counting cluster children here
  // would triple-count one broken drain and make the city look worse than
  // it is — the corroboration count lives on the parent instead.
  const rows = db().complaints.filter((c) => c.is_cluster_parent);
  const open = rows.filter((c) => OPEN_STATUSES.includes(c.status));
  const resolved = rows.filter((c) => c.status === "resolved");
  const overdue = open.filter((c) => new Date(c.due_at) < now);

  const durations = resolved
    .filter((c) => c.resolved_at)
    .map(
      (c) =>
        (new Date(c.resolved_at!).getTime() - new Date(c.created_at).getTime()) /
        3600_000,
    )
    .sort((a, b) => a - b);

  const byDept = new Map<DepartmentId, { count: number; overdue: number }>();
  for (const c of rows) {
    const e = byDept.get(c.department_id) ?? { count: 0, overdue: 0 };
    e.count++;
    if (OPEN_STATUSES.includes(c.status) && new Date(c.due_at) < now) e.overdue++;
    byDept.set(c.department_id, e);
  }

  const byPriority: Record<Priority, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
  for (const c of rows) byPriority[c.priority]++;

  return {
    total: rows.length,
    open: open.length,
    resolved: resolved.length,
    overdue: overdue.length,
    critical: open.filter((c) => c.priority === "P1").length,
    resolvedPct: rows.length ? Math.round((resolved.length / rows.length) * 100) : 0,
    medianHours: durations.length
      ? Math.round(durations[Math.floor(durations.length / 2)])
      : 0,
    byDepartment: [...byDept.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count),
    byPriority,
    last24h: rows.filter(
      (c) => now.getTime() - new Date(c.created_at).getTime() < 86_400_000,
    ).length,
  };
}
