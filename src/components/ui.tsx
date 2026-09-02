import { HAZARD_LABELS, PRIORITY_META } from "@/lib/taxonomy";
import type { ComplaintStatus, HazardFlag, Priority } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ============================================================
   SHARED PRIMITIVES
   Colour here always encodes meaning. Nothing in this file is
   decorative — if you want a colour for looks, use ink.
   ============================================================ */

const PRIORITY_STYLES: Record<Priority, string> = {
  P1: "border-p1 text-p1",
  P2: "border-p2 text-p2",
  P3: "border-p3 text-p3",
  P4: "border-p4 text-p4",
};

export function PriorityBadge({
  priority,
  withLabel = true,
  className,
}: {
  priority: Priority;
  withLabel?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "type-eyebrow inline-flex items-center gap-1.5 border px-1.5 py-1",
        PRIORITY_STYLES[priority],
        className,
      )}
    >
      <span className="block size-1.5 rounded-full bg-current" />
      {priority}
      {withLabel && <span className="opacity-70">{PRIORITY_META[priority].label}</span>}
    </span>
  );
}

const STATUS_STYLES: Record<ComplaintStatus, string> = {
  submitted: "text-ink-faint",
  routed: "text-routed",
  acknowledged: "text-routed",
  in_progress: "text-progress",
  resolved: "text-resolved",
  rejected: "text-ink-faint",
};

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  submitted: "Submitted",
  routed: "Routed",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Closed",
};

export function StatusPill({
  status,
  className,
}: {
  status: ComplaintStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "type-eyebrow inline-flex items-center gap-1.5",
        STATUS_STYLES[status],
        className,
      )}
    >
      <span
        className={cn(
          "block size-1.5 rounded-full bg-current",
          (status === "in_progress" || status === "routed") && "pulse-dot",
        )}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** The visible justification for a priority. Never render a priority
    without these nearby — an unexplained severity is just a number. */
export function HazardChips({
  hazards,
  className,
  dark = false,
}: {
  hazards: HazardFlag[];
  className?: string;
  dark?: boolean;
}) {
  if (!hazards.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {hazards.map((h) => (
        <li
          key={h}
          className={cn(
            "type-eyebrow border px-1.5 py-1",
            dark
              ? "border-console-rule text-console-muted"
              : "border-rule-strong text-ink-muted",
          )}
        >
          {HAZARD_LABELS[h] ?? h}
        </li>
      ))}
    </ul>
  );
}

/** Small labelled figure used across both surfaces. */
export function Metric({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "critical" | "good";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="type-eyebrow text-ink-faint">{label}</div>
      <div
        className={cn(
          "type-numeral mt-2 text-[2rem]",
          tone === "critical" && "text-p1",
          tone === "good" && "text-resolved",
        )}
      >
        {value}
      </div>
      {sub && <div className="type-meta text-ink-faint mt-1.5">{sub}</div>}
    </div>
  );
}
