"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n";

/* Setting the locale server side rather than writing document.cookie in the
   browser. Two reasons: the cookie is guaranteed to be committed before the
   refresh that re-renders every server component reads it, and the value is
   validated here rather than trusted from the client. */
export async function setLocale(next: Locale) {
  if (!isLocale(next)) return { ok: false as const };

  const store = await cookies();
  store.set(LOCALE_COOKIE, next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return { ok: true as const };
}
