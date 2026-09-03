import { hasSupabase } from "../supabase";
import * as memory from "./memory";
import * as postgres from "./supabase";

/* ============================================================
   DATA ACCESS
   Every page, route and action talks to this module and nothing
   else. Which backend answers is decided here and nowhere else:
   Postgres when Supabase is configured, the seeded in-memory
   corpus when it is not. No caller knows the difference, and the
   app still runs end to end with no database at all.
   ============================================================ */

function impl() {
  return hasSupabase() ? postgres : memory;
}

export const listComplaints: typeof memory.listComplaints = (f) =>
  impl().listComplaints(f);

export const getComplaint: typeof memory.getComplaint = (id) =>
  impl().getComplaint(id);

export const getEvents: typeof memory.getEvents = (id) => impl().getEvents(id);

export const nextTrackingId: typeof memory.nextTrackingId = () =>
  impl().nextTrackingId();

export const insertComplaint: typeof memory.insertComplaint = (c, timeline) =>
  impl().insertComplaint(c, timeline);

export const updateStatus: typeof memory.updateStatus = (id, status, note) =>
  impl().updateStatus(id, status, note);

export const findDuplicates: typeof memory.findDuplicates = (input) =>
  impl().findDuplicates(input);

export const getStats: typeof memory.getStats = (now) => impl().getStats(now);

/** Which backend is actually answering. Surfaced in the console footer
    so a demo can prove the data is persisted, not fabricated. */
export function activeBackend(): "postgres" | "memory" {
  return hasSupabase() ? "postgres" : "memory";
}

export type { ComplaintFilters, DuplicateInput } from "./types";
export type { Stats } from "./stats";
