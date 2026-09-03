"use client";

import { Bot, CheckCircle2, Layers, TrendingUp, User, Wrench } from "lucide-react";
import type { ComplaintEvent } from "@/lib/types";
import { useI18n } from "./LocaleProvider";
import { cn } from "@/lib/utils";

/* The case history, rendered from the append-only event log.
   Nothing here is decorative — every row is a row in the database. */

const ICONS = {
  received: User,
  analysed: Bot,
  routed: Bot,
  merged: Layers,
  escalated: TrendingUp,
  status_changed: Wrench,
  note: Wrench,
  resolved: CheckCircle2,
} as const;

export default function Timeline({
  events,
  dark = false,
}: {
  events: ComplaintEvent[];
  dark?: boolean;
}) {
  const { t } = useI18n();
  return (
    <ol className="relative">
      <span
        className={cn(
          "absolute top-4 bottom-4 left-[0.4375rem] w-px",
          dark ? "bg-console-rule" : "bg-rule",
        )}
      />
      {events.map((e, i) => {
        const Icon = ICONS[e.kind] ?? Wrench;
        const isLast = i === events.length - 1;
        return (
          <li key={e.id} className="relative flex gap-4 pb-6 last:pb-0">
            <span
              className={cn(
                "relative z-10 mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full border",
                dark ? "bg-console" : "bg-paper",
                e.kind === "resolved"
                  ? "border-resolved text-resolved"
                  : e.kind === "escalated"
                    ? "border-p2 text-p2"
                    : isLast
                      ? dark
                        ? "border-console-ink"
                        : "border-ink"
                      : dark
                        ? "border-console-rule"
                        : "border-rule-strong",
              )}
            >
              <span className="block size-1.5 rounded-full bg-current" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  className={cn(
                    "type-eyebrow flex items-center gap-1.5",
                    dark ? "text-console-muted" : "text-ink-faint",
                  )}
                >
                  <Icon className="size-3" />
                  {t.actor[e.actor]}
                </span>
                <span
                  className={cn(
                    "type-meta",
                    dark ? "text-console-faint" : "text-ink-faint",
                  )}
                >
                  {new Date(e.created_at).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p
                className={cn(
                  "type-body mt-1.5",
                  dark ? "text-console-ink" : "text-ink",
                )}
              >
                {e.message}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
