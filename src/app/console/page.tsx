import { AlertTriangle, Layers } from "lucide-react";
import Link from "next/link";
import { DEPARTMENTS, PRIORITY_META } from "@/lib/taxonomy";
import { getStats, listComplaints } from "@/lib/store";
import type { DepartmentId, Priority } from "@/lib/types";
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

export default async function Console({ searchParams }: PageProps<"/console">) {
  const sp = await searchParams;
  const dept = (typeof sp.dept === "string" ? sp.dept : "all") as DepartmentId | "all";
  const view = typeof sp.view === "string" ? sp.view : "open";

  const [stats, queue] = await Promise.all([
    getStats(),
    listComplaints({
      department: dept,
      status: view === "all" ? "all" : view === "overdue" ? "open" : "open",
      parentsOnly: true,
      limit: 120,
    }),
  ]);

  const now = new Date();
  const rows = (
    view === "overdue" ? queue.filter((c) => new Date(c.due_at) < now) : queue
  ).sort((a, b) => {
    const p = PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank;
    return p !== 0 ? p : new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });

  const maxDept = Math.max(...stats.byDepartment.map((d) => d.count), 1);

  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-7 sm:px-7">
      {/* ── metrics ── */}
      <section className="border-console-rule grid grid-cols-2 gap-px border sm:grid-cols-5">
        {[
          { label: "Open cases", value: stats.open, sub: `${stats.last24h} in last 24h` },
          { label: "Critical", value: stats.critical, sub: "P1 awaiting action", tone: "critical" },
          { label: "Past deadline", value: stats.overdue, sub: "SLA breached", tone: "critical" },
          { label: "Resolved", value: `${stats.resolvedPct}%`, sub: `${stats.resolved} closed` , tone: "good" },
          { label: "Median close", value: `${stats.medianHours}h`, sub: "across all categories" },
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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h1 className="type-eyebrow text-console-faint">
              Dispatch queue · {rows.length} case{rows.length === 1 ? "" : "s"}
            </h1>
            <nav className="flex items-center gap-1">
              {[
                { id: "open", label: "Open" },
                { id: "overdue", label: "Past deadline" },
                { id: "all", label: "All" },
              ].map((t) => (
                <Link
                  key={t.id}
                  href={`/console?view=${t.id}${dept !== "all" ? `&dept=${dept}` : ""}`}
                  className={`type-eyebrow border px-2.5 py-1.5 transition-colors ${
                    view === t.id
                      ? "border-console-ink text-console-ink"
                      : "border-console-rule text-console-faint hover:text-console-ink"
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>

          <ul className="border-console-rule border">
            {rows.map((c) => {
              const overdue = slaProgress(c.created_at, c.due_at) > 1;
              return (
                <li key={c.id} className="border-console-rule border-b last:border-b-0">
                  <Link
                    href={`/console/${c.tracking_id}`}
                    className={`hover:bg-console-raised grid gap-x-4 gap-y-2 border-l-2 px-4 py-3.5 transition-colors sm:grid-cols-[5.5rem_1fr_9rem_6rem] sm:items-center ${PRIORITY_BORDER[c.priority]}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`type-eyebrow ${PRIORITY_TEXT[c.priority]}`}>
                        {c.priority}
                      </span>
                      {c.duplicate_count > 0 && (
                        <span className="type-meta text-signal inline-flex items-center gap-1">
                          <Layers className="size-3" />
                          {c.duplicate_count}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="type-h3 truncate">{c.title}</div>
                      <div className="type-meta text-console-faint mt-1 truncate">
                        {c.tracking_id} · {c.neighbourhood} · {shortAgo(c.created_at)} ago
                      </div>
                    </div>

                    <div className="type-meta text-console-muted">
                      {DEPARTMENTS[c.department_id].shortName}
                    </div>

                    <div
                      className={`type-meta tabular-nums sm:text-right ${overdue ? "text-p1" : "text-console-muted"}`}
                    >
                      {overdue && <AlertTriangle className="mr-1 inline size-3" />}
                      {slaCountdown(c.due_at).replace("OVERDUE ", "")}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {rows.length === 0 && (
            <p className="type-body text-console-faint border-console-rule border border-t-0 px-4 py-10 text-center">
              Queue clear.
            </p>
          )}
        </section>

        {/* ── right rail ── */}
        <aside className="space-y-7">
          <section>
            <h2 className="type-eyebrow text-console-faint mb-3">Load by authority</h2>
            <ul className="space-y-2.5">
              {stats.byDepartment.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/console?view=${view}&dept=${d.id}`}
                    className="group block"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={`type-meta transition-colors ${dept === d.id ? "text-console-ink" : "text-console-muted group-hover:text-console-ink"}`}
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
                href={`/console?view=${view}`}
                className="type-eyebrow text-console-faint hover:text-console-ink mt-3 inline-block transition-colors"
              >
                ← All authorities
              </Link>
            )}
          </section>

          <section>
            <h2 className="type-eyebrow text-console-faint mb-3">Severity mix</h2>
            <ul className="space-y-2">
              {(Object.keys(stats.byPriority) as Priority[]).map((p) => (
                <li key={p} className="flex items-center gap-3">
                  <span className={`type-eyebrow w-6 ${PRIORITY_TEXT[p]}`}>{p}</span>
                  <div className="bg-console-sunk h-3 flex-1">
                    <div
                      className={`h-full ${p === "P1" ? "bg-p1" : p === "P2" ? "bg-p2" : p === "P3" ? "bg-p3" : "bg-p4"}`}
                      style={{
                        width: `${(stats.byPriority[p] / stats.total) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="type-meta text-console-faint w-6 text-right tabular-nums">
                    {stats.byPriority[p]}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="border-console-rule border p-4">
            <h2 className="type-eyebrow text-console-faint mb-2">Clustering</h2>
            <p className="type-meta text-console-muted leading-relaxed">
              Reports matching an existing case by wording, category, and location
              within 300 m are merged rather than queued twice. The count beside a
              case is how many citizens are behind it.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
