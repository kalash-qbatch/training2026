"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getProducts } from "@/lib/api/products";
import { placeOrder as placeOrderApi } from "@/lib/api/orders";
import { useCartStore } from "@/lib/store/useCartStore";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { CartLineItem } from "./CartLineItem";
import { CartSummary } from "./CartSummary";
import { RemoveProductModal } from "./RemoveProductModal";
import type { CartItem } from "@/types";

function itemKey(item: CartItem) {
  return `${item.productId}::${item.size ?? ""}::${item.color ?? ""}`;
}

export function CartPageClient() {
  const router = useRouter();
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const removeMissingProducts = useCartStore((s) => s.removeMissingProducts);
  const addLocalOrder = useCartStore((s) => s.addLocalOrder);

  const [pendingRemove, setPendingRemove] = useState<CartItem | null>(null);
  const [placing, setPlacing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    getProducts({ pageSize: 100 })
      .then((data) => removeMissingProducts(data.products.map((p) => p.id)))
      .catch(() => {});
  }, [removeMissingProducts]);

  useEffect(() => {
    const keys = new Set(items.map(itemKey));
    setSelected((prev) => {
      if (prev.size === 0) return keys;
      const next = new Set([...prev].filter((k) => keys.has(k)));
      return next.size > 0 ? next : keys;
    });
  }, [items]);

  const selectedItems = useMemo(
    () => items.filter((i) => selected.has(itemKey(i))),
    [items, selected]
  );

  const subtotal = selectedItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const tax = Number((subtotal * 0.08).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));
  const allSelected = items.length > 0 && selected.size === items.length;

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
      </section>
    );
  }

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

      <div className="overflow-x-auto">
        <table className="hidden w-full min-w-[900px] border-collapse md:table">
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
                  onQtyChange={(qty) =>
                    updateQty(item.productId, qty, item.size, item.color)
                  }
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
              onQtyChange={(qty) =>
                updateQty(item.productId, qty, item.size, item.color)
              }
              onRemove={() => setPendingRemove(item)}
            />
          );
        })}
      </ul>

      <div className="mt-10 flex justify-end">
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
                  quantity: i.qty,
                  color: i.color,
                  size: i.size,
                }))
              );
              addLocalOrder(order);
              for (const i of selectedItems) {
                removeItem(i.productId, i.size, i.color);
              }
              toast.success("Awesome, Your order has been placed successfully.");
              const remaining = items.length - selectedItems.length;
              if (remaining <= 0) {
                router.push("/products");
              }
              router.refresh();
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : "Failed to place order"
              );
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
            removeItem(
              pendingRemove.productId,
              pendingRemove.size,
              pendingRemove.color
            );
            toast.success("Item removed from bag");
          }
          setPendingRemove(null);
        }}
      />
    </section>
  );
}
