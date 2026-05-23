import { supabase } from "@/integrations/supabase/client";

const BUCKET = "delivery-proofs";

function safeExt(file: File | Blob, fallback = "bin"): string {
  const name = "name" in file ? (file as File).name : "";
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (ext) return ext;
  const type = (file as any).type as string | undefined;
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return fallback;
}

function uid() {
  return (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 12);
}

/**
 * Upload a single file to the delivery-proofs bucket.
 * Path: {company_id}/{trip_id}/{kind}_{timestamp}_{uid}.{ext}
 * Returns the storage path (not a URL — use signed URL to display).
 */
export async function uploadDeliveryFile(
  companyId: string,
  tripId: string,
  file: File | Blob,
  kind: "photo" | "signature",
): Promise<string> {
  const ext = kind === "signature" ? "png" : safeExt(file, "jpg");
  const path = `${companyId}/${tripId}/${kind}_${Date.now()}_${uid()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: (file as any).type || (kind === "signature" ? "image/png" : "image/jpeg"),
  });
  if (error) throw error;
  return path;
}

/** Sign a delivery-proofs path for display (1h validity). */
export async function signDeliveryPath(path: string, expiresSec = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresSec);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Convert a data: URL (e.g., from a canvas) to a Blob. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:([^;]+);base64/.exec(meta)?.[1] ?? "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
