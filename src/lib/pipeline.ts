import type { Complaint, DuplicateMatch, HazardFlag, Priority } from "./types";

/* ============================================================
   PIPELINE CONTRACT
   Shared by the streaming route and the animation that watches it.
   ============================================================ */

export const STAGE_ORDER = [
  "received",
  "understanding",
  "classified",
  "routed",
  "deduped",
  "drafted",
  "filed",
] as const;

export type StageId = (typeof STAGE_ORDER)[number];

export const STAGE_META: Record<StageId, { label: string; doing: string }> = {
  received:      { label: "Received",      doing: "Reading the report" },
  understanding: { label: "Understood",    doing: "Interpreting language and intent" },
  classified:    { label: "Classified",    doing: "Identifying the issue" },
  routed:        { label: "Routed",        doing: "Selecting the responsible authority" },
  deduped:       { label: "Cross-checked", doing: "Matching against nearby reports" },
  drafted:       { label: "Drafted",       doing: "Composing the formal complaint" },
  filed:         { label: "Filed",         doing: "Assigning a tracking number" },
};

export interface StageEvent {
  stage: StageId | "error";
  at: number;

  // received
  chars?: number;
  mode?: string;
  neighbourhood?: string | null;
  engine?: string;

  // understanding
  language?: string;
  source?: "model" | "heuristic";
  ms?: number;
  confidence?: number;

  // classified
  category?: string;
  categoryLabel?: string;
  categoryLabelUr?: string;
  priority?: Priority;
  priorityReason?: string;
  hazards?: HazardFlag[];

  // routed
  departmentId?: string;
  departmentName?: string;
  departmentShort?: string;
  slaHours?: number;

  // deduped
  matches?: number;
  nearest?: DuplicateMatch | null;
  escalated?: boolean;
  finalPriority?: Priority;
  finalSla?: number;

  // drafted
  trackingId?: string;
  words?: number;

  // filed
  complaint?: Complaint;

  // error
  message?: string;
}

/** One-line detail rendered beside a completed stage. */
export function stageDetail(e: StageEvent): string {
  switch (e.stage) {
    case "received":
      return [
        `${e.chars} characters`,
        e.mode === "voice" ? "spoken" : e.mode === "photo" ? "with photo" : "typed",
        e.neighbourhood ?? null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "understanding":
      return [
        LANG_LABEL[e.language ?? "en"] ?? e.language,
        `${Math.round((e.confidence ?? 0) * 100)}% confidence`,
        e.source === "heuristic" ? "on-device" : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "classified":
      return `${e.categoryLabel} · ${e.priority} ${e.hazards?.length ? `· ${e.hazards.length} risk signal${e.hazards.length > 1 ? "s" : ""}` : ""}`;
    case "routed":
      return `${e.departmentShort} · ${e.slaHours}-hour deadline`;
    case "deduped":
      return e.matches
        ? `${e.matches} matching report${e.matches > 1 ? "s" : ""} nearby${e.escalated ? ` · escalated to ${e.finalPriority}` : ""}`
        : "No matching reports — new case";
    case "drafted":
      return `${e.words}-word formal complaint`;
    case "filed":
      return e.complaint?.tracking_id ?? "";
    default:
      return "";
  }
}

export const LANG_LABEL: Record<string, string> = {
  en: "English",
  ur: "Urdu",
  "ur-latn": "Roman Urdu",
  mixed: "Urdu + English",
};
