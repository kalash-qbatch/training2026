"use client";

import { useState } from "react";

import { ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { TAX_RATE } from "@/lib/constants";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useCartStore } from "@/lib/store/useCartStore";
import type { CartItem } from "@/types";

import { CartLineItem } from "./CartLineItem";
import { CartSummary } from "./CartSummary";

const RemoveProductModal = dynamic(
  () => import("./RemoveProductModal").then((m) => ({ default: m.RemoveProductModal })),
  { loading: () => null }
);

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
  const fetchCart = useCartStore((s) => s.fetchCart);

  const [pendingRemove, setPendingRemove] = useState<CartItem | null>(null);
  const [pendingClearSelected, setPendingClearSelected] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map(itemKey)));
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

  const selectedItems = items.filter((i) => selected.has(itemKey(i)));

  const subtotal = selectedItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const tax = Number((subtotal * TAX_RATE).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));
  const allSelected = items.length > 0 && selected.size === items.length;

  if (!items.length) {
    return (
      <section>
        <div className="mb-6 flex items-center gap-2">
          <Link
            href="/products"
            prefetch={false}
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
          ctaPrefetch={false}
        />
      </section>
    );
  }

  return (
    <section>
      <div className="mb-6 flex items-center justify-between gap-2">
        <Link
          href="/products"
          prefetch={false}
          className="inline-flex items-center gap-2 text-lg font-semibold text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
          Your Shopping Bag
        </Link>
        {selectedItems.length > 0 ? (
          <button
            type="button"
            onClick={() => setPendingClearSelected(true)}
            className="text-sm font-medium text-[#EF4444] hover:underline"
          >
            {allSelected ? "Remove all" : "Remove selected"}
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
          disabled={selectedItems.length === 0 || checkingOut}
          loading={checkingOut}
          onPlaceOrder={() => {
            if (!user) {
              router.push("/login?next=/checkout");
              return;
            }
            if (!selectedItems.length) {
              toast.error("Select at least one item to proceed to checkout");
              return;
            }
            setCheckingOut(true);
            void (async () => {
              try {
                await fetchCart();
                const fresh = useCartStore.getState().items;
                for (const item of selectedItems) {
                  const match = fresh.find(
                    (i) =>
                      i.productId === item.productId &&
                      (i.specificationId || "") === (item.specificationId || "")
                  );
                  if (!match) {
                    toast.error(`"${item.name}" is no longer in your bag`);
                    return;
                  }
                  const stock = match.stock ?? 0;
                  if (item.qty > stock) {
                    toast.error(
                      stock <= 0
                        ? `"${item.name}" is out of stock`
                        : `Not enough stock for "${item.name}". Only ${stock} left.`
                    );
                    return;
                  }
                }
                router.push("/checkout");
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : "Failed to validate stock");
              } finally {
                setCheckingOut(false);
              }
            })();
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
        open={pendingClearSelected}
        onClose={() => setPendingClearSelected(false)}
        title={allSelected ? "Remove all products?" : "Remove selected products?"}
        description={
          allSelected
            ? "Are you sure you want to remove all items from your bag?"
            : `Are you sure you want to remove ${selectedItems.length} selected item${selectedItems.length === 1 ? "" : "s"}? Unselected items will stay in your bag.`
        }
        onConfirm={() => {
          const toRemove = selectedItems.map((i) => ({
            productId: i.productId,
            specificationId: i.specificationId,
          }));
          setPendingClearSelected(false);
          void removeItems(toRemove)
            .then(() =>
              toast.success(
                allSelected
                  ? "Bag cleared"
                  : `${toRemove.length} item${toRemove.length === 1 ? "" : "s"} removed`
              )
            )
            .catch((err: unknown) =>
              toast.error(err instanceof Error ? err.message : "Failed to remove items")
            );
        }}
      />
    </section>
  );
}
