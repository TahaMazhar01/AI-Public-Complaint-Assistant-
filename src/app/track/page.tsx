import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import Masthead from "@/components/Masthead";
import { PriorityBadge, StatusPill } from "@/components/ui";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { DEPARTMENTS } from "@/lib/taxonomy";
import { listComplaints } from "@/lib/store";
import { shortAgo, slaCountdown, slaProgress } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Track a complaint" };

export default async function TrackIndex({ searchParams }: PageProps<"/track">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const { t } = await getI18n();
  const results = await listComplaints({ search: q, parentsOnly: true, limit: 40 });

  return (
    <div className="flex min-h-full flex-col">
      <Masthead />

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-10 sm:px-8">
        <div className="type-eyebrow text-ink-faint mb-6 flex items-center gap-3">
          <span className="bg-signal block h-px w-8" />
          <span>{t.track.eyebrow}</span>
        </div>

        <h1 className="type-h1 max-w-[18ch] text-balance">
          {t.track.title}
        </h1>
        <p className="type-lead mt-5 max-w-[52ch]">
          {t.track.lead}
        </p>

        {/* ── search ── */}
        <form className="mt-8 flex max-w-xl items-stretch" action="/track">
          <div className="border-rule focus-within:border-ink flex flex-1 items-center gap-2.5 border border-r-0 px-3 transition-colors">
            <Search className="text-ink-faint size-3.5 shrink-0" />
            <input
              name="q"
              defaultValue={q}
              placeholder={t.track.searchPlaceholder}
              className="type-body placeholder:text-ink-faint/70 w-full bg-transparent py-2.5 outline-none"
            />
          </div>
          <button className="bg-ink text-paper hover:bg-signal inline-flex items-center gap-2 px-4 transition-colors">
            <span className="type-action text-[0.85rem]">{t.common.search}</span>
            <ArrowRight className="size-3.5" />
          </button>
        </form>

        <p className="type-meta text-ink-faint mt-4">
          {q
            ? fmt(t.track.resultCountFor, { n: results.length, q })
            : fmt(t.track.resultCount, { n: results.length })}
        </p>

        {/* ── register ── */}
        <ul className="rule-t mt-6">
          {results.map((c) => {
            const progress = slaProgress(c.created_at, c.due_at);
            const overdue = progress > 1 && c.status !== "resolved";
            return (
              <li key={c.id} className="rule-b">
                <Link
                  href={`/track/${c.tracking_id}`}
                  className="hover:bg-paper-raised group grid gap-3 px-1 py-5 transition-colors sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="type-meta text-ink-faint">{c.tracking_id}</span>
                      <PriorityBadge priority={c.priority} withLabel={false} />
                      {c.duplicate_count > 0 && (
                        <span className="type-eyebrow border-signal text-signal border px-1.5 py-0.5">
                          +{c.duplicate_count}
                        </span>
                      )}
                    </div>
                    <h2 className="type-h3 mt-2 truncate">{t.category[c.category]}</h2>
                    <p className="type-meta text-ink-faint mt-1.5">
                      {c.neighbourhood} · {DEPARTMENTS[c.department_id].shortName} ·{" "}
                      {fmt(t.console.reportedAgo, { t: shortAgo(c.created_at) })}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 sm:justify-end">
                    <div className="text-right">
                      <StatusPill status={c.status} />
                      <div
                        className={`type-meta mt-1.5 tabular-nums ${overdue ? "text-p1" : "text-ink-faint"}`}
                      >
                        {c.status === "resolved" ? t.console.closed : slaCountdown(c.due_at)}
                      </div>
                    </div>
                    <ArrowRight className="text-ink-faint group-hover:text-ink hidden size-4 transition-colors sm:block" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        {results.length === 0 && (
          <div className="rule-b py-16 text-center">
            <p className="type-h3 text-ink-muted">{t.track.nothingMatches}</p>
            <p className="type-meta text-ink-faint mt-2">{t.track.checkNumber}</p>
          </div>
        )}
      </main>
    </div>
  );
}
