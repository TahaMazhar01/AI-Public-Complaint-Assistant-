import { ArrowRight } from "lucide-react";
import Link from "next/link";
import Masthead from "@/components/Masthead";
import { getI18n } from "@/lib/i18n/server";

/* ============================================================
   404
   Reached mostly by a mistyped tracking number, which is an
   ordinary thing to do with a 17 character code read off a
   screen. So this page explains the format and offers the
   register, rather than saying "not found" and stopping.
   ============================================================ */

export default async function NotFound() {
  const { t } = await getI18n();

  return (
    <div className="flex min-h-full flex-col">
      <Masthead />

      <main className="grid flex-1 place-items-center px-5 py-24">
        <div className="max-w-[52ch] text-center">
          <div className="type-eyebrow text-ink-faint mb-6 flex items-center justify-center gap-3">
            <span className="bg-signal block h-px w-8" />
            <span dir="ltr">404</span>
          </div>

          <h1 className="type-h1 text-balance">{t.notFound.title}</h1>
          <p className="type-lead mt-5">{t.notFound.body}</p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/track"
              className="bg-ink text-paper hover:bg-signal type-action inline-flex h-14 items-center gap-2 px-5 transition-colors"
            >
              {t.notFound.search}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
            <Link
              href="/"
              className="border-rule-strong text-ink hover:border-ink hover:bg-paper-sunk type-action inline-flex h-14 items-center border px-5 transition-colors"
            >
              {t.notFound.home}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
