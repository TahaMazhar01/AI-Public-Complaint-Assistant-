/* ============================================================
   pnpm check:db
   Answers one question before you waste an hour: is the database
   reachable, and has the schema actually been applied?
   ============================================================ */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnv(file: string) {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
}
loadEnv(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  .replace(/\/rest\/v1\/?$/, "")
  .replace(/\/+$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const ok = (s: string) => `  ok    ${s}`;
const bad = (s: string) => `  FAIL  ${s}`;

async function main() {
  console.log(`\nProject: ${url ?? "(NEXT_PUBLIC_SUPABASE_URL not set)"}\n`);

  if (!url || !key) {
    console.log(bad("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing"));
    console.log("\n  Add them to .env.local, then run this again.\n");
    process.exit(1);
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  let failures = 0;

  const complaints = await db
    .from("complaints")
    .select("id", { count: "exact", head: true });
  if (complaints.error) {
    failures++;
    console.log(bad(`complaints table — ${complaints.error.message}`));
  } else {
    console.log(ok(`complaints table (${complaints.count} rows)`));
  }

  const events = await db
    .from("complaint_events")
    .select("id", { count: "exact", head: true });
  if (events.error) {
    failures++;
    console.log(bad(`complaint_events table — ${events.error.message}`));
  } else {
    console.log(ok(`complaint_events table (${events.count} rows)`));
  }

  const tracking = await db.rpc("make_tracking_id", { city_code: "LHR" });
  if (tracking.error) {
    failures++;
    console.log(bad(`make_tracking_id() — ${tracking.error.message}`));
  } else {
    console.log(ok(`make_tracking_id() → ${tracking.data}`));
  }

  const bump = await db.rpc("bump_complaint_seq", { to_value: 1 });
  if (bump.error) {
    console.log(
      bad(`bump_complaint_seq() — ${bump.error.message} (optional; re-run db/schema.sql)`),
    );
  } else {
    console.log(ok("bump_complaint_seq()"));
  }

  if (failures > 0) {
    console.log(
      `\n  ${failures} check(s) failed. Open the Supabase SQL editor and run db/schema.sql.\n`,
    );
    process.exit(1);
  }
  console.log("\n  Database is ready. Run `pnpm seed` to load the demo corpus.\n");
}

main().catch((e) => {
  console.error("\nCheck failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
