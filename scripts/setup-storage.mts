/* pnpm setup:storage — creates the photo bucket if it is missing. */
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const { ensurePhotoBucket, PHOTO_BUCKET } = await import("../src/lib/storage.js");
const result = await ensurePhotoBucket();
console.log(`\n  bucket "${PHOTO_BUCKET}": ${result}\n`);
