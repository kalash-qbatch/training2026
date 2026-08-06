import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createProductsBulk } from "@/lib/services/products";
import { getProductError, productErrorStatus } from "@/lib/errors/products";
import { adminProductSchema } from "@/lib/validations/admin";

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const titleIdx = header.indexOf("title");
  const descIdx = header.indexOf("description");
  const priceIdx = header.indexOf("price");
  const stockIdx = header.indexOf("stock");
  const imageIdx = header.indexOf("image");

  if (titleIdx < 0 || priceIdx < 0 || stockIdx < 0) {
    throw new Error(
      "CSV must include title, price, and stock columns (optional: description, image)"
    );
  }

  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    return {
      title: cols[titleIdx] ?? "",
      description: descIdx >= 0 ? cols[descIdx] : undefined,
      price: Number(cols[priceIdx]),
      stock: Number(cols[stockIdx]),
      image: imageIdx >= 0 ? cols[imageIdx] : undefined,
    };
  });
}

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const contentType = request.headers.get("content-type") || "";
    let rows: Array<{
      title: string;
      description?: string;
      price: number;
      stock: number;
      image?: string;
    }> = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { success: false, error: "File is required" },
          { status: 400 }
        );
      }
      const name = file.name.toLowerCase();
      if (!name.endsWith(".csv")) {
        return NextResponse.json(
          {
            success: false,
            error: "Only .csv is supported for bulk import right now",
          },
          { status: 400 }
        );
      }
      rows = parseCsv(await file.text());
    } else {
      const body = await request.json();
      rows = Array.isArray(body?.products) ? body.products : [];
    }

    if (!rows.length) {
      return NextResponse.json(
        { success: false, error: "No products found in file" },
        { status: 400 }
      );
    }

    const validated = [];
    for (const row of rows) {
      const parsed = adminProductSchema.safeParse(row);
      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid row "${row.title || "unknown"}": ${
              parsed.error.issues[0]?.message ?? "invalid"
            }`,
          },
          { status: 400 }
        );
      }
      validated.push(parsed.data);
    }

    const products = await createProductsBulk(
      validated.map((v) => ({
        title: v.title,
        description: v.description,
        price: v.price,
        stock: v.stock,
        image: v.image,
      }))
    );

    return NextResponse.json({
      success: true,
      products,
      message: `${products.length} products uploaded successfully`,
    });
  } catch (err) {
    const productErr = getProductError(err);
    if (productErr) {
      return NextResponse.json(
        { success: false, error: productErr.message },
        { status: productErrorStatus(productErr.code) }
      );
    }
    console.error("admin products bulk:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Bulk upload failed",
      },
      { status: 500 }
    );
  }
}
