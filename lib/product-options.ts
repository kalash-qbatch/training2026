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

export function resolveCategoryName(
  raw: string | undefined | null,
  categories: Array<{ id: string; name: string }>
): { categoryId: string; categoryName: string } | null {
  const value = (raw || "").trim();
  if (!value) return null;

  const lower = value.toLowerCase();
  const exact = categories.find((c) => c.name.toLowerCase() === lower);
  if (exact) return { categoryId: exact.id, categoryName: exact.name };

  const compactValue = compact(value);
  const byCompact = categories.find((c) => compact(c.name) === compactValue);
  if (byCompact) return { categoryId: byCompact.id, categoryName: byCompact.name };

  const includes = categories.find(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      lower.includes(c.name.toLowerCase()) ||
      compact(c.name).includes(compactValue) ||
      compactValue.includes(compact(c.name))
  );
  if (includes) return { categoryId: includes.id, categoryName: includes.name };

  return { categoryId: "", categoryName: value };
}
