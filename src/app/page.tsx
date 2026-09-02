import Link from "next/link";
import IntakeConsole from "@/components/IntakeConsole";
import Masthead from "@/components/Masthead";
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
  const [recent, stats] = await Promise.all([
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
              <span>Public Complaint Assistant</span>
            </div>

            <h1 className="type-display text-balance">
              Say it once.
              <br />
              <span className="text-ink-muted">We file it</span> properly.
            </h1>

            <p className="type-urdu text-ink-muted mt-6 text-[1.15rem]">
              ایک بار بتائیں — باقی کام ہمارا
            </p>

            <p className="type-lead mt-5 max-w-[46ch]">
              No forms. No department names to memorise. Describe the problem the
              way you would to a neighbour — in Urdu, English, or both. Awaaz
              identifies the issue, routes it to the authority that actually owns
              it, sets a deadline, and hands you a tracking number.
            </p>

            <dl className="rule-t mt-10 grid grid-cols-3 gap-4 pt-6">
              <div>
                <dt className="type-numeral text-[2.5rem]">{stats.total}</dt>
                <dd className="type-eyebrow text-ink-faint mt-2">Cases filed</dd>
              </div>
              <div>
                <dt className="type-numeral text-[2.5rem]">{stats.resolvedPct}%</dt>
                <dd className="type-eyebrow text-ink-faint mt-2">Resolved</dd>
              </div>
              <div>
                <dt className="type-numeral text-[2.5rem]">{stats.medianHours}h</dt>
                <dd className="type-eyebrow text-ink-faint mt-2">Median close</dd>
              </div>
            </dl>

            <p className="type-meta text-ink-faint mt-5">
              {stats.open} open · {stats.overdue} past deadline · {stats.last24h} in
              the last 24 hours
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
              <div className="type-eyebrow text-ink-faint mb-5">Where complaints go</div>
              <h2 className="type-h1 text-balance">
                Twelve authorities.
                <br />
                One place to be heard.
              </h2>
              <p className="type-lead mt-5 max-w-[42ch]">
                The model reads the report and names the problem. A routing table —
                not the model — decides which department owns it. That keeps the
                assignment auditable even when the AI gets the wording wrong.
              </p>
            </div>

            <ul className="grid grid-cols-2 gap-px sm:grid-cols-3">
              {Object.values(DEPARTMENTS).map((d) => (
                <li key={d.id} className="border-rule border p-3.5">
                  <div className="type-h3">{d.shortName}</div>
                  <div className="type-meta text-ink-faint mt-1.5 line-clamp-2">
                    {d.remit}
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
            <div className="rule-r bg-ink text-paper flex shrink-0 items-center gap-2 px-4">
              <span className="pulse-dot text-signal block size-1.5 rounded-full bg-current" />
              <span className="type-eyebrow">Live</span>
            </div>
            <ul className="flex flex-1 items-center gap-8 overflow-x-auto px-5 py-3">
              {recent.map((c) => (
                <li key={c.id} className="type-meta flex shrink-0 items-center gap-3">
                  <Link
                    href={`/track/${c.tracking_id}`}
                    className="text-ink-faint hover:text-ink transition-colors"
                  >
                    {c.tracking_id}
                  </Link>
                  <span className="text-ink">{c.title}</span>
                  <span className="text-ink-faint">{c.neighbourhood}</span>
                  <span className={PRIORITY_COLOR[c.priority]}>{c.priority}</span>
                  <span className="border-rule-strong text-ink-muted border px-1.5">
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
