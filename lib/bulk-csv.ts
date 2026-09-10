import { normalizeColor, normalizeSize } from "@/lib/product-options";

export type BulkCsvVariant = {
  color: string;
  size: string;
  qty: number;
};

export type BulkCsvProduct = {
  title: string;
  description: string;
  price: number;
  stock: number;
  categoryName: string;
  variants: BulkCsvVariant[];
  /** Basename references from the CSV `image` column (for folder matching). */
  imageFileNames: string[];
};

function splitCsvLine(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cols.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols.map((c) => c.replace(/^"|"$/g, "").trim());
}

function basename(path: string): string {
  const cleaned = path.replace(/\\/g, "/").split("/").pop() ?? path;
  return cleaned.trim();
}

function parseImageList(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[|;]/)
    .map((s) => basename(s))
    .filter(Boolean);
}

/**
 * Parse bulk product CSV.
 * Rows with the same title are merged into one product with multiple variants/images.
 *
 * Supported columns:
 * title, price, category, color, size, qty, image[, description]
 * title, description, price, stock, category, color, size, image
 */
export function parseBulkProductsCsv(text: string): BulkCsvProduct[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV file must have a header row and at least one product row.");
  }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[\s_-]+/g, ""));
  const idx = (name: string) => header.indexOf(name.replace(/[\s_-]+/g, ""));

  const titleIdx = idx("title");
  const priceIdx = idx("price");
  if (titleIdx === -1 || priceIdx === -1) {
    throw new Error("CSV must contain at least 'title' and 'price' columns.");
  }

  const descIdx = idx("description");
  const catIdx =
    idx("category") >= 0
      ? idx("category")
      : idx("categoryname") >= 0
        ? idx("categoryname")
        : idx("category_name");
  const colorIdx = idx("color") >= 0 ? idx("color") : idx("colour");
  const sizeIdx = idx("size");
  const qtyIdx = idx("qty") >= 0 ? idx("qty") : idx("stock");
  const stockIdx = idx("stock");
  const imageIdx = idx("image") >= 0 ? idx("image") : idx("images");

  const byTitle = new Map<string, BulkCsvProduct>();

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const title = cols[titleIdx] || "";
    if (!title) continue;

    const price = Number(cols[priceIdx]);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Row ${i + 1} ("${title}") has an invalid price.`);
    }

    const color = normalizeColor(colorIdx >= 0 ? cols[colorIdx] || "" : "");
    const size = normalizeSize(sizeIdx >= 0 ? cols[sizeIdx] || "" : "");
    const qtyRaw = qtyIdx >= 0 ? cols[qtyIdx] : "";
    const qty = qtyRaw !== "" ? Math.max(0, Math.floor(Number(qtyRaw) || 0)) : 0;
    const images = imageIdx >= 0 ? parseImageList(cols[imageIdx] || "") : [];
    const categoryName = catIdx >= 0 ? (cols[catIdx] || "").trim() : "";
    const description = descIdx >= 0 ? cols[descIdx] || "" : "";

    const key = title.toLowerCase();
    let product = byTitle.get(key);
    if (!product) {
      product = {
        title,
        description,
        price,
        stock: 0,
        categoryName,
        variants: [],
        imageFileNames: [],
      };
      byTitle.set(key, product);
    } else {
      if (!product.description && description) product.description = description;
      if (!product.categoryName && categoryName) product.categoryName = categoryName;
      product.price = price;
    }

    if (color || size) {
      const existing = product.variants.find(
        (v) =>
          v.color.toLowerCase() === color.toLowerCase() &&
          v.size.toLowerCase() === size.toLowerCase()
      );
      if (existing) {
        existing.qty += qty;
      } else {
        product.variants.push({ color, size, qty });
      }
    } else if (stockIdx >= 0 && cols[stockIdx] !== undefined && cols[stockIdx] !== "") {
      product.stock += Math.max(0, Math.floor(Number(cols[stockIdx]) || 0));
    } else if (qty > 0) {
      product.stock += qty;
    }

    for (const name of images) {
      if (!product.imageFileNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
        product.imageFileNames.push(name);
      }
    }
  }

  const products = [...byTitle.values()];
  if (!products.length) {
    throw new Error("No valid products found in the uploaded file.");
  }

  for (const p of products) {
    if (p.variants.length) {
      p.stock = p.variants.reduce((sum, v) => sum + v.qty, 0);
    }
  }

  return products;
}

export function collectCsvImageFileNames(products: BulkCsvProduct[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const p of products) {
    for (const name of p.imageFileNames) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
  }
  return names;
}

export function matchImagesFromFolder(
  fileNames: string[],
  files: File[]
): { matched: Map<string, File>; matchedCount: number; folderImageCount: number } {
  const byName = new Map<string, File>();
  let folderImageCount = 0;
  for (const file of files) {
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|avif)$/i.test(file.name)) {
      continue;
    }
    folderImageCount += 1;
    byName.set(file.name.toLowerCase(), file);
  }

  const matched = new Map<string, File>();
  for (const name of fileNames) {
    const file = byName.get(name.toLowerCase());
    if (file) matched.set(name, file);
  }

  return { matched, matchedCount: matched.size, folderImageCount };
}

/** Match folder images to products by CSV filename, title, then distribute leftovers. */
export function matchProductImagesFromFolder(
  products: BulkCsvProduct[],
  files: File[]
): {
  byProductTitle: Map<string, File[]>;
  matchedCount: number;
  assignedCount: number;
  folderImageCount: number;
  csvImageCount: number;
} {
  const imageFiles = files.filter((file) => {
    const name = file.name || file.webkitRelativePath || "";
    return file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|avif|heic|bmp)$/i.test(name);
  });

  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9]+/g, "");

  const fileKey = (file: File) => {
    const raw = file.name || file.webkitRelativePath.split("/").pop() || "";
    return raw.toLowerCase();
  };

  const byName = new Map<string, File>();
  for (const file of imageFiles) {
    byName.set(fileKey(file), file);
    const base = fileKey(file).replace(/\.[^.]+$/, "");
    if (!byName.has(base)) byName.set(base, file);
  }

  const used = new Set<string>();
  const buckets = new Map<string, File[]>();
  for (const product of products) {
    buckets.set(product.title.toLowerCase(), []);
  }

  let matchedCount = 0;
  const csvNames = collectCsvImageFileNames(products);

  const pushUnique = (titleKey: string, file: File, countsAsMatch: boolean) => {
    const id = fileKey(file);
    if (used.has(id)) return false;
    used.add(id);
    const bucket = buckets.get(titleKey) ?? [];
    bucket.push(file);
    buckets.set(titleKey, bucket);
    if (countsAsMatch) matchedCount += 1;
    return true;
  };

  // 1) Exact / basename match from CSV image column
  for (const product of products) {
    const titleKey = product.title.toLowerCase();
    for (const name of product.imageFileNames) {
      const lower = name.toLowerCase();
      const file =
        byName.get(lower) ||
        byName.get(lower.replace(/\.[^.]+$/, "")) ||
        imageFiles.find((f) => fileKey(f).endsWith(lower));
      if (file) pushUnique(titleKey, file, true);
    }
  }

  // 2) Fuzzy match: filename contains product title tokens
  for (const product of products) {
    const titleKey = product.title.toLowerCase();
    const titleSlug = normalize(product.title);
    if (!titleSlug) continue;
    for (const file of imageFiles) {
      const id = fileKey(file);
      if (used.has(id)) continue;
      const base = normalize(id);
      if (!base) continue;
      if (
        base === titleSlug ||
        base.includes(titleSlug) ||
        titleSlug.includes(base) ||
        (titleSlug.length >= 4 && base.includes(titleSlug.slice(0, Math.min(8, titleSlug.length))))
      ) {
        pushUnique(titleKey, file, true);
      }
    }
  }

  // 3) Distribute remaining images round-robin so every selected file is kept
  const leftovers = imageFiles.filter((file) => !used.has(fileKey(file)));
  if (leftovers.length && products.length) {
    leftovers.forEach((file, index) => {
      const product = products[index % products.length];
      pushUnique(product.title.toLowerCase(), file, false);
    });
  }

  const byProductTitle = new Map<string, File[]>();
  let assignedCount = 0;
  for (const [key, list] of buckets) {
    if (!list.length) continue;
    byProductTitle.set(key, list);
    assignedCount += list.length;
  }

  return {
    byProductTitle,
    matchedCount,
    assignedCount,
    folderImageCount: imageFiles.length,
    csvImageCount: csvNames.length,
  };
}
