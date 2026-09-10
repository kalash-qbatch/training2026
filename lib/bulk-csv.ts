import {
  assignFallbackStockToVariants,
  detectColorFromFileName,
  detectSizeFromFileName,
  ensureVariantsFromImageNames,
  normalizeColor,
  normalizeSize,
} from "@/lib/product-options";

export type BulkCsvVariant = {
  color: string;
  size: string;
  qty: number;
};

/** Image referenced on a CSV row, with that row's color/size/qty for binding. */
export type BulkCsvImageRef = {
  fileName: string;
  color: string;
  size: string;
  qty: number;
};

export type BulkCsvProduct = {
  /** Stable id from the first CSV row that created this product. */
  id: string;
  title: string;
  price: number;
  stock: number;
  categoryName: string;
  variants: BulkCsvVariant[];
  /** Basename references from the CSV `image` column (for folder matching). */
  imageFileNames: string[];
  /** Per-row image → color/size from the file (preferred over filename detection). */
  imageRefs: BulkCsvImageRef[];
};

function splitCsvLine(line: string, delimiter = ","): string[] {
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
    if (ch === delimiter && !inQuotes) {
      cols.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols.map((c) => c.replace(/^"|"$/g, "").trim());
}

function detectDelimiter(headerLine: string): string {
  let commas = 0;
  let semis = 0;
  let inQuotes = false;
  for (let i = 0; i < headerLine.length; i++) {
    const ch = headerLine[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === ",") commas += 1;
    if (ch === ";") semis += 1;
  }
  return semis > commas ? ";" : ",";
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

function headerKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/^\ufeff/, "")
    .replace(/[\s_-]+/g, "");
}

function findHeaderIndex(header: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const key = headerKey(alias);
    const exact = header.indexOf(key);
    if (exact >= 0) return exact;
  }
  // Soft match for longer aliases only (avoid "name" → "filename").
  for (const alias of aliases) {
    const key = headerKey(alias);
    if (key.length < 5) continue;
    const soft = header.findIndex((h) => h === key || h.endsWith(key) || h.startsWith(key));
    if (soft >= 0) return soft;
  }
  return -1;
}

function parseNumber(raw: string | undefined): number {
  if (raw === undefined || raw === "") return NaN;
  return Number(String(raw).replace(/[^0-9.-]/g, ""));
}

function cleanCell(raw: string | undefined): string {
  return (raw || "")
    .replace(/^\ufeff/, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/^="+|"+$/g, "")
    .trim();
}

/**
 * Parse bulk product CSV / Excel-exported CSV.
 * Blank title/price cells inherit the previous row (common Excel pattern).
 * Each data row keeps its own color, size, and qty — never even-split from images.
 */
export function parseBulkProductsCsv(text: string): BulkCsvProduct[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV file must have a header row and at least one product row.");
  }

  const delimiter = detectDelimiter(lines[0]);
  const header = splitCsvLine(lines[0], delimiter).map((h) => headerKey(h));
  const idx = (...aliases: string[]) => findHeaderIndex(header, aliases);

  const titleIdx = idx("title", "name", "product", "productname", "producttitle");
  const priceIdx = idx("price", "amount", "cost");
  if (titleIdx === -1 || priceIdx === -1) {
    throw new Error("CSV must contain at least 'title' (or 'name') and 'price' columns.");
  }

  const catIdx = idx("category", "categoryname", "category_name", "cat");
  const colorIdx = idx("color", "colour", "variantcolor", "productcolor", "productcolour");
  const sizeIdx = idx("size", "sizes", "variantsize", "productsize", "sz");
  const qtyIdx = idx("qty", "quantity", "qty.", "qnty");
  const stockIdx = idx("stock", "inventory", "totalqty", "totalquantity", "totalstock");
  const imageIdx = idx(
    "image",
    "images",
    "imagefile",
    "imagefilename",
    "filename",
    "file",
    "photo",
    "photos",
    "img"
  );

  const byTitle = new Map<string, BulkCsvProduct>();
  let lastTitle = "";
  let lastPrice = "";
  let lastCategory = "";

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);

    // Excel often leaves title/price blank on continuation variant rows.
    const rawTitle = cleanCell(cols[titleIdx]);
    const isContinuation = !rawTitle;
    const title = rawTitle || lastTitle;
    if (!title) continue;
    lastTitle = title;

    let priceRaw = cleanCell(cols[priceIdx]);
    if (!priceRaw) priceRaw = lastPrice;
    const price = parseNumber(priceRaw);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Row ${i + 1} ("${title}") has an invalid price.`);
    }
    lastPrice = priceRaw;

    const images = imageIdx >= 0 ? parseImageList(cols[imageIdx] || "") : [];
    let color = normalizeColor(colorIdx >= 0 ? cleanCell(cols[colorIdx]) : "");
    let size = normalizeSize(sizeIdx >= 0 ? cleanCell(cols[sizeIdx]) : "");

    // Infer missing color/size from the row's image filename when the sheet left them blank.
    if (images.length) {
      if (!color) color = normalizeColor(detectColorFromFileName(images[0]));
      if (!size) size = normalizeSize(detectSizeFromFileName(images[0]));
    }

    let qty = 0;
    if (qtyIdx >= 0 && cleanCell(cols[qtyIdx]) !== "") {
      qty = Math.max(0, Math.floor(parseNumber(cols[qtyIdx]) || 0));
    } else if ((color || size) && stockIdx >= 0 && cleanCell(cols[stockIdx]) !== "") {
      qty = Math.max(0, Math.floor(parseNumber(cols[stockIdx]) || 0));
    }

    let categoryName = catIdx >= 0 ? cleanCell(cols[catIdx]) : "";
    // Only inherit category on blank-title continuation rows — never leak onto the next product.
    if (!categoryName && isContinuation) categoryName = lastCategory;
    if (categoryName) lastCategory = categoryName;
    else if (!isContinuation) lastCategory = "";

    const key = title.toLowerCase();
    let product = byTitle.get(key);
    if (!product) {
      product = {
        id: `csv-${i}`,
        title,
        price,
        stock: 0,
        categoryName,
        variants: [],
        imageFileNames: [],
        imageRefs: [],
      };
      byTitle.set(key, product);
    } else {
      if (!product.categoryName && categoryName) product.categoryName = categoryName;
      product.price = price;
    }

    // Every row with color, size, or qty is a variant row — never dump qty into product.stock only.
    if (color || size || qty > 0) {
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
    } else if (stockIdx >= 0 && cleanCell(cols[stockIdx]) !== "") {
      product.stock += Math.max(0, Math.floor(parseNumber(cols[stockIdx]) || 0));
    }

    for (const name of images) {
      if (!product.imageFileNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
        product.imageFileNames.push(name);
      }
      if (!product.imageRefs.some((r) => r.fileName.toLowerCase() === name.toLowerCase())) {
        product.imageRefs.push({ fileName: name, color, size, qty });
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

/**
 * Resolve final variants for the bulk editor.
 * File color/size/qty rows always win — never invent even-split stock from image colors.
 */
export function resolveBulkVariants(
  product: BulkCsvProduct,
  attachedFileNames: string[] = []
): BulkCsvVariant[] {
  let variants = product.variants.map((v) => ({
    color: normalizeColor(v.color),
    size: normalizeSize(v.size),
    qty: v.qty,
  }));

  if (!variants.length && product.imageRefs.some((r) => r.color || r.size || r.qty > 0)) {
    const byKey = new Map<string, BulkCsvVariant>();
    for (const ref of product.imageRefs) {
      const color =
        normalizeColor(ref.color) || normalizeColor(detectColorFromFileName(ref.fileName));
      const size = normalizeSize(ref.size) || normalizeSize(detectSizeFromFileName(ref.fileName));
      if (!color && !size && ref.qty <= 0) continue;
      const key = `${color.toLowerCase()}::${size.toLowerCase()}`;
      const existing = byKey.get(key);
      if (existing) existing.qty += ref.qty;
      else byKey.set(key, { color, size, qty: ref.qty });
    }
    variants = [...byKey.values()];
  }

  for (const ref of product.imageRefs) {
    const refSize = normalizeSize(ref.size);
    const refColor = normalizeColor(ref.color);
    if (!refSize || !refColor) continue;
    const target = variants.find(
      (v) => v.color.toLowerCase() === refColor.toLowerCase() && !normalizeSize(v.size)
    );
    if (target) target.size = refSize;
  }

  const hasFileVariants = variants.some((v) => v.color || v.size || v.qty > 0);
  if (hasFileVariants) return variants;

  const fileNames = [...product.imageFileNames, ...attachedFileNames].filter(Boolean);
  variants = ensureVariantsFromImageNames([], fileNames);
  if (!variants.length && product.stock > 0) {
    return [{ color: "", size: "", qty: product.stock }];
  }
  return assignFallbackStockToVariants(variants, product.stock);
}

/** Convert an Excel workbook (xlsx/xls) ArrayBuffer into CSV text for parsing. */
export function workbookToCsvText(data: ArrayBuffer): string {
  // Lazy require keeps the CSV path free of the xlsx bundle when unused.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx") as typeof import("xlsx");
  const workbook = XLSX.read(data, { type: "array", cellDates: false, raw: false });
  if (!workbook.SheetNames.length) {
    throw new Error("Excel file has no sheets.");
  }

  // Prefer the sheet whose first row looks like a product header (title + price).
  let sheetName = workbook.SheetNames[0];
  for (const name of workbook.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name], { FS: ",", RS: "\n" });
    const headerLine = csv.split(/\r?\n/).find((l: string) => l.trim());
    if (!headerLine) continue;
    const headers = splitCsvLine(headerLine, detectDelimiter(headerLine)).map((h) => headerKey(h));
    const hasTitle = findHeaderIndex(headers, ["title", "name", "product", "productname"]) >= 0;
    const hasPrice = findHeaderIndex(headers, ["price", "amount", "cost"]) >= 0;
    if (hasTitle && hasPrice) {
      sheetName = name;
      break;
    }
  }

  return XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { FS: ",", RS: "\n" });
}

/** Parse CSV text or Excel workbook bytes into bulk products. */
export function parseBulkProductsFile(
  input: string | ArrayBuffer,
  fileName: string
): BulkCsvProduct[] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    if (typeof input === "string") {
      throw new Error("Excel files must be read as binary data.");
    }
    return parseBulkProductsCsv(workbookToCsvText(input));
  }
  const text = typeof input === "string" ? input : new TextDecoder("utf-8").decode(input);
  return parseBulkProductsCsv(text);
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

function fileBaseName(file: File): string {
  return file.name || file.webkitRelativePath.split("/").pop() || "";
}

function fileKey(file: File): string {
  return fileBaseName(file).toLowerCase();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "");
}

/** True when `fileName` was explicitly listed on this product's CSV image column. */
export function isImageMappedToProduct(
  product: Pick<BulkCsvProduct, "id" | "title" | "imageFileNames">,
  fileName: string
): boolean {
  const target = basename(fileName).toLowerCase();
  const targetNoExt = target.replace(/\.[^.]+$/, "");
  return product.imageFileNames.some((listed) => {
    const lower = listed.toLowerCase();
    const noExt = lower.replace(/\.[^.]+$/, "");
    return lower === target || noExt === targetNoExt || target.endsWith(lower);
  });
}

/**
 * Guard for accidental cross-product attachment.
 * - If the CSV listed image filenames for this product, only those are allowed.
 * - If the CSV left the image column empty, folder matches (title/color) are allowed.
 */
export function assertImageBelongsToProduct(
  product: Pick<BulkCsvProduct, "id" | "title" | "imageFileNames">,
  fileName: string
): void {
  if (!product.imageFileNames.length) return;
  if (isImageMappedToProduct(product, fileName)) return;
  const message = `[bulk-csv] Refusing to attach image "${fileName}" to product "${product.title}" (${product.id}) — not listed in CSV image column: [${product.imageFileNames.join(", ")}]`;
  if (process.env.NODE_ENV !== "production") {
    throw new Error(message);
  }
  console.warn(message);
}

function pushImageToProduct(
  product: BulkCsvProduct,
  file: File,
  byProductId: Map<string, File[]>,
  byProductTitle: Map<string, File[]>,
  used: Set<string>
): boolean {
  const id = fileKey(file);
  if (used.has(id)) return false;
  used.add(id);
  byProductId.get(product.id)!.push(file);
  const titleBucket = byProductTitle.get(product.title.toLowerCase()) ?? [];
  titleBucket.push(file);
  byProductTitle.set(product.title.toLowerCase(), titleBucket);
  return true;
}

/**
 * Score how well a folder file maps to a product when the CSV image column is empty
 * or the exact filename was not found. Higher = better. 0 = no match.
 * Ambiguous files (score on multiple products) are left unmatched — never round-robin.
 */
function scoreFileForProduct(product: BulkCsvProduct, file: File): number {
  const name = fileBaseName(file);
  const base = slugify(name);
  if (!base) return 0;

  let score = 0;
  const titleSlug = slugify(product.title);
  if (titleSlug.length >= 4) {
    if (base === titleSlug) score += 100;
    else if (base.includes(titleSlug) || titleSlug.includes(base)) score += 60;
    else {
      const tokens = product.title
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 4);
      for (const token of tokens) {
        if (base.includes(token)) {
          score += 25;
          break;
        }
      }
    }
  }

  const fileColor = normalizeColor(detectColorFromFileName(name));
  if (fileColor) {
    const colorHit = product.variants.some(
      (v) => v.color && v.color.toLowerCase() === fileColor.toLowerCase()
    );
    if (colorHit) score += 40;
  }

  return score;
}

/**
 * Match folder images to products:
 * 1) Exact CSV `image` filenames (preferred, no cross-product leak)
 * 2) Unique title/color fallback when CSV image column is empty or names differ
 * Never round-robins leftovers onto other products.
 */
export function matchProductImagesFromFolder(
  products: BulkCsvProduct[],
  files: File[]
): {
  byProductId: Map<string, File[]>;
  /** @deprecated Prefer byProductId — kept for callers that still key by title. */
  byProductTitle: Map<string, File[]>;
  matchedCount: number;
  assignedCount: number;
  folderImageCount: number;
  csvImageCount: number;
  unmatchedFolderFiles: string[];
} {
  const imageFiles = files.filter((file) => {
    const name = file.name || file.webkitRelativePath || "";
    return file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|avif|heic|bmp)$/i.test(name);
  });

  const byName = new Map<string, File>();
  for (const file of imageFiles) {
    byName.set(fileKey(file), file);
    const base = fileKey(file).replace(/\.[^.]+$/, "");
    if (!byName.has(base)) byName.set(base, file);
  }

  const used = new Set<string>();
  const byProductId = new Map<string, File[]>();
  const byProductTitle = new Map<string, File[]>();
  for (const product of products) {
    byProductId.set(product.id, []);
    byProductTitle.set(product.title.toLowerCase(), []);
  }

  let matchedCount = 0;
  const csvNames = collectCsvImageFileNames(products);

  for (const product of products) {
    for (const name of product.imageFileNames) {
      const lower = name.toLowerCase();
      const file =
        byName.get(lower) ||
        byName.get(lower.replace(/\.[^.]+$/, "")) ||
        imageFiles.find((f) => {
          const key = fileKey(f);
          return key === lower || key.endsWith(`/${lower}`) || key.endsWith(lower);
        });

      if (!file) continue;
      if (!isImageMappedToProduct(product, fileBaseName(file))) continue;
      if (pushImageToProduct(product, file, byProductId, byProductTitle, used)) {
        matchedCount += 1;
      }
    }
  }

  for (const file of imageFiles) {
    if (used.has(fileKey(file))) continue;

    const scored = products
      .map((product) => ({ product, score: scoreFileForProduct(product, file) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) continue;
    if (scored.length > 1 && scored[0].score === scored[1].score) continue;
    const winner = scored[0].product;
    if (pushImageToProduct(winner, file, byProductId, byProductTitle, used)) {
      matchedCount += 1;
    }
  }

  const unmatchedFolderFiles = imageFiles
    .filter((file) => !used.has(fileKey(file)))
    .map((file) => fileBaseName(file));

  let assignedCount = 0;
  for (const list of byProductId.values()) {
    assignedCount += list.length;
  }

  return {
    byProductId,
    byProductTitle,
    matchedCount,
    assignedCount,
    folderImageCount: imageFiles.length,
    csvImageCount: csvNames.length,
    unmatchedFolderFiles,
  };
}
