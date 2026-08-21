import { NextResponse } from "next/server";

import { uploadAdminImage } from "@/lib/controllers/admin-upload";

export async function POST(request: Request) {
  try {
    const result = await uploadAdminImage(request);
    return NextResponse.json(result.body, { status: result.status });
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
