import { activeProvider } from "./provider";

/* ============================================================
   PHOTO EXAMINATION
   A separate, deliberately narrow call: look at the picture and
   say what is physically there. It does not classify, prioritise
   or decide anything. Its output is appended to the citizen's own
   words and the existing single analysis call reasons over both.

   Splitting it this way means the structured-output path stays
   exactly as tested, and a vision failure costs a sentence of
   context rather than the whole complaint.
   ============================================================ */

const VISION_PROMPT = `You are looking at a photograph attached to a civic complaint in Lahore, Pakistan.

Describe only what is physically visible, in two sentences at most. Name the object or defect, its apparent severity, and anything in frame that indicates danger to people: standing water, exposed wiring, debris, a missing cover, children, traffic.

Do not guess at causes. Do not recommend action. Do not mention that you are looking at a photograph. If the image is too dark, blurred or unrelated to a civic issue, say exactly that in one short sentence.

Never use dashes of any kind. Use commas or separate sentences.`;

export interface VisionResult {
  description: string;
  ms: number;
  model: string;
}

/** Returns null when vision is unavailable or fails, which the caller
    treats as "no photo context" rather than as an error. */
export async function describePhoto(
  dataUrl: string,
): Promise<VisionResult | null> {
  // Only Model Studio is wired for vision. Everything else falls through
  // silently: a complaint without photo context is still a good complaint.
  if (activeProvider() !== "qwen") return null;

  const key = process.env.DASHSCOPE_API_KEY?.trim();
  if (!key) return null;

  const base = (
    process.env.DASHSCOPE_BASE_URL ??
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
  ).replace(/\/+$/, "");
  const model = process.env.DASHSCOPE_VISION_MODEL ?? "qwen-vl-plus";

  const started = Date.now();
  try {
    const controller = new AbortController();
    // The pipeline has a budget. A slow photo call must not hold up filing.
    const timeout = setTimeout(() => controller.abort(), 20_000);

    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: dataUrl } },
              { type: "text", text: VISION_PROMPT },
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error("[awaaz] vision call failed:", res.status, await res.text());
      return null;
    }

    const json = await res.json();
    const description = String(
      json.choices?.[0]?.message?.content ?? "",
    ).trim();

    if (!description) return null;
    return { description, ms: Date.now() - started, model };
  } catch (err) {
    console.error("[awaaz] vision call errored:", err);
    return null;
  }
}
