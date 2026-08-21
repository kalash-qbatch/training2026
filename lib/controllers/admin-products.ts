import path from "path";

import { TABLE_INITIAL_PAGE, TABLE_PAGE_SIZE } from "@/lib/constants";
import { requireAdminUser } from "@/lib/controllers/http";
import { getProductError, productErrorStatus } from "@/lib/errors/products";
import {
  createProduct,
  createProductsBulk,
  deleteProduct,
  findAdminProducts,
  updateProduct,
} from "@/lib/services/products";
import { uploadProductImage } from "@/lib/supabase";
import { adminProductSchema } from "@/lib/validations/admin";

function productErrorResult(err: unknown) {
  const productErr = getProductError(err);
  if (!productErr) return null;
  return {
    status: productErrorStatus(productErr.code),
    body: { success: false, error: productErr.message },
  };
}

async function uploadImageFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }
  const ext = path.extname(file.name) || ".jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  return uploadProductImage({
    bytes,
    filename,
    contentType: file.type || "image/jpeg",
  });
}

async function parseProductRequest(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return request.json();
  }

  const form = await request.formData();
  const raw = form.get("payload");
  if (typeof raw !== "string") {
    throw new Error("Invalid product payload");
  }

  const payload = JSON.parse(raw) as Record<string, unknown>;
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const imageMeta = Array.isArray(payload.images) ? payload.images : [];
  const images: Array<{ url: string; color?: string }> = [];
  let fileIndex = 0;

  for (const img of imageMeta) {
    const meta = img as { url?: string; color?: string };
    if (meta.url) {
      images.push({ url: meta.url, color: meta.color });
      continue;
    }
    const file = files[fileIndex++];
    if (!file) throw new Error("Image file is required");
    images.push({
      url: await uploadImageFile(file),
      color: meta.color,
    });
  }

  return {
    ...payload,
    image: images[0]?.url,
    images,
  };
}

export async function listAdminProducts(request: Request) {
  const { error } = await requireAdminUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const result = await findAdminProducts({
    search: searchParams.get("search") ?? undefined,
    categoryId: searchParams.get("categoryId") ?? undefined,
    isActive: status === "active" ? true : status === "inactive" ? false : undefined,
    page: Number(searchParams.get("page") || TABLE_INITIAL_PAGE),
    pageSize: Number(searchParams.get("pageSize") || TABLE_PAGE_SIZE),
  });
  return { status: 200, body: { success: true, ...result } };
}

export async function createAdminProduct(request: Request) {
  const { error } = await requireAdminUser();
  if (error) return error;

  let body: unknown;
  try {
    body = await parseProductRequest(request);
  } catch (err) {
    return {
      status: 400,
      body: {
        success: false,
        error: err instanceof Error ? err.message : "Invalid product",
      },
    };
  }

  const parsed = adminProductSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid product",
      },
    };
  }

  try {
    const product = await createProduct({
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price,
      stock: parsed.data.stock,
      image: parsed.data.image,
      images: parsed.data.images,
      color: parsed.data.color,
      size: parsed.data.size,
      variants: parsed.data.variants,
      categoryId: parsed.data.categoryId,
      categoryName: parsed.data.categoryName,
      isActive: parsed.data.isActive,
    });

    return {
      status: 200,
      body: {
        success: true,
        product,
        message: "Product created successfully",
      },
    };
  } catch (err) {
    const mapped = productErrorResult(err);
    if (mapped) return mapped;
    throw err;
  }
}

export async function updateAdminProduct(id: string, request: Request) {
  const { error } = await requireAdminUser();
  if (error) return error;

  let body: unknown;
  try {
    body = await parseProductRequest(request);
  } catch (err) {
    return {
      status: 400,
      body: {
        success: false,
        error: err instanceof Error ? err.message : "Invalid product",
      },
    };
  }

  const parsed = adminProductSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid product",
      },
    };
  }

  try {
    const product = await updateProduct(id, {
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price,
      stock: parsed.data.stock,
      image: parsed.data.image,
      images: parsed.data.images,
      color: parsed.data.color,
      size: parsed.data.size,
      variants: parsed.data.variants,
      categoryId: parsed.data.categoryId,
      categoryName: parsed.data.categoryName,
      isActive: parsed.data.isActive,
    });

    return {
      status: 200,
      body: {
        success: true,
        product,
        message: "Product updated successfully",
      },
    };
  } catch (err) {
    const mapped = productErrorResult(err);
    if (mapped) return mapped;
    throw err;
  }
}

export async function deleteAdminProduct(id: string) {
  const { error } = await requireAdminUser();
  if (error) return error;

  try {
    const result = await deleteProduct(id);
    return {
      status: 200,
      body: {
        success: true,
        deactivated: result.deactivated,
        message: result.deactivated
          ? "Product set to Inactive because it appears in past orders"
          : "Product deleted successfully",
      },
    };
  } catch (err) {
    const mapped = productErrorResult(err);
    if (mapped) return mapped;
    throw err;
  }
}

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

export async function bulkCreateAdminProducts(request: Request) {
  const { error } = await requireAdminUser();
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
        return {
          status: 400,
          body: { success: false, error: "File is required" },
        };
      }
      const name = file.name.toLowerCase();
      if (!name.endsWith(".csv")) {
        return {
          status: 400,
          body: {
            success: false,
            error: "Only .csv is supported for bulk import right now",
          },
        };
      }
      rows = parseCsv(await file.text());
    } else {
      const body = await request.json();
      rows = Array.isArray(body?.products) ? body.products : [];
    }

    if (!rows.length) {
      return {
        status: 400,
        body: { success: false, error: "No products found in file" },
      };
    }

    const validated = [];
    for (const row of rows) {
      const parsed = adminProductSchema.safeParse(row);
      if (!parsed.success) {
        return {
          status: 400,
          body: {
            success: false,
            error: `Invalid row "${row.title || "unknown"}": ${
              parsed.error.issues[0]?.message ?? "invalid"
            }`,
          },
        };
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

    return {
      status: 200,
      body: {
        success: true,
        products,
        message: `${products.length} products uploaded successfully`,
      },
    };
  } catch (err) {
    const mapped = productErrorResult(err);
    if (mapped) return mapped;
    throw err;
  }
}
