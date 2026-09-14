import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/controllers/http";
import { buildBulkProductsTemplateBuffer } from "@/lib/services/bulk-template";

export async function GET() {
  try {
    const { error } = await requireAdminUser();
    if (error) {
      return NextResponse.json(error.body, { status: error.status });
    }

    const buffer = await buildBulkProductsTemplateBuffer();
    const filename = `products-template-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("admin bulk template GET:", err);
    return NextResponse.json(
      { success: false, error: "Failed to generate template" },
      { status: 500 }
    );
  }
}
