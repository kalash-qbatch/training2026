"use client";

import { startTransition, useMemo, useState } from "react";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { placeOrder as placeOrderApi } from "@/lib/api/orders";
import { TAX_RATE } from "@/lib/constants";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useCartStore } from "@/lib/store/useCartStore";
import type { CartItem } from "@/types";

import { CartLineItem } from "./CartLineItem";
import { CartSummary } from "./CartSummary";
import { OrderPlacedModal } from "./OrderPlacedModal";
import { RemoveProductModal } from "./RemoveProductModal";

function itemKey(item: CartItem) {
  return (
    item.id ||
    (item.specificationId ? `${item.productId}::${item.specificationId}` : item.productId)
  );
}

export function CartPageClient() {
  const router = useRouter();
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const removeItems = useCartStore((s) => s.removeItems);
  const clearCart = useCartStore((s) => s.clearCart);

  const [pendingRemove, setPendingRemove] = useState<CartItem | null>(null);
  const [pendingClearAll, setPendingClearAll] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map(itemKey)));
  const [successOpen, setSuccessOpen] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [prevItems, setPrevItems] = useState(items);

  // Sync selection with cart items during render
  if (items !== prevItems) {
    setPrevItems(items);
    const keys = new Set(items.map(itemKey));
    setSelected((prev) => {
      if (prev.size === 0) return keys;
      const next = new Set([...prev].filter((k) => keys.has(k)));
      return next.size > 0 ? next : keys;
    });
  }

  const selectedItems = useMemo(
    () => items.filter((i) => selected.has(itemKey(i))),
    [items, selected]
  );

  const subtotal = selectedItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const tax = Number((subtotal * TAX_RATE).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));
  const allSelected = items.length > 0 && selected.size === items.length;

  const overlays = (
    <OrderPlacedModal
      open={successOpen}
      onDetails={() => {
        setSuccessOpen(false);
        if (placedOrderId) {
          router.push(`/orders/${placedOrderId}`);
        } else {
          router.push("/orders");
        }
      }}
      onHome={() => {
        setSuccessOpen(false);
        router.push("/products");
      }}
    />
  );

  if (!items.length) {
    return (
      <section>
        <div className="mb-6 flex items-center gap-2">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-lg font-semibold text-brand-600 hover:text-brand-700"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
            Your Shopping Bag
          </Link>
        </div>
        <EmptyState
          title="Your bag is empty"
          description="Browse products and add items to your cart."
          ctaHref="/products"
          ctaLabel="Browse products"
        />
        {overlays}
      </section>
    );
  }

  return (
    <section>
      <div className="mb-6 flex items-center justify-between gap-2">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-lg font-semibold text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
          Your Shopping Bag
        </Link>
        {items.length > 1 ? (
          <button
            type="button"
            onClick={() => setPendingClearAll(true)}
            className="text-sm font-medium text-[#EF4444] hover:underline"
          >
            Remove all
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="hidden w-full min-w-225 border-collapse md:table">
          <thead>
            <tr className="border-b border-neutral-border text-left text-[12px] font-medium text-neutral-muted">
              <th className="w-10 pb-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelected(new Set(items.map(itemKey)));
                    } else {
                      setSelected(new Set());
                    }
                  }}
                  className="h-4 w-4 rounded border-neutral-border text-brand-500"
                  aria-label="Select all items"
                />
              </th>
              <th className="pb-3 font-medium">Product</th>
              <th className="pb-3 font-medium">Color</th>
              <th className="pb-3 font-medium">Size</th>
              <th className="pb-3 font-medium">Qty</th>
              <th className="pb-3 font-medium">Price</th>
              <th className="pb-3 font-medium">Total Price</th>
              <th className="pb-3 text-right font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const key = itemKey(item);
              return (
                <CartLineItem
                  key={key}
                  variant="table"
                  item={item}
                  selected={selected.has(key)}
                  onSelect={(checked) => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(key);
                      else next.delete(key);
                      return next;
                    });
                  }}
                  onQtyChange={(qty) => {
                    void updateQty(item.productId, qty, item.specificationId).catch(
                      (err: unknown) =>
                        toast.error(err instanceof Error ? err.message : "Failed to update qty")
                    );
                  }}
                  onRemove={() => setPendingRemove(item)}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {items.map((item) => {
          const key = itemKey(item);
          return (
            <CartLineItem
              key={`m-${key}`}
              variant="card"
              item={item}
              selected={selected.has(key)}
              onSelect={(checked) => {
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (checked) next.add(key);
                  else next.delete(key);
                  return next;
                });
              }}
              onQtyChange={(qty) => {
                void updateQty(item.productId, qty, item.specificationId).catch((err: unknown) =>
                  toast.error(err instanceof Error ? err.message : "Failed to update qty")
                );
              }}
              onRemove={() => setPendingRemove(item)}
            />
          );
        })}
      </ul>

      <div className="mt-10 flex justify-center md:justify-end">
        <CartSummary
          subtotal={subtotal}
          tax={tax}
          total={total}
          disabled={selectedItems.length === 0}
          loading={placing}
          onPlaceOrder={async () => {
            if (!user) {
              router.push("/login?next=/cart");
              return;
            }
            if (!selectedItems.length) {
              toast.error("Select at least one item to place an order");
              return;
            }
            setPlacing(true);
            try {
              const order = await placeOrderApi(
                selectedItems.map((i) => ({
                  productId: i.productId,
                  specificationId: i.specificationId,
                  quantity: i.qty,
                }))
              );
              await removeItems(
                selectedItems.map((i) => ({
                  productId: i.productId,
                  specificationId: i.specificationId,
                }))
              );
              setPlacedOrderId(order.id);
              setSuccessOpen(true);
              // Defer refresh so it doesn't block the success modal rendering
              startTransition(() => {
                router.refresh();
              });
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed to place order");
            } finally {
              setPlacing(false);
            }
          }}
        />
      </div>

      <RemoveProductModal
        open={Boolean(pendingRemove)}
        onClose={() => setPendingRemove(null)}
        onConfirm={() => {
          if (pendingRemove) {
            void removeItem(pendingRemove.productId, pendingRemove.specificationId)
              .then(() => toast.success("Item removed from bag"))
              .catch((err: unknown) =>
                toast.error(err instanceof Error ? err.message : "Failed to remove item")
              );
          }
          setPendingRemove(null);
        }}
      />
      <RemoveProductModal
        open={pendingClearAll}
        onClose={() => setPendingClearAll(false)}
        title="Remove all products?"
        description="Are you sure you want to remove all items from your bag?"
        onConfirm={() => {
          setPendingClearAll(false);
          void clearCart()
            .then(() => toast.success("Bag cleared"))
            .catch((err: unknown) =>
              toast.error(err instanceof Error ? err.message : "Failed to clear bag")
            );
        }}
      />
      {overlays}
    </section>
  );
}
