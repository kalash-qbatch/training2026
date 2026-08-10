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

export function formatRelativeTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return "Just now";
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  if (diffHour < 24) {
    return `${diffHour}h ago`;
  }
  if (diffDay < 7) {
    return `${diffDay}d ago`;
  }
  return formatDate(iso);
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

/** True when a hex background is light enough that white text is hard to read. */
export function isLightSwatch(hex: string) {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (full.length !== 6) return false;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55;
}

export function orderStatusLabel(status: string) {
  switch (status) {
    case "delivered":
      return "Delivered";
    case "shipped":
      return "Approved";
    case "cancelled":
      return "Cancelled";
    default:
      return "In Progress";
  }
}

/** Map UI/API order status → Prisma enum for admin select. */
export function toAdminOrderStatus(
  status: string
): "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" {
  switch (status) {
    case "delivered":
    case "DELIVERED":
      return "DELIVERED";
    case "shipped":
    case "SHIPPED":
      return "SHIPPED";
    case "cancelled":
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "PROCESSING";
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
