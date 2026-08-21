export const FREE_SIZE_LABEL = "No Size";

export function isFreeSizeProduct(product: { variants?: unknown[] }) {
  return !product.variants?.length;
}

export function formatLineColor(color?: string) {
  return color?.trim() || "—";
}

export function formatLineSize(size?: string) {
  return size?.trim() || FREE_SIZE_LABEL;
}

/**
 * Slide to the image assigned to the selected color. When no image has a
 * color assigned, fall back to pairing colors and images by position.
 */
export function getColorSlideIndex(
  slides: Array<{ color?: string }>,
  colors: string[],
  selectedColor: string
) {
  const norm = selectedColor.trim().toLowerCase();
  if (norm) {
    const byColor = slides.findIndex((img) => img.color && img.color.toLowerCase() === norm);
    if (byColor >= 0) return byColor;

    const anyAssigned = slides.some((img) => img.color);
    if (!anyAssigned && slides.length > 1) {
      const colorIdx = colors.findIndex((c) => c.toLowerCase() === norm);
      if (colorIdx >= 0) return Math.min(colorIdx, slides.length - 1);
    }
  }
  const global = slides.findIndex((img) => !img.color);
  return global >= 0 ? global : 0;
}
