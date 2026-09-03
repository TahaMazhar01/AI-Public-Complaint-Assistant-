import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/* ============================================================
   PROVIDER RESOLUTION
   One switch. If the hackathon mandates Alibaba Model Studio,
   set AI_PROVIDER=qwen and nothing else in the codebase moves.
   Model Studio speaks the OpenAI wire format, so the generic
   openai-compatible adapter is all it needs.
   ============================================================ */

export type ProviderId = "qwen" | "google" | "anthropic" | "mock";

export function activeProvider(): ProviderId {
  const raw = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  if (raw === "qwen" || raw === "google" || raw === "anthropic") return raw;
  return "mock";
}

/** True when we can actually reach a model. Callers use this to
    decide between the live pipeline and the heuristic fallback. */
export function hasLiveModel(): boolean {
  switch (activeProvider()) {
    case "qwen":
      return Boolean(process.env.DASHSCOPE_API_KEY);
    case "google":
      return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    case "anthropic":
      return Boolean(process.env.ANTHROPIC_API_KEY);
    default:
      return false;
  }
}

export function resolveModel(): LanguageModel | null {
  if (!hasLiveModel()) return null;

  switch (activeProvider()) {
    case "qwen": {
      const dashscope = createOpenAICompatible({
        name: "dashscope",
        baseURL:
          process.env.DASHSCOPE_BASE_URL ??
          "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        apiKey: process.env.DASHSCOPE_API_KEY!,
      });
      return dashscope(process.env.DASHSCOPE_MODEL ?? "qwen-plus");
    }
    case "google":
      return google(process.env.GOOGLE_MODEL ?? "gemini-3.6-flash");
    case "anthropic":
      return anthropic(process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5");
    default:
      return null;
  }
}

/** Shown in the UI so the demo can prove which brain is running. */
export function providerLabel(): string {
  switch (activeProvider()) {
    case "qwen":
      return `Qwen · ${process.env.DASHSCOPE_MODEL ?? "qwen-plus"}`;
    case "google":
      return `Gemini · ${process.env.GOOGLE_MODEL ?? "gemini-3.6-flash"}`;
    case "anthropic":
      return `Claude · ${process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5"}`;
    default:
      return "On-device heuristic";
  }
}
