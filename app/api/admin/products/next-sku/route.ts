import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/controllers/http";
import { peekNextProductCode } from "@/lib/services/sku";
import {
  DEFAULT_COLOR_CODES,
  extractTitlePrefix,
  generateVariantSku,
  resolveColorCode,
} from "@/lib/sku";

export async function GET(request: Request) {
  const { error } = await requireAdminUser();
  if (error) return NextResponse.json(error.body, { status: error.status });

  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title")?.trim() || "";
  if (!title) {
    return NextResponse.json(
      { success: false, error: "title query param is required" },
      { status: 400 }
    );
  }

  const preview = await peekNextProductCode(title);
  const color = searchParams.get("color")?.trim() || "";
  const size = searchParams.get("size")?.trim() || "";

  let exampleSku: string | undefined;
  if (color || size) {
    const colorCode = resolveColorCode(
      color,
      Object.entries(DEFAULT_COLOR_CODES).map(([name, code]) => ({ name, code }))
    );
    exampleSku = generateVariantSku(preview.titlePrefix, preview.nextCode, size || "S", colorCode);
  }

  return NextResponse.json({
    success: true,
    titlePrefix: preview.titlePrefix,
    nextCode: preview.nextCode,
    baseSku: preview.baseSku,
    exampleSku,
    derivedPrefix: extractTitlePrefix(title),
  });
}
