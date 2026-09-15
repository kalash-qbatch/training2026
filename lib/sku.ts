/** SKU format: {TITLE}-{CODE}-{SIZE}-{COLOR} e.g. SHIR-001-S-BLK */

/** Canonical Color rows to seed — one unique `code` each (DB unique constraint). */
export const CATALOG_COLORS: Array<{ name: string; code: string }> = [
  { name: "Black", code: "BLK" },
  { name: "White", code: "WHT" },
  { name: "Navy", code: "NVY" },
  { name: "Olive", code: "OLV" },
  { name: "Beige", code: "BGE" },
  { name: "Green", code: "GRN" },
  { name: "Blue", code: "BLU" },
  { name: "Yellow", code: "YLW" },
  { name: "Pink", code: "PNK" },
  { name: "Cyan", code: "CYN" },
  { name: "Orange", code: "ORG" },
  { name: "Brown", code: "BRN" },
  { name: "Gray", code: "GRY" },
  { name: "Red", code: "RED" },
  { name: "Purple", code: "PPL" },
  { name: "Gold", code: "GLD" },
  { name: "Silver", code: "SLV" },
  { name: "Bronze", code: "BRZ" },
  { name: "Copper", code: "CPR" },
  { name: "Brass", code: "BRS" },
  { name: "Steel", code: "STL" },
  { name: "Iron", code: "IRN" },
  { name: "Multicolor", code: "MLT" },
];

/** Lookup map including aliases that share a catalog code (not seeded as separate rows). */
export const DEFAULT_COLOR_CODES: Record<string, string> = {
  ...Object.fromEntries(CATALOG_COLORS.map((c) => [c.name, c.code])),
  Grey: "GRY",
  "Gray/Silver": "GRY",
  gray: "GRY",
  grey: "GRY",
};

export const DEFAULT_SIZE_NAMES = [
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

export type ParsedSku = {
  titlePrefix: string;
  code: string;
  size: string;
  color: string;
};

/** First word → strip non-alphanumeric → uppercase → up to 4 chars; pad with `_` if shorter. */
export function extractTitlePrefix(title: string): string {
  const firstWord = (title.trim().split(/\s+/)[0] || "ITEM").replace(/[^a-zA-Z0-9]/g, "");
  const upper = firstWord.toUpperCase() || "ITEM";
  if (upper.length >= 4) return upper.slice(0, 4);
  return upper.padEnd(4, "_");
}

export function formatProductCode(n: number): string {
  return String(Math.max(1, Math.floor(n))).padStart(3, "0");
}

export function generateVariantSku(
  titlePrefix: string,
  productCode: string,
  sizeName: string,
  colorCode: string
): string {
  const size = (sizeName || "NA").trim().replace(/\s+/g, "") || "NA";
  const color = (colorCode || "XXX").trim().toUpperCase() || "XXX";
  return `${titlePrefix}-${productCode}-${size}-${color}`;
}

export function baseSku(titlePrefix: string, productCode: string): string {
  return `${titlePrefix}-${productCode}`;
}

export function resolveColorCode(
  colorNameOrCode: string,
  colorsList: Array<{ name: string; code: string }>
): string {
  const raw = (colorNameOrCode || "").trim();
  if (!raw) return "XXX";

  const byCode = colorsList.find((c) => c.code.toUpperCase() === raw.toUpperCase());
  if (byCode) return byCode.code.toUpperCase();

  const byName = colorsList.find((c) => c.name.toLowerCase() === raw.toLowerCase());
  if (byName) return byName.code.toUpperCase();

  const mapped = DEFAULT_COLOR_CODES[raw] || DEFAULT_COLOR_CODES[raw.replace(/\s+/g, "")];
  if (mapped) return mapped;

  const letters = raw.replace(/[^a-zA-Z]/g, "").toUpperCase();
  return (letters.slice(0, 3) || "XXX").padEnd(3, "X");
}

export function resolveSizeCode(sizeName: string, sizesList: Array<{ name: string }>): string {
  const raw = (sizeName || "").trim();
  if (!raw) return "NA";

  const match = sizesList.find((s) => s.name.toLowerCase() === raw.toLowerCase());
  if (match) return match.name;

  return raw;
}

/** Parse full variant SKU or base SKU (TITLE-CODE). */
export function parseSku(sku: string): ParsedSku | null {
  const parts = sku.trim().toUpperCase().split("-").filter(Boolean);
  if (parts.length < 2) return null;

  const titlePrefix = parts[0];
  const code = parts[1];
  if (!/^\d{1,}$/.test(code)) return null;

  if (parts.length === 2) {
    return { titlePrefix, code: formatProductCode(Number(code)), size: "", color: "" };
  }

  const color = parts[parts.length - 1];
  const size = parts.slice(2, -1).join("-");
  return {
    titlePrefix,
    code: formatProductCode(Number(code)),
    size,
    color,
  };
}

export function isValidSkuShape(sku: string): boolean {
  return parseSku(sku) != null;
}
