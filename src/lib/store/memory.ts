import { buildSeed } from "../seed";
import type {
  Complaint,
  ComplaintEvent,
  ComplaintStatus,
  DuplicateMatch,
} from "../types";
import { distanceMetres, formatTrackingId } from "../utils";
import {
  DUPLICATE_MIN_SIMILARITY,
  DUPLICATE_RADIUS_M,
  OPEN_STATUSES,
  computeStats,
  jaccard,
  tokenise,
  type Stats,
} from "./stats";
import type { ComplaintFilters, DuplicateInput } from "./types";

/* ============================================================
   IN-MEMORY BACKEND
   A seeded week of Lahore civic traffic. Used when Supabase is
   not configured — which is how the app stays demonstrable on a
   laptop with no network and no credentials.
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

export async function listComplaints(
  f: ComplaintFilters = {},
): Promise<Complaint[]> {
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

export async function nextTrackingId(): Promise<string> {
  return formatTrackingId(++db().sequence, "LHR");
}

export async function insertComplaint(
  c: Complaint,
  timeline: ComplaintEvent[],
): Promise<Complaint> {
  const store = db();
  store.complaints.unshift(c);
  store.events.push(...timeline);
  return c;
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

/* Mirrors the Postgres path: category identity, physical proximity, and
   token overlap must all agree before two reports are the same case. */
export async function findDuplicates(
  input: DuplicateInput,
): Promise<DuplicateMatch[]> {
  if (input.lat == null || input.lng == null) return [];
  const radius = input.radiusM ?? DUPLICATE_RADIUS_M;
  const tokens = tokenise(input.text);

  return db()
    .complaints.filter(
      (c) =>
        c.category === input.category &&
        c.status !== "resolved" &&
        c.lat != null &&
        c.lng != null,
    )
    .map((c) => ({
      complaint_id: c.id,
      tracking_id: c.tracking_id,
      similarity: jaccard(tokens, tokenise(`${c.raw_text} ${c.title}`)),
      distance_m: distanceMetres(
        { lat: input.lat!, lng: input.lng! },
        { lat: c.lat!, lng: c.lng! },
      ),
      created_at: c.created_at,
    }))
    .filter(
      (m) => m.distance_m <= radius && m.similarity >= DUPLICATE_MIN_SIMILARITY,
    )
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 50);
}

export async function getStats(now: Date = new Date()): Promise<Stats> {
  return computeStats(db().complaints, now);
}

/** Exposed for the Supabase seed script, which reuses the same corpus. */
export function seedCorpus() {
  return buildSeed(64);
}
