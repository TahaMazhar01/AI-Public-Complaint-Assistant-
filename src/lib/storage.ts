import { hasSupabase, serverClient } from "./supabase";

/* ============================================================
   PHOTO STORAGE
   Complaint photographs are evidence. An officer opening a case
   about a sparking transformer should see the transformer.

   Uploads are best effort: if the bucket is missing or the upload
   fails, the complaint is still filed with the vision description
   attached. Losing the picture is bad; refusing the complaint
   because of the picture is worse.
   ============================================================ */

export const PHOTO_BUCKET = "complaint-photos";

const MAX_BYTES = 4 * 1024 * 1024;

interface Decoded {
  bytes: Buffer;
  contentType: string;
  extension: string;
}

/** Accepts the data URLs the browser produced from a file input. */
function decodeDataUrl(dataUrl: string): Decoded | null {
  const m = dataUrl.match(/^data:(image\/(png|jpe?g|webp|gif));base64,(.+)$/i);
  if (!m) return null;

  const bytes = Buffer.from(m[3], "base64");
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return null;

  const subtype = m[2].toLowerCase();
  return {
    bytes,
    contentType: m[1].toLowerCase(),
    extension: subtype === "jpeg" ? "jpg" : subtype,
  };
}

export async function uploadPhotos(
  dataUrls: string[],
  trackingId: string,
): Promise<string[]> {
  if (!hasSupabase() || dataUrls.length === 0) return [];

  const db = serverClient();
  const urls: string[] = [];

  for (const [i, dataUrl] of dataUrls.slice(0, 3).entries()) {
    const decoded = decodeDataUrl(dataUrl);
    if (!decoded) continue;

    // Foldered by tracking id so a case's evidence stays together and is
    // trivially removable if a citizen ever asks for it to be.
    const path = `${trackingId}/${i + 1}.${decoded.extension}`;

    const { error } = await db.storage
      .from(PHOTO_BUCKET)
      .upload(path, decoded.bytes, {
        contentType: decoded.contentType,
        upsert: true,
      });

    if (error) {
      console.error("[awaaz] photo upload failed:", error.message);
      continue;
    }

    const { data } = db.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    if (data?.publicUrl) urls.push(data.publicUrl);
  }

  return urls;
}

/** Creates the bucket if it is missing. Called by `pnpm setup:storage`. */
export async function ensurePhotoBucket(): Promise<"created" | "exists"> {
  const db = serverClient();
  const { data: buckets } = await db.storage.listBuckets();

  if (buckets?.some((b) => b.name === PHOTO_BUCKET)) return "exists";

  const { error } = await db.storage.createBucket(PHOTO_BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  });
  if (error) throw new Error(`could not create bucket: ${error.message}`);
  return "created";
}
