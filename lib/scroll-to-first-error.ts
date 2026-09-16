import type { FieldErrors, FieldValues } from "react-hook-form";

/** Scrolls the first invalid field into view (works inside overflow containers). */
export function scrollToFirstError<T extends FieldValues>(errors: FieldErrors<T>) {
  const name = Object.keys(errors)[0];
  if (!name) return;

  const el = document.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`);
  if (!el) return;

  if (typeof el.scrollIntoView === "function") {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  if (typeof el.focus === "function") {
    el.focus({ preventScroll: true });
  }
}
