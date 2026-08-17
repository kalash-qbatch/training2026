export const FREE_SIZE_LABEL = "Free Size";

export function isFreeSizeProduct(product: { variants?: unknown[] }) {
  return !product.variants?.length;
}

export function isFreeSizeLine(color?: string, size?: string) {
  return !color?.trim() && !size?.trim();
}

export function formatLineColor(color?: string) {
  return color?.trim() || "—";
}

export function formatLineSize(size?: string, color?: string) {
  if (isFreeSizeLine(color, size)) return FREE_SIZE_LABEL;
  return size?.trim() || "—";
}
