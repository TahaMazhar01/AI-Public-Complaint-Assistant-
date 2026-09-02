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

/* ============================================================
   ACTIONS
   Sized for a thumb, labelled in both languages. A citizen who
   reads only Urdu should be able to complete the whole flow.
   ============================================================ */

type ButtonVariant = "primary" | "outline" | "quiet" | "danger";
type ButtonSize = "md" | "lg" | "xl";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-signal border border-ink hover:border-signal",
  outline: "border border-rule-strong text-ink hover:border-ink hover:bg-paper-sunk",
  quiet: "border border-transparent text-ink-muted hover:text-ink hover:bg-paper-sunk",
  danger: "border border-p1 text-p1 hover:bg-p1 hover:text-paper",
};

const SIZES: Record<ButtonSize, string> = {
  md: "h-11 px-4 gap-2",
  lg: "h-14 px-5 gap-2.5",
  xl: "h-16 px-6 gap-3",
};

export function Button({
  variant = "primary",
  size = "md",
  urdu,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Urdu rendered beside the English label, not instead of it. */
  urdu?: string;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-35",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      <span className={size === "xl" ? "type-action-lg" : "type-action"}>{children}</span>
      {urdu && (
        <span
          className={cn(
            "type-urdu-inline opacity-60",
            size === "xl" ? "text-[1.05rem]" : "text-[0.9rem]",
          )}
        >
          {urdu}
        </span>
      )}
    </button>
  );
}

/** English over Urdu, stacked. For headings and big choices. */
export function BiLabel({
  en,
  ur,
  className,
  size = "md",
}: {
  en: string;
  ur: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span className={cn("flex flex-col items-center gap-1.5", className)}>
      <span
        className={
          size === "lg" ? "type-h2" : size === "md" ? "type-action-lg" : "type-action"
        }
      >
        {en}
      </span>
      <span
        className={cn(
          "type-urdu text-ink-muted",
          size === "lg" ? "text-[1.15rem]" : size === "md" ? "text-[0.95rem]" : "text-[0.8rem]",
        )}
        style={{ lineHeight: 1.9 }}
      >
        {ur}
      </span>
    </span>
  );
}
