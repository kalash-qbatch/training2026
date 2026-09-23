"use client";

import { ProductChatDrawer } from "@/components/features/chat/ProductChatDrawer";

/** Same store chat UI, scoped to admin-only Q&A. */
export function AdminChatDrawer() {
  return <ProductChatDrawer variant="admin" />;
}
