import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(new Date(iso));
}

const COLOR_SWATCHES: Record<string, string> = {
  black: "#111827",
  blue: "#2563EB",
  red: "#EF4444",
  green: "#22C55E",
  white: "#F3F4F6",
  brown: "#92400E",
  gray: "#6B7280",
  grey: "#6B7280",
  yellow: "#EAB308",
  beige: "#D2B48C",
  bage: "#D2B48C",
  natural: "#E7E5E4",
  silver: "#C0C0C0",
  orange: "#F97316",
  pink: "#EC4899",
  purple: "#A855F7",
};

export function colorSwatch(color?: string) {
  if (!color) return "#D0D5DD";
  return COLOR_SWATCHES[color.toLowerCase()] ?? "#94A3B8";
}

export function orderStatusLabel(status: string) {
  switch (status) {
    case "delivered":
      return "Delivered";
    case "shipped":
      return "Dispatched";
    case "cancelled":
      return "Rejected";
    default:
      return "In Progress";
  }
}

export function orderStatusClass(status: string) {
  switch (status) {
    case "delivered":
      return "bg-[#22C55E] text-white";
    case "shipped":
      return "bg-[#2563EB] text-white";
    case "cancelled":
      return "bg-[#EF4444] text-white";
    default:
      return "bg-[#F59E0B] text-white";
  }
}

export function delay(ms = 600) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
