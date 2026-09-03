/* ============================================================
   SEED SUPABASE
     pnpm seed          — wipe and reload the demo corpus
     pnpm seed --keep   — insert without wiping

   An empty dashboard loses hackathons. This loads the same
   deterministic week of Lahore traffic the in-memory store uses,
   so both backends show the identical city.
   ============================================================ */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { buildSeed } from "../src/lib/seed";
import type { Complaint } from "../src/lib/types";

/* --- env: no dotenv dependency for a one-off script --------- */
function loadEnv(file: string) {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, k, raw] = m;
    if (!process.env[k]) process.env[k] = raw.replace(/^["']|["']$/g, "").trim();
  }
}
loadEnv(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  .replace(/\/rest\/v1\/?$/, "")
  .replace(/\/+$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const keep = process.argv.includes("--keep");

async function main() {
  const { complaints, events } = buildSeed(64);
  console.log(`Prepared ${complaints.length} complaints, ${events.length} events.`);

  if (!keep) {
    // Events cascade from complaints, so one delete clears both.
    const { error } = await db
      .from("complaints")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(`wipe failed: ${error.message}`);
    console.log("Cleared existing rows.");
  }

  /* cluster_id is a uuid column; the seed uses readable string keys,
     so map each distinct cluster to one generated uuid. */
  const clusterIds = new Map<string, string>();
  for (const c of complaints) {
    if (c.cluster_id && !clusterIds.has(c.cluster_id)) {
      clusterIds.set(c.cluster_id, crypto.randomUUID());
    }
  }

  const rows = complaints.map((c) => {
    const { id: _seedId, ...rest } = c as Complaint & { id: string };
    void _seedId;
    return {
      ...rest,
      cluster_id: c.cluster_id ? clusterIds.get(c.cluster_id)! : null,
    };
  });

  /* Insert in batches and keep the tracking_id → real uuid mapping,
     so the audit trail can point at the rows Postgres actually made. */
  const idByTracking = new Map<string, string>();
  const BATCH = 100;

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { data, error } = await db
      .from("complaints")
      .insert(slice)
      .select("id, tracking_id");
    if (error) throw new Error(`insert complaints: ${error.message}`);
    for (const r of data ?? []) idByTracking.set(r.tracking_id, r.id);
    console.log(`  complaints ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }

  const trackingBySeedId = new Map(complaints.map((c) => [c.id, c.tracking_id]));

  const eventRows = events
    .map((e) => {
      const tracking = trackingBySeedId.get(e.complaint_id);
      const realId = tracking ? idByTracking.get(tracking) : undefined;
      if (!realId) return null;
      return {
        complaint_id: realId,
        created_at: e.created_at,
        kind: e.kind,
        actor: e.actor,
        message: e.message,
        meta: e.meta,
      };
    })
    .filter(Boolean) as Record<string, unknown>[];

  for (let i = 0; i < eventRows.length; i += BATCH) {
    const { error } = await db
      .from("complaint_events")
      .insert(eventRows.slice(i, i + BATCH));
    if (error) throw new Error(`insert events: ${error.message}`);
    console.log(`  events ${Math.min(i + BATCH, eventRows.length)}/${eventRows.length}`);
  }

  /* Push the sequence past the seeded numbers so newly filed complaints
     get ids that sort after the demo corpus rather than before it. */
  const { error: seqError } = await db.rpc("bump_complaint_seq", { to_value: 2100 });
  if (seqError) {
    console.warn(
      `  note: could not bump the sequence (${seqError.message}). New complaints will start from 1.`,
    );
  }

  console.log(`\nDone. ${rows.length} complaints, ${eventRows.length} events.`);
}

main().catch((e) => {
  console.error("\nSeed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
