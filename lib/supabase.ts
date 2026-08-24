import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in .env"
    );
  }

  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return client;
}

export function getStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || "products";
}

/** Ensure a public bucket exists for product images. */
export async function ensureProductsBucket() {
  const supabase = getSupabaseAdmin();
  const bucket = getStorageBucket();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  const exists = buckets?.some((b) => b.name === bucket);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    });
    if (error && !/already exists/i.test(error.message)) throw error;
  }

  return bucket;
}

export async function uploadProductImage(opts: {
  bytes: Buffer | ArrayBuffer | Blob;
  filename: string;
  contentType?: string;
}) {
  const supabase = getSupabaseAdmin();
  const bucket = await ensureProductsBucket();
  const path = `products/${opts.filename}`;

  const { error } = await supabase.storage.from(bucket).upload(path, opts.bytes, {
    contentType: opts.contentType || "image/jpeg",
    upsert: true,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
