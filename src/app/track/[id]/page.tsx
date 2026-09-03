import { ArrowLeft, Layers, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Masthead from "@/components/Masthead";
import Timeline from "@/components/Timeline";
import { HazardChips, PriorityBadge, StatusPill } from "@/components/ui";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { detectedLabel } from "@/lib/pipeline";
import { CATEGORIES, DEPARTMENTS } from "@/lib/taxonomy";
import { getComplaint, getEvents, listComplaints } from "@/lib/store";
import { slaCountdown, slaProgress } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TrackDetail({ params }: PageProps<"/track/[id]">) {
  const { id } = await params;
  const complaint = await getComplaint(decodeURIComponent(id));
  if (!complaint) notFound();

  const { t } = await getI18n();
  const [events, siblings] = await Promise.all([
    getEvents(complaint.id),
    complaint.cluster_id
      ? listComplaints({ limit: 400 })
      : Promise.resolve([]),
  ]);

  const cluster = siblings.filter(
    (c) => c.cluster_id === complaint.cluster_id && c.id !== complaint.id,
  );

  const dept = DEPARTMENTS[complaint.department_id];
  const cat = CATEGORIES[complaint.category];
  const progress = slaProgress(complaint.created_at, complaint.due_at);
  const overdue = progress > 1 && complaint.status !== "resolved";
  const isUrdu = complaint.detected_language === "ur";

  return (
    <div className="flex min-h-full flex-col">
      <Masthead />

      <main className="mx-auto w-full max-w-[1000px] flex-1 px-5 py-10 sm:px-8">
        <Link
          href="/track"
          className="type-eyebrow text-ink-faint hover:text-ink inline-flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="size-3" />
          {t.track.allComplaints}
        </Link>

        {/* ── case header ── */}
        <div className="rule-b mt-6 pb-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="type-meta text-ink-faint">{complaint.tracking_id}</span>
            <StatusPill status={complaint.status} />
            <PriorityBadge priority={complaint.priority} />
          </div>

          <h1 className="type-h1 mt-4 max-w-[24ch] text-balance">{complaint.title}</h1>

          <p className="type-meta text-ink-faint mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3" />
              {complaint.address_text}
            </span>
            <span>{t.category[complaint.category]}</span>
            <span>
              {t.track.filedAt}{" "}
              {new Date(complaint.created_at).toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span>{detectedLabel(complaint.detected_language, t)}</span>
          </p>
        </div>

        {/* ── SLA ── */}
        <div className="rule-b py-6">
          <div className="flex items-baseline justify-between gap-4">
            <span className="type-eyebrow text-ink-faint">
              {complaint.status === "resolved"
                ? t.track.closedWithin
                : overdue
                  ? t.track.pastDeadlineBy
                  : t.track.responseDueIn}
            </span>
            <span
              className={`type-h3 tabular-nums ${overdue ? "text-p1" : complaint.status === "resolved" ? "text-resolved" : ""}`}
            >
              {complaint.status === "resolved" && complaint.resolved_at
                ? `${Math.round((new Date(complaint.resolved_at).getTime() - new Date(complaint.created_at).getTime()) / 3600_000)}h`
                : slaCountdown(complaint.due_at).replace("OVERDUE ", "")}
            </span>
          </div>
          <div className="bg-paper-sunk mt-3 h-1.5 w-full">
            <div
              className={
                complaint.status === "resolved"
                  ? "bg-resolved h-full"
                  : overdue
                    ? "bg-p1 h-full"
                    : "bg-ink h-full"
              }
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
          <p className="type-meta text-ink-faint mt-2">
            {fmt(t.track.standardFor, {
              n: complaint.sla_hours,
              cat: t.category[complaint.category],
              p: complaint.priority,
            })}
          </p>
        </div>

        <div className="grid gap-10 py-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
          {/* ── left: history + report ── */}
          <div>
            <h2 className="type-eyebrow text-ink-faint mb-6">{t.track.caseHistory}</h2>
            <Timeline events={events} />

            <div className="rule-t mt-10 pt-8">
              <h2 className="type-eyebrow text-ink-faint mb-4">
                {t.track.verbatim}
              </h2>
              <blockquote
                className={`border-rule-strong border-l-2 pl-4 ${isUrdu ? "type-urdu border-l-0 border-r-2 pr-4 pl-0 text-right" : "type-body"}`}
              >
                {complaint.raw_text}
              </blockquote>
              <p className="type-meta text-ink-faint mt-3">
                {fmt(t.track.receivedBy, {
                  mode: t.intakeMode[complaint.intake_mode],
                  n: Math.round(complaint.confidence * 100),
                })}
              </p>
            </div>

            <div className="rule-t mt-10 pt-8">
              <h2 className="type-eyebrow text-ink-faint mb-4">
                {fmt(t.track.formalFiledWith, { dept: dept.shortName })}
              </h2>
              <div className="border-rule bg-paper-raised max-h-[30rem] overflow-y-auto border p-5 sm:p-7">
                <pre className="type-body whitespace-pre-wrap">{complaint.formal_text}</pre>
              </div>
            </div>
          </div>

          {/* ── right: authority, risk, cluster ── */}
          <aside className="space-y-8">
            <section>
              <h2 className="type-eyebrow text-ink-faint mb-3">{t.track.responsibleAuthority}</h2>
              <div className="border-rule border p-4">
                <div className="type-h3">{dept.shortName}</div>
                <p className="type-body text-ink-muted mt-1">{dept.name}</p>
                <p className="type-meta text-ink-faint mt-3">{t.remit[dept.id]}</p>
                {complaint.assigned_officer && (
                  <p className="rule-t type-meta text-ink-muted mt-3 pt-3">
                    {t.track.assigned} · {complaint.assigned_officer}
                  </p>
                )}
              </div>
            </section>

            {complaint.hazard_flags.length > 0 && (
              <section>
                <h2 className="type-eyebrow text-ink-faint mb-3">{t.receipt.whyPriority}</h2>
                <HazardChips hazards={complaint.hazard_flags} />
                <p className="type-body text-ink-muted mt-3">{complaint.priority_reason}</p>
              </section>
            )}

            {cluster.length > 0 && (
              <section>
                <h2 className="type-eyebrow text-ink-faint mb-3">{t.track.reportedByOthers}</h2>
                <div className="border-signal/40 bg-signal/6 border p-4">
                  <div className="flex items-start gap-2.5">
                    <Layers className="text-signal mt-0.5 size-4 shrink-0" />
                    <p className="type-body">
                      <strong className="font-semibold">
                        {fmt(t.track.otherReports, { n: cluster.length })}
                      </strong>{" "}
                      {t.track.joinedToCase}
                    </p>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {cluster.slice(0, 6).map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/track/${c.tracking_id}`}
                          className="type-meta text-ink-muted hover:text-ink transition-colors"
                        >
                          {c.tracking_id} ·{" "}
                          {new Date(c.created_at).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
