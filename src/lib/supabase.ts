import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ============================================================
   SUPABASE CLIENTS
   Two of them, deliberately:
     serverClient()  — service role, server only, never bundled
     browserClient() — anon key, for realtime subscriptions
   The store falls back to the in-memory corpus when neither the
   URL nor a key is present, so the app still runs with no
   database at all. That is the demo safety net, not an accident.
   ============================================================ */

const URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
const ANON_ENV = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
const SERVICE_ENV = "SUPABASE_SERVICE_ROLE_KEY";

function url(): string | undefined {
  // Tolerate a pasted REST endpoint — supabase-js wants the project origin.
  const raw = process.env[URL_ENV]?.trim();
  return raw ? raw.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "") : undefined;
}

/** True when the server can reach Postgres. */
export function hasSupabase(): boolean {
  return Boolean(
    url() && (process.env[SERVICE_ENV] || process.env[ANON_ENV]),
  );
}

let cachedServer: SupabaseClient | null = null;

export function serverClient(): SupabaseClient {
  if (cachedServer) return cachedServer;
  const base = url();
  const key = process.env[SERVICE_ENV] || process.env[ANON_ENV];
  if (!base || !key) {
    throw new Error(
      `Supabase is not configured. Set ${URL_ENV} and ${SERVICE_ENV} in .env.local.`,
    );
  }
  cachedServer = createClient(base, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedServer;
}

/** Anon client for the browser. Realtime only — never writes. */
export function browserClient(): SupabaseClient | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    .replace(/\/rest\/v1\/?$/, "")
    .replace(/\/+$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return null;
  return createClient(base, key, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });
}
