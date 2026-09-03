"use client";

import { useState } from "react";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { reorderCancelledOrder } from "@/lib/api/orders";
import { useCartStore } from "@/lib/store/useCartStore";

export function OrderAgainButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const setItems = useCartStore((s) => s.setItems);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const items = await reorderCancelledOrder(orderId);
      setItems(items);
      router.push("/cart");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reorder");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      className="inline-flex h-auto w-auto shrink-0 gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
      loading={loading}
      onClick={handleClick}
    >
      <RotateCcw className="h-4 w-4" />
      Order Again
    </Button>
  );
}
