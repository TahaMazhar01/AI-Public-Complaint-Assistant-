import Link from "next/link";
import IntakeConsole from "@/components/IntakeConsole";
import Masthead from "@/components/Masthead";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { DEPARTMENTS } from "@/lib/taxonomy";
import { getStats, listComplaints } from "@/lib/store";
import { shortAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PRIORITY_COLOR: Record<string, string> = {
  P1: "text-p1",
  P2: "text-p2",
  P3: "text-p3",
  P4: "text-p4",
};

export default async function Home() {
  const [{ t }, recent, stats] = await Promise.all([
    getI18n(),
    listComplaints({ limit: 14 }),
    getStats(),
  ]);

  return (
    <div className="flex min-h-full flex-col">
      <Masthead />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 sm:px-8">
        <section className="grid gap-12 py-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:py-16">
          {/* ── the claim ── */}
          <div className="flex flex-col justify-center">
            <div className="type-eyebrow text-ink-faint mb-7 flex items-center gap-3">
              <span className="bg-signal block h-px w-8" />
              <span>{t.hero.eyebrow}</span>
            </div>

            <h1 className="type-display text-balance">
              {t.hero.titleA}
              <br />
              <span className="text-ink-muted">{t.hero.titleB}</span> {t.hero.titleC}
            </h1>

            <p className="type-lead mt-7 max-w-[46ch]">{t.hero.lead}</p>

            <dl className="rule-t mt-10 grid grid-cols-3 gap-4 pt-6">
              <div>
                <dt className="type-numeral text-[2.5rem]">{stats.total}</dt>
                <dd className="type-eyebrow text-ink-faint mt-2">{t.hero.statCases}</dd>
              </div>
              <div>
                <dt className="type-numeral text-[2.5rem]">{stats.resolvedPct}%</dt>
                <dd className="type-eyebrow text-ink-faint mt-2">{t.hero.statResolved}</dd>
              </div>
              <div>
                <dt className="type-numeral text-[2.5rem]">{stats.medianHours}h</dt>
                <dd className="type-eyebrow text-ink-faint mt-2">{t.hero.statMedian}</dd>
              </div>
            </dl>

            <p className="type-meta text-ink-faint mt-5">
              {fmt(t.hero.summary, {
                open: stats.open,
                overdue: stats.overdue,
                today: stats.last24h,
              })}
            </p>
          </div>

          {/* ── the product itself ── */}
          <div className="flex items-center">
            <IntakeConsole />
          </div>
        </section>

        {/* ── how the routing actually works ── */}
        <section className="rule-t py-12 lg:py-16">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <div className="type-eyebrow text-ink-faint mb-5">
                {t.hero.routingEyebrow}
              </div>
              <h2 className="type-h1 text-balance">
                {t.hero.routingTitleA}
                <br />
                {t.hero.routingTitleB}
              </h2>
              <p className="type-lead mt-5 max-w-[42ch]">{t.hero.routingLead}</p>
            </div>

            <ul className="grid grid-cols-2 gap-px sm:grid-cols-3">
              {Object.values(DEPARTMENTS).map((d) => (
                <li key={d.id} className="border-rule border p-3.5">
                  {/* Department short names are legal identifiers and stay
                      as they are in every language. What they do, doesn't. */}
                  <div className="type-h3" dir="ltr">
                    {d.shortName}
                  </div>
                  <div className="type-meta text-ink-faint mt-1.5 line-clamp-2">
                    {t.remit[d.id]}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      {/* ── live ticker ── */}
      <div className="rule-t bg-paper-sunk overflow-hidden">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex items-stretch">
            <div className="rule-e bg-ink text-paper flex shrink-0 items-center gap-2 px-4">
              <span className="pulse-dot text-signal block size-1.5 rounded-full bg-current" />
              <span className="type-eyebrow">{t.common.live}</span>
            </div>
            <ul className="flex flex-1 items-center gap-8 overflow-x-auto px-5 py-3">
              {recent.map((c) => (
                <li key={c.id} className="type-meta flex shrink-0 items-center gap-3">
                  <Link
                    href={`/track/${c.tracking_id}`}
                    className="text-ink-faint hover:text-ink transition-colors"
                    dir="ltr"
                  >
                    {c.tracking_id}
                  </Link>
                  <span className="text-ink">{t.category[c.category]}</span>
                  <span className="text-ink-faint">{c.neighbourhood}</span>
                  <span className={PRIORITY_COLOR[c.priority]} dir="ltr">
                    {c.priority}
                  </span>
                  <span
                    className="border-rule-strong text-ink-muted border px-1.5"
                    dir="ltr"
                  >
                    {DEPARTMENTS[c.department_id].shortName}
                  </span>
                  <span className="text-ink-faint">{shortAgo(c.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
