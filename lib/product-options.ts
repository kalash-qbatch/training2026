export const PRODUCT_COLOR_OPTIONS = [
  "Black",
  "Blue",
  "Red",
  "Green",
  "White",
  "Brown",
  "Beige",
  "Gray",
  "Gray/Silver",
  "Pink",
  "Purple",
  "Orange",
  "Gold",
  "Silver",
  "Bronze",
  "Copper",
  "Brass",
  "Steel",
  "Iron",
  "Yellow",
] as const;

export const PRODUCT_SIZE_OPTIONS = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "Fixed",
  "One Size",
  "Free Size",
] as const;

const COLOR_ALIASES: Record<string, string> = {
  grey: "Gray",
  gray: "Gray",
  "gray silver": "Gray/Silver",
  graysilver: "Gray/Silver",
  "grey silver": "Gray/Silver",
  greysilver: "Gray/Silver",
  navy: "Blue",
  "navy blue": "Blue",
  skyblue: "Blue",
  "light blue": "Blue",
  darkblue: "Blue",
  maroon: "Red",
  crimson: "Red",
  charcoal: "Black",
  offwhite: "White",
  cream: "Beige",
  khaki: "Beige",
  rose: "Pink",
  violet: "Purple",
};

function compact(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Map free-text color to a canonical Select option value. */
export function normalizeColor(raw: string | undefined | null): string {
  const value = (raw || "").trim();
  if (!value) return "";

  const exact = PRODUCT_COLOR_OPTIONS.find((c) => c.toLowerCase() === value.toLowerCase());
  if (exact) return exact;

  const alias = COLOR_ALIASES[value.toLowerCase()] || COLOR_ALIASES[compact(value)];
  if (alias) return alias;

  const compactValue = compact(value);
  const fromOptions = PRODUCT_COLOR_OPTIONS.find((c) => compact(c) === compactValue);
  if (fromOptions) return fromOptions;

  // Title-case unknown colors so they still appear selected in the dropdown.
  return value
    .split(/[\s/_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("/");
}

/** Map free-text size to a canonical Select option value. */
export function normalizeSize(raw: string | undefined | null): string {
  const value = (raw || "").trim();
  if (!value) return "";

  const exact = PRODUCT_SIZE_OPTIONS.find((s) => s.toLowerCase() === value.toLowerCase());
  if (exact) return exact;

  const aliases: Record<string, string> = {
    "x-small": "XS",
    xsmall: "XS",
    small: "S",
    medium: "M",
    large: "L",
    "x-large": "XL",
    xlarge: "XL",
    "xx-large": "XXL",
    xxlarge: "XXL",
    onesize: "One Size",
    "one-size": "One Size",
    freesize: "Free Size",
    "free-size": "Free Size",
    free: "Free Size",
  };
  const alias = aliases[value.toLowerCase()] || aliases[compact(value)];
  if (alias) return alias;

  return value;
}

/** Detect a color name inside a filename (e.g. denim-blue.jpg → Blue). */
export function detectColorFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").toLowerCase();
  const tokens = base.split(/[^a-z0-9]+/).filter(Boolean);

  // Prefer longer option names first (Gray/Silver before Gray/Silver parts)
  const sorted = [...PRODUCT_COLOR_OPTIONS].sort((a, b) => b.length - a.length);
  for (const color of sorted) {
    const parts = color
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    if (parts.length > 1) {
      if (parts.every((p) => tokens.includes(p) || base.includes(p))) {
        return color;
      }
    } else if (tokens.includes(color.toLowerCase()) || tokens.includes(compact(color))) {
      return color;
    }
  }

  for (const [alias, canonical] of Object.entries(COLOR_ALIASES)) {
    if (tokens.includes(compact(alias)) || tokens.includes(alias.replace(/\s+/g, ""))) {
      return canonical;
    }
  }

  return "";
}

/** Detect a size token inside a filename (e.g. jacket-blue-xl.jpg → XL). */
export function detectSizeFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").toLowerCase();
  const tokens = base.split(/[^a-z0-9]+/).filter(Boolean);
  if (!tokens.length) return "";

  const sorted = [...PRODUCT_SIZE_OPTIONS].sort((a, b) => b.length - a.length);
  for (const size of sorted) {
    const parts = size
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    if (parts.length > 1) {
      if (parts.every((p) => tokens.includes(p))) return size;
    } else if (tokens.includes(size.toLowerCase()) || tokens.includes(compact(size))) {
      return size;
    }
  }

  const aliases: Record<string, string> = {
    xsmall: "XS",
    xsm: "XS",
    small: "S",
    medium: "M",
    large: "L",
    xlarge: "XL",
    xxlarge: "XXL",
    onesize: "One Size",
    freesize: "Free Size",
  };
  for (const token of tokens) {
    if (aliases[token]) return aliases[token];
  }

  return "";
}

type VariantLike = { color: string; size: string; qty: number };

/**
 * Ensure product variants exist for colors/sizes from CSV and/or image filenames.
 * - Never overwrites an existing CSV variant's qty.
 * - Only appends missing color/size combinations detected in filenames.
 */
export function ensureVariantsFromImageNames(
  variants: VariantLike[],
  fileNames: string[]
): VariantLike[] {
  const next = variants.map((v) => ({
    color: normalizeColor(v.color),
    size: normalizeSize(v.size),
    qty: v.qty,
  }));

  for (const name of fileNames) {
    const color = normalizeColor(detectColorFromFileName(name));
    const size = normalizeSize(detectSizeFromFileName(name));
    if (!color && !size) continue;

    if (color && size) {
      const exists = next.some(
        (v) =>
          v.color.toLowerCase() === color.toLowerCase() &&
          v.size.toLowerCase() === size.toLowerCase()
      );
      if (!exists) next.push({ color, size, qty: 0 });
      continue;
    }

    if (color) {
      const exists = next.some((v) => v.color.toLowerCase() === color.toLowerCase());
      if (!exists) next.push({ color, size: "", qty: 0 });
      continue;
    }

    const exists = next.some((v) => !v.color && v.size.toLowerCase() === size.toLowerCase());
    if (!exists) next.push({ color: "", size, qty: 0 });
  }

  return next;
}

/**
 * When variants exist but all qtys are 0 and the product has product-level stock:
 * - 1 variant → gets full stock
 * - N variants → leave qtys untouched (never even-split; that hides real file rows)
 * If any variant already has qty > 0, leave all qtys untouched.
 */
export function assignFallbackStockToVariants(
  variants: VariantLike[],
  fallbackStock: number
): VariantLike[] {
  if (!variants.length || fallbackStock <= 0) return variants;
  const hasQty = variants.some((v) => v.qty > 0);
  if (hasQty) return variants;

  if (variants.length === 1) {
    return [{ ...variants[0], qty: fallbackStock }];
  }

  // Do not invent per-color quantities — file rows must supply them.
  return variants;
}

/** Resolve a CSV/free-text size onto a Select option value (case-insensitive). */
export function selectSizeValue(raw: string, options: readonly string[]): string {
  const normalized = normalizeSize(raw);
  if (!normalized) return "";
  const match = options.find((o) => o.toLowerCase() === normalized.toLowerCase());
  return match || normalized;
}

export function resolveCategoryName(
  raw: string | undefined | null,
  categories: Array<{ id: string; name: string }>
): { categoryId: string; categoryName: string } | null {
  const value = (raw || "").trim();
  if (!value || !categories.length) return null;

  const lower = value.toLowerCase();
  const exact = categories.find((c) => c.name.toLowerCase() === lower);
  if (exact) return { categoryId: exact.id, categoryName: exact.name };

  const compactValue = compact(value);
  const byCompact = categories.find((c) => compact(c.name) === compactValue);
  if (byCompact) return { categoryId: byCompact.id, categoryName: byCompact.name };

  // No match against current categories — do not invent / keep unmatched names.
  return null;
}
