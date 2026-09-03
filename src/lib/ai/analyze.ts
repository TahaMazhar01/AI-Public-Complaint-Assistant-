import { generateObject } from "ai";
import { z } from "zod";
import { CATEGORIES, CATEGORY_IDS, PRIORITY_META } from "../taxonomy";
import type { CategoryId, ComplaintAnalysis, HazardFlag, Language } from "../types";
import { resolveModel } from "./provider";

/* ============================================================
   THE ONE MODEL CALL
   Everything the system needs from the AI comes back in a single
   structured response. Department routing is deliberately absent —
   the model picks a category, taxonomy.ts picks the department.
   ============================================================ */

const HAZARDS = [
  "children_at_risk",
  "health_hazard",
  "traffic_danger",
  "structural_risk",
  "fire_or_electrical_risk",
  "water_contamination",
  "elderly_or_disabled_affected",
  "blocking_access",
  "recurring_issue",
  "large_population_affected",
] as const;

export const analysisSchema = z.object({
  title: z
    .string()
    .describe("Neutral official case title, max 9 words, in the requested output language."),
  summary: z
    .string()
    .describe(
      "Two or three sentences restating the report in formal register, in the requested output language, preserving every concrete detail (durations, counts, who is affected). Never invent facts.",
    ),
  category: z.enum(CATEGORY_IDS as [CategoryId, ...CategoryId[]]),
  priority: z.enum(["P1", "P2", "P3", "P4"]),
  priority_reason: z
    .string()
    .describe("One sentence explaining the priority, citing the evidence in the report."),
  hazard_flags: z.array(z.enum(HAZARDS)),
  detected_language: z.enum(["en", "ur", "ur-latn", "mixed"]),
  location_hint: z
    .string()
    .nullable()
    .describe("Any place name or landmark mentioned, else null. Do not guess."),
  confidence: z.number().min(0).max(1),
  needs_clarification: z
    .string()
    .nullable()
    .describe("One short question if the report is too vague to act on, else null."),
});

const SYSTEM_PROMPT = `You are the intake analyst for Awaaz, a public complaint system for Lahore, Pakistan.

Citizens describe civic problems informally — in English, Urdu script, Roman Urdu, or a mix. Your job is to turn one report into a structured, actionable case.

RULES
1. Never invent facts. If the citizen did not say how long, where, or who is affected, do not supply it. Vagueness is recorded, not filled in.
2. Preserve every concrete detail: durations ("three days"), counts ("two bikes"), and vulnerable groups ("children", "elderly").
3. Roman Urdu is normal input, not an error. "sarak", "pani", "kachra", "bijli", "gaddha", "andhera", "shor", "qabza" are ordinary words — read them.
4. Write the summary in formal English suitable for a government file, even when the report is casual.

PRIORITY
P1 Critical — immediate risk to life, health or safety: exposed live wiring, gas leaks, open manholes, contaminated drinking water, animal bites, structural collapse risk, sewage where children play.
P2 High — serious disruption, or a hazard that will clearly worsen: accidents already occurring, outages affecting a whole block, health hazards during an outbreak season.
P3 Medium — a standard civic fault degrading daily life with no direct safety risk.
P4 Low — minor or cosmetic.

Escalate a level when the report evidences children, the elderly or disabled, a large affected population, or an issue already reported and ignored. Do not escalate on emotional language alone — escalate on facts.

HAZARD FLAGS
Emit only flags the text genuinely supports. They are shown to the citizen as the justification for the priority, so an unsupported flag is a visible error.`;

export interface AnalyzeInput {
  text: string;
  neighbourhood?: string | null;
  hasPhoto?: boolean;
  /** Language the citizen is reading the app in. The case title and
      summary come back in this language so nothing they are shown is
      in a language they did not choose. */
  locale?: "en" | "ur" | "zh";
}

export interface AnalyzeOutput {
  analysis: ComplaintAnalysis;
  source: "model" | "heuristic";
  ms: number;
}

export async function analyzeComplaint(input: AnalyzeInput): Promise<AnalyzeOutput> {
  const started = Date.now();
  const model = resolveModel();

  if (model) {
    try {
      const { object } = await generateObject({
        model,
        schema: analysisSchema,
        system: SYSTEM_PROMPT,
        prompt: buildPrompt(input),
        temperature: 0.2,
      });
      return {
        analysis: { ...object, formal_text: "" } as ComplaintAnalysis,
        source: "model",
        ms: Date.now() - started,
      };
    } catch (err) {
      // A hackathon demo must never die on a network error. Fall through.
      console.error("[awaaz] model call failed, using heuristic:", err);
    }
  }

  return {
    analysis: heuristicAnalysis(input),
    source: "heuristic",
    ms: Date.now() - started,
  };
}

function buildPrompt(input: AnalyzeInput): string {
  const parts = [`CITIZEN REPORT:\n"""${input.text.trim()}"""`];
  if (input.neighbourhood) {
    parts.push(
      `DEVICE LOCATION: ${input.neighbourhood}, Lahore. Use this only for context; the location_hint field must still come from the text itself.`,
    );
  }
  if (input.hasPhoto) {
    parts.push("The citizen attached a photograph of the issue.");
  }
  parts.push(OUTPUT_LANGUAGE[input.locale ?? "en"]);
  return parts.join("\n\n");
}

/* The report can arrive in any language. The OUTPUT language is whichever
   one the citizen chose in the interface — two separate concerns, and
   conflating them is how people end up reading a language they did not pick. */
const OUTPUT_LANGUAGE: Record<"en" | "ur" | "zh", string> = {
  en: "OUTPUT LANGUAGE: write title, summary and priority_reason in English.",
  ur: "OUTPUT LANGUAGE: write title, summary and priority_reason in Urdu, in Urdu script. Use no English words beyond unavoidable proper nouns.",
  zh: "OUTPUT LANGUAGE: write title, summary and priority_reason in Simplified Chinese. Use no English beyond unavoidable proper nouns.",
};

/* ============================================================
   HEURISTIC FALLBACK
   Runs when there is no API key, when the model errors, and in
   demo mode. Deliberately decent — it keeps the pitch alive if
   the venue wifi collapses mid-sentence.
   ============================================================ */

const HAZARD_CUES: Record<HazardFlag, string[]> = {
  children_at_risk: ["bach", "child", "kid", "school", "bachay", "bachon"],
  health_hazard: ["badbo", "smell", "disease", "bimar", "dengue", "makhi", "mosquito", "sick", "health"],
  traffic_danger: ["accident", "gir", "fall", "bike", "traffic", "crash", "gaari", "hadsa"],
  structural_risk: ["collapse", "crack", "gir raha", "building", "structure", "tilt"],
  fire_or_electrical_risk: ["spark", "wire", "current", "shock", "gas", "leak", "aag", "fire", "jala", "burn"],
  water_contamination: ["gandha pani", "dirty water", "contaminat", "sewage", "peene", "drinking"],
  elderly_or_disabled_affected: ["burzurg", "elderly", "old", "wheelchair", "disabled", "buzurg"],
  blocking_access: ["block", "band", "rasta", "closed", "access", "khara"],
  recurring_issue: ["phir se", "again", "dobara", "months", "mahin", "hafto", "weeks", "koi sunwai"],
  large_population_affected: ["poora", "whole", "entire", "block", "mohalla", "everyone", "sab"],
};

export function heuristicAnalysis(input: AnalyzeInput): ComplaintAnalysis {
  const text = input.text.trim();
  const lower = text.toLowerCase();

  // Category: best cue overlap, defaulting to `other`.
  let category: CategoryId = "other";
  let bestScore = 0;
  for (const cat of Object.values(CATEGORIES)) {
    const score = cat.cues.reduce((n, cue) => (lower.includes(cue) ? n + cue.length : n), 0);
    if (score > bestScore) {
      bestScore = score;
      category = cat.id;
    }
  }

  const hazards = (Object.keys(HAZARD_CUES) as HazardFlag[]).filter((h) =>
    HAZARD_CUES[h].some((cue) => lower.includes(cue)),
  );

  // Priority rises with the severity of the hazards present.
  const severe = hazards.some((h) =>
    ["fire_or_electrical_risk", "water_contamination", "children_at_risk"].includes(h),
  );
  const priority = severe && hazards.length >= 2
    ? "P1"
    : hazards.length >= 2
      ? "P2"
      : hazards.length === 1
        ? "P3"
        : "P4";

  const detected_language = detectLanguage(text);
  const label = CATEGORIES[category].label;

  return {
    title: `${label} reported${input.neighbourhood ? ` in ${input.neighbourhood}` : ""}`,
    summary:
      text.length > 30
        ? `A citizen reports an issue of ${label.toLowerCase()}${input.neighbourhood ? ` in ${input.neighbourhood}` : ""}. Reported verbatim: "${text.slice(0, 220)}${text.length > 220 ? "…" : ""}"`
        : `A short report of ${label.toLowerCase()} was received and requires field verification.`,
    category,
    priority,
    priority_reason: hazards.length
      ? `${PRIORITY_META[priority].label} priority: the report evidences ${hazards.length} risk signal${hazards.length > 1 ? "s" : ""}.`
      : `${PRIORITY_META[priority].label} priority: no elevated risk signals detected in the report.`,
    hazard_flags: hazards,
    detected_language,
    location_hint: input.neighbourhood ?? null,
    formal_text: "",
    confidence: bestScore > 0 ? Math.min(0.88, 0.45 + bestScore / 60) : 0.35,
    needs_clarification:
      text.length < 25 ? "Could you say where this is and how long it has been happening?" : null,
  };
}

function detectLanguage(text: string): Language {
  const hasArabicScript = /[؀-ۿ]/.test(text);
  const hasLatin = /[a-z]/i.test(text);
  if (hasArabicScript && hasLatin) return "mixed";
  if (hasArabicScript) return "ur";

  const romanUrduMarkers = [
    "hai", "nahi", "ka", "ki", "ke", "mein", "se", "par", "pe", "ho",
    "raha", "rahi", "kar", "bohat", "bhi", "wala", "koi", "sab",
  ];
  const words = text.toLowerCase().split(/\s+/);
  const hits = words.filter((w) => romanUrduMarkers.includes(w)).length;
  return hits >= 2 ? "ur-latn" : "en";
}
