import type { Complaint, ComplaintStatus, DepartmentId, Priority } from "../types";

/* Aggregates, computed the same way whichever backend the rows came
   from. At demo scale (hundreds of rows) doing this in JS is cheaper
   than five round trips to Postgres, and it keeps both stores honest:
   the numbers cannot drift between them. */

export const OPEN_STATUSES: ComplaintStatus[] = [
  "submitted",
  "routed",
  "acknowledged",
  "in_progress",
];

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

export function computeStats(all: Complaint[], now: Date = new Date()): Stats {
  // A merged report is not a separate case. Counting cluster children
  // would triple-count one broken drain and make the city look worse
  // than it is — the corroboration count lives on the parent instead.
  const rows = all.filter((c) => c.is_cluster_parent);

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

/* ------------------------------------------------------------
   DUPLICATE SCORING
   Shared by both backends. Postgres narrows candidates by
   category and bounding box; the similarity judgement itself
   stays here so the two stores never disagree about what counts
   as the same complaint.
   ------------------------------------------------------------ */

export function tokenise(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export const DUPLICATE_RADIUS_M = 300;
export const DUPLICATE_MIN_SIMILARITY = 0.1;
