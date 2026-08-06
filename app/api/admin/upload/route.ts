import path from "path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { uploadProductImage } from "@/lib/supabase";

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Image file is required" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "Only image files are allowed" },
        { status: 400 }
      );
    }

    const ext = path.extname(file.name) || ".jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const url = await uploadProductImage({
      bytes,
      filename,
      contentType: file.type || "image/jpeg",
    });

    return NextResponse.json({
      success: true,
      url,
      message: "Uploaded to Supabase Storage",
    });
  } catch (err) {
    console.error("admin upload:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Upload failed",
      },
      { status: 500 }
    );
  }
}
