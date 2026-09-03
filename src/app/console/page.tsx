import { AlertTriangle, Layers, Search } from "lucide-react";
import Link from "next/link";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { DEPARTMENTS, PRIORITY_META } from "@/lib/taxonomy";
import { activeBackend, getStats, listComplaints } from "@/lib/store";
import type { Complaint, DepartmentId, Priority } from "@/lib/types";
import { shortAgo, slaCountdown, slaProgress } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Authority console" };

const PRIORITY_TEXT: Record<Priority, string> = {
  P1: "text-p1",
  P2: "text-p2",
  P3: "text-p3",
  P4: "text-p4",
};

const PRIORITY_BORDER: Record<Priority, string> = {
  P1: "border-l-p1",
  P2: "border-l-p2",
  P3: "border-l-p3",
  P4: "border-l-p4",
};

const PRIORITY_BG: Record<Priority, string> = {
  P1: "bg-p1",
  P2: "bg-p2",
  P3: "bg-p3",
  P4: "bg-p4",
};

export default async function Console({ searchParams }: PageProps<"/console">) {
  const sp = await searchParams;
  const dept = (typeof sp.dept === "string" ? sp.dept : "all") as DepartmentId | "all";
  const view = typeof sp.view === "string" ? sp.view : "open";
  const q = typeof sp.q === "string" ? sp.q : "";

  const { t } = await getI18n();
  const [stats, pool] = await Promise.all([
    getStats(),
    listComplaints({ department: dept, search: q, parentsOnly: true, limit: 400 }),
  ]);

  const now = new Date();
  const isOverdue = (c: Complaint) =>
    new Date(c.due_at) < now && c.status !== "resolved";
  const isOpen = (c: Complaint) =>
    ["submitted", "routed", "acknowledged", "in_progress"].includes(c.status);

  const counts = {
    open: pool.filter(isOpen).length,
    overdue: pool.filter((c) => isOpen(c) && isOverdue(c)).length,
    all: pool.length,
  };

  const rows = (
    view === "overdue"
      ? pool.filter((c) => isOpen(c) && isOverdue(c))
      : view === "all"
        ? pool
        : pool.filter(isOpen)
  ).sort((a, b) => {
    const p = PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank;
    return p !== 0 ? p : new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });

  const maxDept = Math.max(...stats.byDepartment.map((d) => d.count), 1);
  const criticalLate = pool.filter(
    (c) => isOpen(c) && isOverdue(c) && c.priority === "P1",
  );

  const keep = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (view !== "open") p.set("view", view);
    if (dept !== "all") p.set("dept", dept);
    if (q) p.set("q", q);
    for (const [k, v] of Object.entries(extra)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return `/console${s ? `?${s}` : ""}`;
  };

  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-7 sm:px-7">
      {/* The console is dense and visual; the heading is for anyone
          arriving by screen reader, who otherwise gets no page title. */}
      <h1 className="sr-only">{t.console.heading}</h1>
      {/* ── what needs attention right now ── */}
      {criticalLate.length > 0 && (
        <Link
          href="/console?view=overdue"
          className="border-p1 bg-p1/10 hover:bg-p1/15 mb-6 flex items-center gap-3 border px-4 py-3.5 transition-colors"
        >
          <AlertTriangle className="text-p1 size-4 shrink-0" />
          <p className="type-action text-console-ink">
            {criticalLate.length === 1
              ? t.console.criticalLateOne
              : fmt(t.console.criticalLate, { n: criticalLate.length })}
          </p>
          <span className="type-meta text-console-muted ml-auto hidden truncate sm:block">
            {t.console.oldest}: {t.category[criticalLate[0].category]} ·{" "}
            {criticalLate[0].neighbourhood}
          </span>
        </Link>
      )}

      {/* ── metrics ── */}
      <section className="border-console-rule grid grid-cols-2 gap-px border sm:grid-cols-5">
        {[
          {
            label: t.console.openCases,
            value: stats.open,
            sub: fmt(t.console.arrivedToday, { n: stats.last24h }),
          },
          {
            label: t.console.critical,
            value: stats.critical,
            sub: t.console.awaitingAction,
            tone: "critical",
          },
          {
            label: t.console.pastDeadline,
            value: stats.overdue,
            sub: t.console.slaMissed,
            tone: "critical",
          },
          {
            label: t.console.resolved,
            value: `${stats.resolvedPct}%`,
            sub: fmt(t.console.casesClosed, { n: stats.resolved }),
            tone: "good",
          },
          {
            label: t.console.medianClose,
            value: `${stats.medianHours}h`,
            sub: t.console.reportToFix,
          },
        ].map((m) => (
          <div key={m.label} className="bg-console-raised px-4 py-4">
            <div className="type-eyebrow text-console-faint">{m.label}</div>
            <div
              className={`type-numeral mt-2.5 text-[2.25rem] ${
                m.tone === "critical" && Number(m.value) > 0
                  ? "text-p1"
                  : m.tone === "good"
                    ? "text-resolved"
                    : ""
              }`}
            >
              {m.value}
            </div>
            <div className="type-meta text-console-faint mt-1.5">{m.sub}</div>
          </div>
        ))}
      </section>

      <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_18rem] lg:gap-8">
        {/* ── queue ── */}
        <section className="min-w-0">
          {/* controls */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <nav className="flex items-stretch">
              {[
                { id: "open", label: t.console.tabOpen, n: counts.open },
                { id: "overdue", label: t.console.tabOverdue, n: counts.overdue },
                { id: "all", label: t.console.tabAll, n: counts.all },
              ].map((tab) => (
                <Link
                  key={tab.id}
                  href={keep({ view: tab.id === "open" ? "" : tab.id })}
                  className={`flex h-11 items-center gap-2 border px-4 transition-colors ${
                    view === tab.id
                      ? "border-console-ink bg-console-raised text-console-ink"
                      : "border-console-rule text-console-faint hover:text-console-ink -ms-px"
                  }`}
                >
                  <span className="type-action">{tab.label}</span>
                  <span
                    className={`type-meta tabular-nums ${
                      tab.id === "overdue" && tab.n > 0 ? "text-p1" : "opacity-60"
                    }`}
                  >
                    {tab.n}
                  </span>
                </Link>
              ))}
            </nav>

            <form action="/console" className="flex items-stretch">
              {view !== "open" && <input type="hidden" name="view" value={view} />}
              {dept !== "all" && <input type="hidden" name="dept" value={dept} />}
              <div className="border-console-rule focus-within:border-console-ink flex h-11 items-center gap-2 border px-3 transition-colors">
                <Search className="text-console-faint size-3.5 shrink-0" />
                <input
                  name="q"
                  defaultValue={q}
                  placeholder={t.console.searchPlaceholder}
                  className="type-body placeholder:text-console-faint text-console-ink w-56 bg-transparent outline-none"
                />
              </div>
            </form>
          </div>

          {/* column headers — an officer should never guess a column */}
          <div className="border-console-rule text-console-faint hidden grid-cols-[5.5rem_1fr_9rem_7rem] gap-x-4 border border-b-0 px-4 py-2.5 sm:grid">
            <span className="type-eyebrow">{t.console.colPriority}</span>
            <span className="type-eyebrow">{t.console.colCase}</span>
            <span className="type-eyebrow">{t.console.colAuthority}</span>
            <span className="type-eyebrow text-right">{t.console.colTimeLeft}</span>
          </div>

          <ul className="border-console-rule border">
            {rows.map((c) => {
              const overdue = slaProgress(c.created_at, c.due_at) > 1 && c.status !== "resolved";
              return (
                <li key={c.id} className="border-console-rule border-b last:border-b-0">
                  <Link
                    href={`/console/${c.tracking_id}`}
                    className={`hover:bg-console-raised grid gap-x-4 gap-y-2 border-l-2 px-4 py-4 transition-colors sm:grid-cols-[5.5rem_1fr_9rem_7rem] sm:items-center ${PRIORITY_BORDER[c.priority]}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`type-action ${PRIORITY_TEXT[c.priority]}`}>
                        {c.priority}
                      </span>
                      {c.duplicate_count > 0 && (
                        <span
                          className="text-signal type-meta inline-flex items-center gap-1"
                          title={fmt(t.map.corroborating, { n: c.duplicate_count })}
                        >
                          <Layers className="size-3" />
                          {c.duplicate_count}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="type-action truncate">{t.category[c.category]}</div>
                      <div className="type-meta text-console-faint mt-1 truncate">
                        {c.neighbourhood} ·{" "}
                        {fmt(t.console.reportedAgo, { t: shortAgo(c.created_at) })} ·{" "}
                        <span dir="ltr">{c.tracking_id}</span>
                      </div>
                    </div>

                    <div className="type-body text-console-muted">
                      {DEPARTMENTS[c.department_id].shortName}
                    </div>

                    <div className="sm:text-right">
                      {c.status === "resolved" ? (
                        <span className="type-meta text-resolved">{t.console.closed}</span>
                      ) : overdue ? (
                        <span className="type-action text-p1 inline-flex items-center gap-1.5 tabular-nums">
                          <AlertTriangle className="size-3.5" />
                          {slaCountdown(c.due_at).replace("OVERDUE ", "")} {t.console.late}
                        </span>
                      ) : (
                        <span className="type-body text-console-muted tabular-nums">
                          {slaCountdown(c.due_at)}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {rows.length === 0 && (
            <p className="type-body text-console-faint border-console-rule border border-t-0 px-4 py-12 text-center">
              {q
                ? fmt(t.console.noMatch, { q })
                : view === "overdue"
                  ? t.console.nothingOverdue
                  : t.console.queueClear}
            </p>
          )}
        </section>

        {/* ── right rail ── */}
        <aside className="space-y-7">
          <section>
            <h2 className="type-eyebrow text-console-faint mb-3">{t.console.loadByAuthority}</h2>
            <ul className="space-y-2.5">
              {stats.byDepartment.map((d) => (
                <li key={d.id}>
                  <Link href={keep({ dept: dept === d.id ? "" : d.id })} className="group block">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={`type-body transition-colors ${dept === d.id ? "text-console-ink" : "text-console-muted group-hover:text-console-ink"}`}
                      >
                        {DEPARTMENTS[d.id].shortName}
                      </span>
                      <span className="type-meta text-console-faint tabular-nums">
                        {d.count}
                        {d.overdue > 0 && <span className="text-p1"> · {d.overdue} late</span>}
                      </span>
                    </div>
                    <div className="bg-console-sunk mt-1.5 h-1">
                      <div
                        className={dept === d.id ? "bg-signal h-full" : "bg-console-rule h-full"}
                        style={{ width: `${(d.count / maxDept) * 100}%` }}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {dept !== "all" && (
              <Link
                href={keep({ dept: "" })}
                className="type-body text-console-faint hover:text-console-ink mt-3 inline-block transition-colors"
              >
                ← {t.console.showAllAuthorities}
              </Link>
            )}
          </section>

          <section>
            <h2 className="type-eyebrow text-console-faint mb-3">{t.console.whatCodesMean}</h2>
            <ul className="space-y-2.5">
              {(["P1", "P2", "P3", "P4"] as Priority[]).map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <span className={`type-action w-6 shrink-0 ${PRIORITY_TEXT[p]}`}>{p}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="type-body text-console-muted">
                        {t.priority[p].label}
                      </span>
                      <span className="type-meta text-console-faint tabular-nums">
                        {stats.byPriority[p]}
                      </span>
                    </div>
                    <div className="bg-console-sunk mt-1.5 h-1">
                      <div
                        className={`h-full ${PRIORITY_BG[p]}`}
                        style={{
                          width: `${(stats.byPriority[p] / Math.max(stats.total, 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="border-console-rule border p-4">
            <h2 className="type-eyebrow text-console-faint mb-2">
              <Layers className="mr-1.5 inline size-3" />
              {t.console.mergedReports}
            </h2>
            <p className="type-body text-console-muted leading-relaxed">
              {t.console.mergedExplain}
            </p>
            {/* Proof for the pitch: the numbers above came out of a real
                database, or they did not. Say which. */}
            <p className="border-console-rule type-meta text-console-faint mt-3 border-t pt-2.5">
              {t.console.storage} ·{" "}
              {activeBackend() === "postgres"
                ? t.console.storagePostgres
                : t.console.storageMemory}
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
