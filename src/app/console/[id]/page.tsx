import { ArrowLeft, Layers, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import StatusActions from "@/components/StatusActions";
import Timeline from "@/components/Timeline";
import { HazardChips, PriorityBadge, StatusPill } from "@/components/ui";
import { LANG_LABEL } from "@/lib/pipeline";
import { CATEGORIES, DEPARTMENTS } from "@/lib/taxonomy";
import { getComplaint, getEvents, listComplaints } from "@/lib/store";
import { slaCountdown, slaProgress } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ConsoleCase({ params }: PageProps<"/console/[id]">) {
  const { id } = await params;
  const c = await getComplaint(decodeURIComponent(id));
  if (!c) notFound();

  const [events, all] = await Promise.all([getEvents(c.id), listComplaints({ limit: 400 })]);
  const cluster = c.cluster_id
    ? all.filter((x) => x.cluster_id === c.cluster_id && x.id !== c.id)
    : [];

  const dept = DEPARTMENTS[c.department_id];
  const cat = CATEGORIES[c.category];
  const progress = slaProgress(c.created_at, c.due_at);
  const overdue = progress > 1 && c.status !== "resolved";
  const isUrdu = c.detected_language === "ur";

  return (
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-7 sm:px-7">
      <Link
        href="/console"
        className="type-eyebrow text-console-faint hover:text-console-ink inline-flex items-center gap-2 transition-colors"
      >
        <ArrowLeft className="size-3" />
        Dispatch queue
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:gap-12">
        {/* ── case ── */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="type-meta text-console-faint">{c.tracking_id}</span>
            <PriorityBadge priority={c.priority} />
            <StatusPill status={c.status} />
            {c.duplicate_count > 0 && (
              <span className="type-eyebrow border-signal text-signal inline-flex items-center gap-1.5 border px-1.5 py-1">
                <Layers className="size-3" />
                {c.duplicate_count} corroborating reports
              </span>
            )}
          </div>

          <h1 className="type-h1 mt-4 max-w-[22ch] text-balance">{c.title}</h1>

          <p className="type-meta text-console-faint mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3" />
              {c.address_text}
            </span>
            <span>
              {c.lat?.toFixed(5)}, {c.lng?.toFixed(5)}
            </span>
            <span>{cat.label}</span>
            <span>{LANG_LABEL[c.detected_language]}</span>
          </p>

          {/* SLA */}
          <div className="border-console-rule mt-7 border p-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="type-eyebrow text-console-faint">
                {c.status === "resolved" ? "Closed" : overdue ? "Past deadline by" : "Time remaining"}
              </span>
              <span
                className={`type-h3 tabular-nums ${overdue ? "text-p1" : c.status === "resolved" ? "text-resolved" : ""}`}
              >
                {c.status === "resolved"
                  ? "—"
                  : slaCountdown(c.due_at).replace("OVERDUE ", "")}
              </span>
            </div>
            <div className="bg-console-sunk mt-3 h-1.5">
              <div
                className={
                  c.status === "resolved"
                    ? "bg-resolved h-full"
                    : overdue
                      ? "bg-p1 h-full"
                      : "bg-signal h-full"
                }
                style={{ width: `${Math.min(100, progress * 100)}%` }}
              />
            </div>
            <p className="type-meta text-console-faint mt-2">
              {c.sla_hours}-hour standard · {dept.shortName}
              {dept.escalatesTo
                ? ` · escalates to ${DEPARTMENTS[dept.escalatesTo].shortName}`
                : ""}
            </p>
          </div>

          {/* actions */}
          <div className="mt-6">
            <h2 className="type-eyebrow text-console-faint mb-3">Move this case</h2>
            <StatusActions complaintId={c.id} current={c.status} />
          </div>

          {/* citizen's words */}
          <div className="border-console-rule mt-8 border-t pt-7">
            <h2 className="type-eyebrow text-console-faint mb-4">Citizen report, verbatim</h2>
            <blockquote
              className={`border-console-rule border-l-2 pl-4 ${isUrdu ? "type-urdu border-l-0 border-r-2 pr-4 pl-0 text-right" : "type-body"}`}
            >
              {c.raw_text}
            </blockquote>
            <p className="type-meta text-console-faint mt-3">
              Received by {c.intake_mode} · {Math.round(c.confidence * 100)}% confidence
              {c.citizen_name ? ` · ${c.citizen_name}` : " · reporter anonymous"}
              {c.citizen_phone ? ` · ${c.citizen_phone}` : ""}
            </p>
          </div>

          {/* letter */}
          <div className="border-console-rule mt-8 border-t pt-7">
            <h2 className="type-eyebrow text-console-faint mb-4">Formal complaint on file</h2>
            <div className="border-console-rule bg-console-raised max-h-[28rem] overflow-y-auto border p-5 sm:p-6">
              <pre className="type-body whitespace-pre-wrap">{c.formal_text}</pre>
            </div>
          </div>
        </div>

        {/* ── rail ── */}
        <aside className="space-y-8">
          <section>
            <h2 className="type-eyebrow text-console-faint mb-3">Case history</h2>
            <Timeline events={events} dark />
          </section>

          {c.hazard_flags.length > 0 && (
            <section>
              <h2 className="type-eyebrow text-console-faint mb-3">Risk signals</h2>
              <HazardChips hazards={c.hazard_flags} dark />
              <p className="type-body text-console-muted mt-3">{c.priority_reason}</p>
            </section>
          )}

          {cluster.length > 0 && (
            <section>
              <h2 className="type-eyebrow text-console-faint mb-3">
                Merged reports ({cluster.length})
              </h2>
              <ul className="border-console-rule divide-console-rule divide-y border">
                {cluster.slice(0, 8).map((x) => (
                  <li key={x.id}>
                    <Link
                      href={`/console/${x.tracking_id}`}
                      className="hover:bg-console-raised block px-3 py-2.5 transition-colors"
                    >
                      <div className="type-meta text-console-muted">{x.tracking_id}</div>
                      <div className="type-meta text-console-faint mt-0.5 truncate">
                        {x.raw_text.slice(0, 60)}…
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
