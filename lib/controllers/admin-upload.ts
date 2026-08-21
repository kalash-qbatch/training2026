import path from "path";

import { requireAdminUser } from "@/lib/controllers/http";
import { uploadProductImage } from "@/lib/supabase";

export async function uploadAdminImage(request: Request) {
  const { error } = await requireAdminUser();
  if (error) return error;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return {
      status: 400,
      body: { success: false, error: "Image file is required" },
    };
  }

  if (!file.type.startsWith("image/")) {
    return {
      status: 400,
      body: { success: false, error: "Only image files are allowed" },
    };
  }

  const ext = path.extname(file.name) || ".jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const url = await uploadProductImage({
    bytes,
    filename,
    contentType: file.type || "image/jpeg",
  });

  return {
    status: 200,
    body: {
      success: true,
      url,
      message: "Uploaded to Supabase Storage",
    },
  };
}
