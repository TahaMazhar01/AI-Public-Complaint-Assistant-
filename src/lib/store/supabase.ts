import { serverClient } from "../supabase";
import { distanceMetres } from "../utils";
import type {
  Complaint,
  ComplaintEvent,
  ComplaintStatus,
  DuplicateMatch,
} from "../types";
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
   POSTGRES BACKEND
   Same function signatures as the in-memory store. Every column
   is named explicitly so the embedding vector never travels to
   the browser — it is large, and nothing in the UI reads it.
   ============================================================ */

const COLUMNS = `
  id, tracking_id, created_at, updated_at,
  raw_text, intake_mode, detected_language, audio_url, photo_urls,
  lat, lng, address_text, neighbourhood, city,
  title, summary, category, department_id, priority, priority_reason,
  hazard_flags, formal_text, confidence,
  status, sla_hours, due_at, resolved_at, assigned_officer,
  cluster_id, is_cluster_parent, duplicate_count,
  citizen_name, citizen_phone
`;

/** Rows come back untyped from PostgREST; the schema mirrors Complaint. */
function asComplaint(row: unknown): Complaint {
  return row as Complaint;
}

export async function listComplaints(
  f: ComplaintFilters = {},
): Promise<Complaint[]> {
  let q = serverClient()
    .from("complaints")
    .select(COLUMNS)
    .order("created_at", { ascending: false });

  if (f.status && f.status !== "all") {
    if (f.status === "open") q = q.in("status", OPEN_STATUSES);
    else q = q.eq("status", f.status);
  }
  if (f.department && f.department !== "all") q = q.eq("department_id", f.department);
  if (f.priority && f.priority !== "all") q = q.eq("priority", f.priority);
  if (f.category && f.category !== "all") q = q.eq("category", f.category);
  if (f.parentsOnly) q = q.eq("is_cluster_parent", true);
  if (f.clusterId) q = q.eq("cluster_id", f.clusterId);

  if (f.search?.trim()) {
    // Escape PostgREST's or() delimiters before interpolating user input.
    const term = f.search.trim().replace(/[,()]/g, " ");
    q = q.or(
      [
        `tracking_id.ilike.%${term}%`,
        `title.ilike.%${term}%`,
        `raw_text.ilike.%${term}%`,
        `neighbourhood.ilike.%${term}%`,
      ].join(","),
    );
  }

  q = q.limit(f.limit ?? 500);

  const { data, error } = await q;
  if (error) throw new Error(`listComplaints: ${error.message}`);
  return (data ?? []).map(asComplaint);
}

export async function getComplaint(idOrTracking: string): Promise<Complaint | null> {
  const key = idOrTracking.trim();
  const isUuid = /^[0-9a-f-]{36}$/i.test(key);

  const { data, error } = await serverClient()
    .from("complaints")
    .select(COLUMNS)
    .eq(isUuid ? "id" : "tracking_id", isUuid ? key : key.toUpperCase())
    .maybeSingle();

  if (error) throw new Error(`getComplaint: ${error.message}`);
  return data ? asComplaint(data) : null;
}

export async function getEvents(complaintId: string): Promise<ComplaintEvent[]> {
  const { data, error } = await serverClient()
    .from("complaint_events")
    .select("*")
    .eq("complaint_id", complaintId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`getEvents: ${error.message}`);
  return (data ?? []) as ComplaintEvent[];
}

/** Postgres owns the sequence, so the id is minted there, not here. */
export async function nextTrackingId(): Promise<string> {
  const db = serverClient();
  const { data, error } = await db.rpc("make_tracking_id", { city_code: "LHR" });
  if (!error && data) return data as string;

  // The RPC is missing or mis-declared (see db/002-functions.sql). Derive
  // the next id from the highest one already stored rather than refusing
  // to file the complaint. Racy under concurrent load, correct enough for
  // a single-operator demo, and it fails loudly in the log.
  console.error(
    `[awaaz] make_tracking_id RPC unavailable (${error?.message ?? "no data"}); ` +
      `falling back to max+1. Run db/002-functions.sql to fix.`,
  );

  const now = new Date();
  const prefix = `AWZ-LHR-${String(now.getFullYear()).slice(-2)}${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}-`;

  const { data: latest } = await db
    .from("complaints")
    .select("tracking_id")
    .like("tracking_id", `${prefix}%`)
    .order("tracking_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const previous = latest?.tracking_id
    ? Number.parseInt(String(latest.tracking_id).slice(-4), 10)
    : 0;
  return prefix + String((Number.isFinite(previous) ? previous : 0) + 1).padStart(4, "0");
}

export async function insertComplaint(
  c: Complaint,
  timeline: ComplaintEvent[],
): Promise<Complaint> {
  const db = serverClient();

  // `id` is omitted so Postgres assigns the uuid; the tracking id was
  // already minted above and is carried through unchanged.
  const { id: _ignored, ...row } = c;
  void _ignored;

  const { data, error } = await db
    .from("complaints")
    .insert(row)
    .select(COLUMNS)
    .single();

  if (error) throw new Error(`insertComplaint: ${error.message}`);
  const saved = asComplaint(data);

  if (timeline.length) {
    const { error: evError } = await db.from("complaint_events").insert(
      timeline.map(({ id: _drop, ...e }) => {
        void _drop;
        return { ...e, complaint_id: saved.id };
      }),
    );
    // A missing audit row must not lose the complaint itself.
    if (evError) console.error("[awaaz] event insert failed:", evError.message);
  }

  return saved;
}

export async function updateStatus(
  id: string,
  status: ComplaintStatus,
  note: string,
): Promise<Complaint | null> {
  const db = serverClient();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from("complaints")
    .update({
      status,
      updated_at: now,
      ...(status === "resolved" ? { resolved_at: now } : {}),
    })
    .eq("id", id)
    .select(COLUMNS)
    .maybeSingle();

  if (error) throw new Error(`updateStatus: ${error.message}`);
  if (!data) return null;

  await db.from("complaint_events").insert({
    complaint_id: id,
    kind: status === "resolved" ? "resolved" : "status_changed",
    actor: "officer",
    message: note,
  });

  return asComplaint(data);
}

export async function findDuplicates(
  input: DuplicateInput,
): Promise<DuplicateMatch[]> {
  if (input.lat == null || input.lng == null) return [];
  const radius = input.radiusM ?? DUPLICATE_RADIUS_M;

  // Narrow in Postgres with a bounding box, then judge similarity in JS
  // so both backends apply exactly the same rule. One degree of latitude
  // is ~111 km; longitude shrinks with the cosine of the latitude.
  const dLat = radius / 111_000;
  const dLng = radius / (111_000 * Math.cos((input.lat * Math.PI) / 180));

  const { data, error } = await serverClient()
    .from("complaints")
    .select("id, tracking_id, raw_text, title, lat, lng, created_at")
    .eq("category", input.category)
    .neq("status", "resolved")
    .gte("lat", input.lat - dLat)
    .lte("lat", input.lat + dLat)
    .gte("lng", input.lng - dLng)
    .lte("lng", input.lng + dLng)
    .limit(200);

  if (error) throw new Error(`findDuplicates: ${error.message}`);

  const tokens = tokenise(input.text);

  return (data ?? [])
    .map((r) => ({
      complaint_id: r.id as string,
      tracking_id: r.tracking_id as string,
      similarity: jaccard(tokens, tokenise(`${r.raw_text} ${r.title}`)),
      distance_m: distanceMetres(
        { lat: input.lat!, lng: input.lng! },
        { lat: r.lat as number, lng: r.lng as number },
      ),
      created_at: r.created_at as string,
    }))
    .filter(
      (m) => m.distance_m <= radius && m.similarity >= DUPLICATE_MIN_SIMILARITY,
    )
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 50);
}

export async function getStats(now: Date = new Date()): Promise<Stats> {
  const { data, error } = await serverClient()
    .from("complaints")
    .select(
      "department_id, priority, status, created_at, due_at, resolved_at, is_cluster_parent",
    )
    .limit(2000);

  if (error) throw new Error(`getStats: ${error.message}`);
  return computeStats((data ?? []) as unknown as Complaint[], now);
}
