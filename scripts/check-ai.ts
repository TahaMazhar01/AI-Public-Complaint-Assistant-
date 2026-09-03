/* ============================================================
   pnpm check:ai
   Asks the configured provider one real question and reports what
   came back. Isolates "the key is wrong" from "the pipeline is
   wrong", which are very different problems at 2am.
   ============================================================ */

import fs from "node:fs";
import path from "node:path";

function loadEnv(file: string) {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
}
loadEnv(".env.local");

const provider = (process.env.AI_PROVIDER ?? "mock").toLowerCase();

async function main() {
  console.log(`\nProvider: ${provider}\n`);

  if (provider === "mock") {
    console.log("  AI_PROVIDER=mock — the on-device heuristic is in use by design.");
    console.log("  Set AI_PROVIDER to qwen / google / anthropic to use a model.\n");
    return;
  }

  if (provider === "qwen") return checkQwen();
  if (provider === "google") return checkGoogle();
  if (provider === "anthropic") return checkAnthropic();
  console.log(`  Unknown AI_PROVIDER "${provider}".\n`);
}

/* Alibaba Model Studio speaks the OpenAI wire format. */
async function checkQwen() {
  const key = process.env.DASHSCOPE_API_KEY?.trim();
  const base = (
    process.env.DASHSCOPE_BASE_URL ??
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
  ).replace(/\/+$/, "");
  const model = process.env.DASHSCOPE_MODEL ?? "qwen-plus";

  if (!key) return fail("DASHSCOPE_API_KEY is not set in .env.local");

  console.log(`  endpoint  ${base}`);
  console.log(`  model     ${model}\n`);

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content:
              'Reply with only this JSON and nothing else: {"ok":true,"lang":"<the language of this sentence>"}',
          },
        ],
        temperature: 0,
        max_tokens: 64,
      }),
    });
  } catch (e) {
    return fail(`network error — ${e instanceof Error ? e.message : e}`);
  }

  const ms = Date.now() - started;
  const body = await res.text();

  if (!res.ok) {
    console.log(`  FAIL  HTTP ${res.status} after ${ms}ms`);
    console.log(`        ${body.slice(0, 400)}\n`);
    hint(res.status, base);
    process.exit(1);
  }

  const json = JSON.parse(body);
  const reply = json.choices?.[0]?.message?.content ?? "(no content)";
  console.log(`  ok    HTTP 200 in ${ms}ms`);
  console.log(`  reply ${String(reply).trim().slice(0, 160)}`);
  console.log(`  usage ${JSON.stringify(json.usage ?? {})}\n`);
  console.log("  Qwen is reachable. The intake pipeline will use it.\n");
}

async function checkGoogle() {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  const model = process.env.GOOGLE_MODEL ?? "gemini-3.6-flash";
  if (!key) return fail("GOOGLE_GENERATIVE_AI_API_KEY is not set");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Reply with OK." }] }] }),
    },
  );
  const body = await res.text();
  if (!res.ok) {
    console.log(`  FAIL  HTTP ${res.status}`);
    console.log(`        ${body.slice(0, 300)}\n`);
    process.exit(1);
  }
  console.log(`  ok    ${model} reachable\n`);
}

async function checkAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return fail("ANTHROPIC_API_KEY is not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with OK." }],
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.log(`  FAIL  HTTP ${res.status}`);
    console.log(`        ${body.slice(0, 300)}\n`);
    process.exit(1);
  }
  console.log("  ok    Claude reachable\n");
}

function fail(msg: string): never {
  console.log(`  FAIL  ${msg}\n`);
  process.exit(1);
}

function hint(status: number, base: string) {
  if (status === 401 || status === 403) {
    console.log("  The key was rejected. Check that:");
    console.log("   - it was copied whole, with no trailing spaces or newline");
    console.log("   - it belongs to the same region as the endpoint below");
    console.log(`     current endpoint: ${base}`);
    console.log("     international:    https://dashscope-intl.aliyuncs.com/compatible-mode/v1");
    console.log("     mainland China:   https://dashscope.aliyuncs.com/compatible-mode/v1");
    console.log("   - Model Studio is activated for that Alibaba Cloud account\n");
  } else if (status === 404) {
    console.log("  Endpoint or model name not found. Check DASHSCOPE_MODEL");
    console.log("  (qwen-plus, qwen-max, qwen-turbo) and DASHSCOPE_BASE_URL.\n");
  } else if (status === 429) {
    console.log("  Rate limited or out of quota for this account.\n");
  }
}

main().catch((e) => {
  console.error("\nCheck failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
