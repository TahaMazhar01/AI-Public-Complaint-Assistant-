"use client";

import { motion } from "motion/react";
import { ArrowRight, Check, Copy, FileText, Layers, Plus } from "lucide-react";
import { useState } from "react";
import { DEPARTMENTS, PRIORITY_META } from "@/lib/taxonomy";
import type { Complaint } from "@/lib/types";
import { slaCountdown } from "@/lib/utils";
import { HazardChips, PriorityBadge } from "./ui";

/* ============================================================
   THE RECEIPT
   The artefact the citizen walks away with. It is deliberately
   built like a document rather than a success screen — a serial
   number, a named authority, a deadline, and the actual letter
   that was filed on their behalf.
   ============================================================ */

export default function ComplaintResult({
  complaint,
  matches,
  escalated,
  onReset,
}: {
  complaint: Complaint;
  matches: number;
  escalated: boolean;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const dept = DEPARTMENTS[complaint.department_id];

  const copy = async () => {
    await navigator.clipboard.writeText(complaint.tracking_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="border-rule bg-paper-raised border"
    >
      <div className="perforated h-px w-full" />

      {/* ── header ── */}
      <div className="rule-b flex items-center justify-between px-4 py-2.5 sm:px-5">
        <span className="type-eyebrow text-ink-faint">Complaint filed</span>
        <span className="type-meta text-ink-faint">
          {new Date(complaint.created_at).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* ── tracking number ── */}
      <div className="rule-b px-4 py-6 sm:px-5">
        <div className="type-eyebrow text-ink-faint mb-3">Your tracking number</div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[clamp(1.25rem,3.4vw,1.85rem)] leading-none tracking-tight tabular-nums">
            {complaint.tracking_id}
          </span>
          <button
            onClick={copy}
            className="border-rule text-ink-muted hover:border-ink hover:text-ink inline-flex items-center gap-1.5 border px-2 py-1.5 transition-colors"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            <span className="type-eyebrow">{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
        <h2 className="type-h2 mt-5 text-balance">{complaint.title}</h2>
      </div>

      {/* ── the three facts that matter ── */}
      <dl className="rule-b grid grid-cols-2 sm:grid-cols-3">
        <div className="rule-r px-4 py-4 sm:px-5">
          <dt className="type-eyebrow text-ink-faint">Authority</dt>
          <dd className="type-h3 mt-2">{dept.shortName}</dd>
          <dd className="type-meta text-ink-faint mt-1">{dept.remit.split(",")[0]}</dd>
        </div>
        <div className="sm:rule-r px-4 py-4 sm:px-5">
          <dt className="type-eyebrow text-ink-faint">Priority</dt>
          <dd className="mt-2">
            <PriorityBadge priority={complaint.priority} />
          </dd>
          <dd className="type-meta text-ink-faint mt-1.5">
            {PRIORITY_META[complaint.priority].description}
          </dd>
        </div>
        <div className="rule-t col-span-2 px-4 py-4 sm:col-span-1 sm:border-t-0 sm:px-5">
          <dt className="type-eyebrow text-ink-faint">Response due in</dt>
          <dd className="type-h3 mt-2 tabular-nums">{slaCountdown(complaint.due_at)}</dd>
          <dd className="type-meta text-ink-faint mt-1">
            {complaint.sla_hours}-hour service standard
          </dd>
        </div>
      </dl>

      {/* ── why this priority ── */}
      {complaint.hazard_flags.length > 0 && (
        <div className="rule-b px-4 py-4 sm:px-5">
          <div className="type-eyebrow text-ink-faint mb-3">Why this priority</div>
          <HazardChips hazards={complaint.hazard_flags} />
          <p className="type-body text-ink-muted mt-3">{complaint.priority_reason}</p>
        </div>
      )}

      {/* ── the cluster — the line that lands in a demo ── */}
      {matches > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="rule-b bg-signal/6 flex items-start gap-3 px-4 py-4 sm:px-5"
        >
          <Layers className="text-signal mt-0.5 size-4 shrink-0" />
          <div>
            <p className="type-h3">
              {matches} other {matches === 1 ? "person has" : "people have"} reported this
            </p>
            <p className="type-body text-ink-muted mt-1">
              Your report was merged into the same case rather than filed as a duplicate.
              {escalated
                ? " The volume of corroborating reports raised its priority automatically."
                : " A single case with more reporters carries more weight with the department."}
            </p>
          </div>
        </motion.div>
      )}

      {/* ── the letter ── */}
      <div className="rule-b">
        <button
          onClick={() => setLetterOpen((v) => !v)}
          className="hover:bg-paper-sunk flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors sm:px-5"
        >
          <span className="flex items-center gap-2.5">
            <FileText className="text-ink-muted size-3.5" />
            <span className="type-eyebrow">The formal complaint we filed</span>
          </span>
          <span className="type-meta text-ink-faint">{letterOpen ? "Hide" : "Read"}</span>
        </button>

        {letterOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="bg-paper-sunk rule-t max-h-[26rem] overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
              <pre className="type-body whitespace-pre-wrap">{complaint.formal_text}</pre>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── actions ── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-4 sm:px-5">
        <a
          href={`/track/${complaint.tracking_id}`}
          className="bg-ink text-paper hover:bg-signal inline-flex items-center gap-2 px-4 py-2.5 transition-colors"
        >
          <span className="type-eyebrow">Track this complaint</span>
          <ArrowRight className="size-3.5" />
        </a>
        <button
          onClick={onReset}
          className="border-rule text-ink-muted hover:border-ink hover:text-ink inline-flex items-center gap-2 border px-4 py-2.5 transition-colors"
        >
          <Plus className="size-3.5" />
          <span className="type-eyebrow">Report something else</span>
        </button>
      </div>
    </motion.div>
  );
}
