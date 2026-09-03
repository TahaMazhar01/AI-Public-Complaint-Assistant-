/* ============================================================
   pnpm check:vision
   Confirms the configured provider can actually read an image.
   Generates its own test picture, so the check has no external
   dependency and works on a hostile venue network.
   ============================================================ */

import fs from "node:fs";
import zlib from "node:zlib";

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

/* ---- a minimal PNG encoder, so no image needs to be shipped ---- */
function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** A grey road surface with a dark irregular hole in it. Crude, but it is
    unmistakably "a dark patch on a road" and that is what we are testing. */
function makeTestPng(size = 224): Buffer {
  const rows: Buffer[] = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3); // filter byte + RGB
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2;
      const dy = (y - size / 2) * 1.4;
      const inHole = dx * dx + dy * dy < (size * 0.26) ** 2;
      const noise = ((x * 7 + y * 13) % 11) - 5;
      const v = inHole ? 22 + noise : 132 + noise;
      const i = 1 + x * 3;
      row[i] = v;
      row[i + 1] = v;
      row[i + 2] = v;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const key = process.env.DASHSCOPE_API_KEY?.trim();
const base = (
  process.env.DASHSCOPE_BASE_URL ??
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
).replace(/\/+$/, "");
const model = process.env.DASHSCOPE_VISION_MODEL ?? "qwen-vl-plus";

if (!key) {
  console.log("\n  DASHSCOPE_API_KEY is not set in .env.local\n");
  process.exit(1);
}

const png = makeTestPng();
const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
console.log(`\n  model     ${model}`);
console.log(`  endpoint  ${base}`);
console.log(`  test image ${png.length} bytes, 224x224 png\n`);

const started = Date.now();
const res = await fetch(`${base}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
  body: JSON.stringify({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl } },
          {
            type: "text",
            text: "Describe this image in one short sentence. What does the dark region look like?",
          },
        ],
      },
    ],
    max_tokens: 120,
  }),
});

const ms = Date.now() - started;
const body = await res.text();

if (!res.ok) {
  console.log(`  FAIL  HTTP ${res.status} in ${ms}ms`);
  console.log(`        ${body.slice(0, 400)}\n`);
  if (res.status === 400 || res.status === 404) {
    console.log("  The model name is probably wrong or not enabled on this account.");
    console.log("  Try DASHSCOPE_VISION_MODEL=qwen-vl-max or qwen-vl-plus.\n");
  }
  process.exit(1);
}

const json = JSON.parse(body);
console.log(`  ok    HTTP 200 in ${ms}ms`);
console.log(`  reply ${String(json.choices?.[0]?.message?.content ?? "").trim()}`);
console.log(`  usage ${JSON.stringify(json.usage ?? {})}\n`);
console.log("  Vision is reachable. Photo intake will use it.\n");
