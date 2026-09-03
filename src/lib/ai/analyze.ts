import { generateObject } from "ai";
import { z } from "zod";
import { CATEGORIES, CATEGORY_IDS, PRIORITY_META } from "../taxonomy";
import type { CategoryId, ComplaintAnalysis, HazardFlag, Language, Priority } from "../types";
import { resolveModel } from "./provider";

/* ============================================================
   THE ONE MODEL CALL
   Everything the system needs from the AI comes back in a single
   structured response. Department routing is deliberately absent —
   the model picks a category, taxonomy.ts picks the department.

   The schema sent to the model is LENIENT on purpose. Models that
   do not support strict JSON-schema output (Qwen among them) will
   drop optional fields and invent plausible enum values. Rejecting
   an otherwise excellent analysis because `confidence` was missing
   throws away the good with the bad, so the response is repaired
   in normalise() instead. The heuristic remains the last resort.
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

/** What we ask for. Everything optional — see normalise(). */
const looseSchema = z.object({
  title: z.string().optional(),
  summary: z.string().optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
  priority_reason: z.string().optional(),
  hazard_flags: z.array(z.string()).optional(),
  detected_language: z.string().optional(),
  location_hint: z.string().nullable().optional(),
  confidence: z.number().optional(),
  needs_clarification: z.string().nullable().optional(),
});

const SYSTEM_PROMPT = `You are the intake analyst for Awaaz, a public complaint system for Lahore, Pakistan.

Citizens describe civic problems informally — in English, Urdu script, Roman Urdu, or a mix. Your job is to turn one report into a structured, actionable case.

RULES
1. Never invent facts. If the citizen did not say how long, where, or who is affected, do not supply it. Vagueness is recorded, not filled in.
2. Preserve every concrete detail: durations ("three days"), counts ("two bikes"), and vulnerable groups ("children", "elderly").
3. Roman Urdu is normal input, not an error. "sarak", "pani", "kachra", "bijli", "gaddha", "andhera", "shor", "qabza" are ordinary words — read them.
4. Write the summary in a formal register suitable for a government file, even when the report is casual.

PRIORITY
P1 Critical — immediate risk to life, health or safety: exposed live wiring, gas leaks, open manholes, contaminated drinking water, animal bites, structural collapse risk, sewage where children play.
P2 High — serious disruption, or a hazard that will clearly worsen: accidents already occurring, outages affecting a whole block, health hazards during an outbreak season.
P3 Medium — a standard civic fault degrading daily life with no direct safety risk.
P4 Low — minor or cosmetic.

Escalate a level when the report evidences children, the elderly or disabled, a large affected population, or an issue already reported and ignored. Do not escalate on emotional language alone — escalate on facts.

REQUIRED FIELDS — every one of these must be present in your reply:
  title               short official case title
  summary             two or three sentences
  category            EXACTLY ONE of: ${CATEGORY_IDS.join(", ")}
  priority            exactly one of: P1, P2, P3, P4
  priority_reason     one sentence citing the evidence
  hazard_flags        array, using ONLY these values: ${HAZARDS.join(", ")}
  detected_language   exactly one of: en, ur, ur-latn, mixed
  location_hint       a place name from the text, or null
  confidence          a number between 0 and 1
  needs_clarification a short question if the report is too vague, else null

Use the exact category and hazard_flags values listed above. Do not invent new ones, do not translate them, and do not omit any field.

HAZARD FLAGS
Emit only flags the text genuinely supports. They are shown to the citizen as the justification for the priority, so an unsupported flag is a visible error.

OUTPUT
Reply with a single json object containing exactly those fields and nothing else.
(The word "json" is required here: Alibaba Model Studio rejects a request using
response_format json_object unless the messages mention it.)`;

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
        schema: looseSchema,
        system: SYSTEM_PROMPT,
        prompt: buildPrompt(input),
        temperature: 0.2,
      });
      return {
        analysis: normalise(object, input),
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

/* ------------------------------------------------------------
   REPAIR
   Takes whatever the model actually returned and produces a valid
   ComplaintAnalysis. Anything the model omitted is derived from
   the text rather than defaulted blindly, so a partial response
   still yields a usable case.
   ------------------------------------------------------------ */
function normalise(
  raw: z.infer<typeof looseSchema>,
  input: AnalyzeInput,
): ComplaintAnalysis {
  const fallback = heuristicAnalysis(input);

  const category = isCategory(raw.category) ? raw.category : fallback.category;

  const priority: Priority = ["P1", "P2", "P3", "P4"].includes(raw.priority ?? "")
    ? (raw.priority as Priority)
    : fallback.priority;

  const hazard_flags = Array.from(
    new Set(
      (raw.hazard_flags ?? [])
        .map(coerceHazard)
        .filter((h): h is HazardFlag => h !== null),
    ),
  );

  const detected_language = (["en", "ur", "ur-latn", "mixed"] as const).includes(
    raw.detected_language as Language,
  )
    ? (raw.detected_language as Language)
    : detectLanguage(input.text);

  return {
    title: raw.title?.trim() || fallback.title,
    summary: raw.summary?.trim() || fallback.summary,
    category,
    priority,
    priority_reason: raw.priority_reason?.trim() || fallback.priority_reason,
    // If the model named no recognised hazard but the text clearly shows one,
    // keep the detected flags — the priority justification depends on them.
    hazard_flags: hazard_flags.length ? hazard_flags : fallback.hazard_flags,
    detected_language,
    location_hint: raw.location_hint ?? input.neighbourhood ?? null,
    formal_text: "",
    confidence:
      typeof raw.confidence === "number" && raw.confidence >= 0 && raw.confidence <= 1
        ? raw.confidence
        : 0.88,
    needs_clarification: raw.needs_clarification ?? null,
  };
}

function isCategory(v: unknown): v is CategoryId {
  return typeof v === "string" && (CATEGORY_IDS as string[]).includes(v);
}

/** Models invent near-miss flag names — "child_exposure", "sewage_exposure",
    "contaminated_water". Map them onto the real vocabulary rather than
    discarding the model's judgement. */
function coerceHazard(value: string): HazardFlag | null {
  const v = value.toLowerCase().replace(/[\s-]+/g, "_");
  if ((HAZARDS as readonly string[]).includes(v)) return v as HazardFlag;

  const rules: [RegExp, HazardFlag][] = [
    [/child|kid|minor|school/, "children_at_risk"],
    [/elder|senior|disab|wheelchair/, "elderly_or_disabled_affected"],
    [/water.*contam|contam.*water|sewage|sewer|drink/, "water_contamination"],
    [/health|disease|sanit|hygien|epidem|mosquito|dengue|odou?r|smell/, "health_hazard"],
    [/traffic|road_safety|accident|collision|vehicle|pedestrian/, "traffic_danger"],
    [/fire|electric|shock|spark|gas_leak|burn/, "fire_or_electrical_risk"],
    [/structur|collapse|building_safety|crack/, "structural_risk"],
    [/block|obstruct|access|impass/, "blocking_access"],
    [/recur|repeat|ongoing|persist|ignored|unresolved|chronic/, "recurring_issue"],
    [/populat|community|widespread|large_scale|residents|neighbou?rhood/, "large_population_affected"],
    [/environment|pollut/, "health_hazard"],
  ];
  for (const [re, flag] of rules) if (re.test(v)) return flag;
  return null;
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
   conflating them is how people end up reading a language they did not pick.
   Field NAMES and enum VALUES always stay in English. */
const OUTPUT_LANGUAGE: Record<"en" | "ur" | "zh", string> = {
  en: "OUTPUT LANGUAGE: write title, summary and priority_reason in English. Field names and enum values stay exactly as specified.",
  ur: "OUTPUT LANGUAGE: write title, summary and priority_reason in Urdu, in Urdu script. Field names and enum values (category, priority, hazard_flags, detected_language) stay in English exactly as specified.",
  zh: "OUTPUT LANGUAGE: write title, summary and priority_reason in Simplified Chinese. Field names and enum values (category, priority, hazard_flags, detected_language) stay in English exactly as specified.",
};

/* ============================================================
   HEURISTIC FALLBACK
   Runs when there is no API key, when the model errors, and as the
   source of any field the model omitted. Deliberately decent — it
   keeps the pitch alive if the venue wifi collapses mid-sentence.
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
  const priority: Priority =
    severe && hazards.length >= 2
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
