import type { Dictionary } from "./i18n";
import type { Complaint, DuplicateMatch, HazardFlag, Priority } from "./types";

/* ============================================================
   PIPELINE CONTRACT
   Shared by the streaming route and the animation that watches it.
   Stage LABELS live in the dictionaries — this file only knows the
   order and the data.
   ============================================================ */

export const STAGE_ORDER = [
  "received",
  "examined",
  "understanding",
  "classified",
  "routed",
  "deduped",
  "drafted",
  "filed",
] as const;

export type StageId = (typeof STAGE_ORDER)[number];

export interface StageEvent {
  stage: StageId | "error";
  at: number;

  // received
  chars?: number;
  photos?: number;

  // examined
  photoNote?: string | null;
  visionModel?: string;
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

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    k in vars ? String(vars[k]) : "",
  );
}

export function detectedLabel(code: string | undefined, t: Dictionary): string {
  switch (code) {
    case "ur":
      return t.detected.ur;
    case "ur-latn":
      return t.detected.urLatn;
    case "mixed":
      return t.detected.mixed;
    default:
      return t.detected.en;
  }
}

/** One line of detail rendered beside a completed stage, in the
    reader's language. Category names come from the dictionary too,
    so a Chinese reader never sees "Sewerage & Drainage". */
export function stageDetail(e: StageEvent, t: Dictionary): string {
  const p = t.pipeline;
  const join = (parts: (string | null | false)[]) => parts.filter(Boolean).join(" · ");

  switch (e.stage) {
    case "received":
      return join([
        fill(p.dChars, { n: e.chars ?? 0 }),
        e.mode === "voice" ? p.dSpoken : e.mode === "photo" ? p.dWithPhoto : p.dTyped,
        e.neighbourhood ?? null,
      ]);

    case "examined":
      return e.photoNote ? e.photoNote : p.dPhotoUnread;

    case "understanding":
      return join([
        detectedLabel(e.language, t),
        fill(p.dConfidence, { n: Math.round((e.confidence ?? 0) * 100) }),
        e.source === "heuristic" ? p.dOnDevice : null,
      ]);

    case "classified": {
      const cat =
        e.category && e.category in t.category
          ? t.category[e.category as keyof typeof t.category]
          : (e.categoryLabel ?? "");
      return join([
        cat,
        e.priority ?? null,
        e.hazards?.length ? fill(p.dRiskSignals, { n: e.hazards.length }) : null,
      ]);
    }

    case "routed":
      return join([e.departmentShort ?? null, fill(p.dDeadline, { n: e.slaHours ?? 0 })]);

    case "deduped":
      return e.matches
        ? join([
            fill(p.dMatches, { n: e.matches }),
            e.escalated ? fill(p.dEscalated, { p: e.finalPriority ?? "" }) : null,
          ])
        : p.dNoMatches;

    case "drafted":
      return fill(p.dWords, { n: e.words ?? 0 });

    case "filed":
      return e.complaint?.tracking_id ?? "";

    default:
      return "";
  }
}
