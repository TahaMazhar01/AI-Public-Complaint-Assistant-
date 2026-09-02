"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { STAGE_META, STAGE_ORDER, type StageEvent, type StageId, stageDetail } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

/* ============================================================
   THE PROCESSING MOMENT
   Every row here lights up because a real stage finished on the
   server, not because a timer said so. The elapsed clock is the
   actual wall time. If the model is slow, you watch it be slow —
   that honesty is the point.
   ============================================================ */

interface Props {
  events: StageEvent[];
  engine: string | null;
}

export default function PipelineView({ events, engine }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const completed = new Map<StageId, StageEvent>();
  for (const e of events) {
    if (e.stage !== "error") completed.set(e.stage, e);
  }
  const isDone = completed.has("filed");
  const activeIndex = STAGE_ORDER.findIndex((s) => !completed.has(s));

  useEffect(() => {
    if (isDone) return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - t0), 47);
    return () => clearInterval(id);
  }, [isDone]);

  const shownElapsed = isDone ? (completed.get("filed")?.at ?? elapsed) : elapsed;
  const progress = completed.size / STAGE_ORDER.length;

  return (
    <div className="border-rule bg-paper-raised relative overflow-hidden border">
      {/* scan sweep — only while work is genuinely outstanding */}
      {!isDone && (
        <div
          className="from-signal/0 via-signal/8 to-signal/0 pointer-events-none absolute inset-x-0 h-24 bg-gradient-to-b"
          style={{ animation: "civic-scan 2.6s linear infinite" }}
        />
      )}

      <div className="rule-b flex items-center justify-between px-4 py-2.5">
        <span className="type-eyebrow text-ink-faint">
          {isDone ? "Complete" : "Processing"}
        </span>
        <span className="type-meta text-ink-muted tabular-nums">
          {(shownElapsed / 1000).toFixed(1)}s
        </span>
      </div>

      <ol className="relative px-4 py-5 sm:px-5">
        {/* the spine */}
        <span className="bg-rule absolute top-7 bottom-7 left-[1.4rem] w-px sm:left-[1.65rem]" />

        {STAGE_ORDER.map((stage, i) => {
          const event = completed.get(stage);
          const isActive = i === activeIndex && !isDone;
          const meta = STAGE_META[stage];

          return (
            <li key={stage} className="relative flex gap-4 py-2">
              {/* dot */}
              <span className="relative z-10 flex size-4 shrink-0 items-center justify-center">
                <motion.span
                  initial={false}
                  animate={{
                    scale: event ? 1 : isActive ? 1 : 0.55,
                    opacity: event || isActive ? 1 : 0.35,
                  }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className={cn(
                    "bg-paper-raised block size-2.5 rounded-full border",
                    event
                      ? "border-ink bg-ink"
                      : isActive
                        ? "border-signal pulse-dot text-signal"
                        : "border-rule-strong",
                  )}
                />
              </span>

              {/* label + detail */}
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={cn(
                      "type-h3 transition-colors duration-300",
                      event ? "text-ink" : isActive ? "text-signal" : "text-ink-faint",
                    )}
                  >
                    {event ? meta.label : meta.doing}
                  </span>
                  {event && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="type-meta text-ink-faint shrink-0 tabular-nums"
                    >
                      {(event.at / 1000).toFixed(1)}s
                    </motion.span>
                  )}
                </div>

                {event && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="type-meta text-ink-muted mt-1 break-words"
                  >
                    {stageDetail(event)}
                  </motion.p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* progress rail */}
      <div className="bg-paper-sunk relative h-1">
        <motion.div
          className={cn("h-full", isDone ? "bg-resolved" : "bg-signal")}
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {engine && (
        <div className="rule-t bg-paper-sunk px-4 py-2">
          <p className="type-meta text-ink-faint">Analysis engine · {engine}</p>
        </div>
      )}
    </div>
  );
}
