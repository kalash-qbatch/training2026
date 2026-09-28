"use client";

import React, { useState } from "react";

import { Check, Loader2, Lock, LogIn, Minus, Plus, ShoppingBag, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";

import type { ChatbotProduct } from "@/lib/chatbot/types";
import { useCartStore } from "@/lib/store/useCartStore";

/** Matches the key used in ProductChatDrawer — keeps chat open after login redirect */
const GUEST_OPEN_KEY = "store_ai_guest_open";

interface ProductChatCardProps {
  product: ChatbotProduct;
  onAddToCartSuccess?: (productName: string, quantity: number) => void;
  onAddToCartError?: (error: string) => void;
}

export function ProductChatCard({
  product,
  onAddToCartSuccess,
  onAddToCartError,
}: ProductChatCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auth status from next-auth
  const { status: authStatus } = useSession();
  const isLoggedIn = authStatus === "authenticated";
  const isAuthLoading = authStatus === "loading";

  // Sync with main app Zustand cart store
  const storeAddItem = useCartStore((s) => s.addItem);

  const isOutOfStock = !product.in_stock || (product.stock !== undefined && product.stock <= 0);

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, Math.min(prev + delta, product.stock ?? 10)));
  };

  // Direct fast Add-to-Cart — live DB products use /api/cart; demo catalog uses store-assistant
  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isLoading || isOutOfStock || !isLoggedIn) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const isLiveCatalogProduct = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(product.id);

      if (isLiveCatalogProduct) {
        const result = await storeAddItem(
          {
            id: product.id,
            name: product.name,
            price: product.price,
            imageUrl: product.image,
            stock: product.stock ?? 10,
            isActive: true,
          },
          quantity,
          product.specificationId ? { specificationId: product.specificationId } : undefined
        );

        if (!result.ok) {
          throw new Error(result.error || "Unable to add product to cart.");
        }
      } else {
        const response = await fetch("/api/store-assistant/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: product.id,
            quantity,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Unable to add product to cart.");
        }
      }

      setJustAdded(true);
      if (onAddToCartSuccess) {
        onAddToCartSuccess(product.name, quantity);
      }

      setTimeout(() => {
        setJustAdded(false);
      }, 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add to cart. Please try again.";
      setErrorMessage(msg);
      if (onAddToCartError) {
        onAddToCartError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col w-[230px] sm:w-[250px] shrink-0 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 group"
      data-testid={`product-card-${product.id}`}
      role="article"
      aria-label={product.name}
    >
      {/* Product Image & Stock Badge */}
      <div className="relative w-full h-36 bg-gray-100 overflow-hidden">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="250px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "/products/tee.jpg";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <ShoppingBag className="w-8 h-8 opacity-40" />
          </div>
        )}

        {/* Stock Status Badge */}
        <span
          className={`absolute top-2 left-2 text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-sm ${
            isOutOfStock ? "bg-red-500 text-white" : "bg-emerald-600 text-white"
          }`}
        >
          {isOutOfStock ? "Out of stock" : "In stock"}
        </span>

        {/* Rating */}
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-amber-300 text-[11px] font-medium px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
          <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
          <span>{product.rating.toFixed(1)}</span>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-3.5 flex flex-col flex-1 justify-between">
        <div>
          {product.category && (
            <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600">
              {product.category}
            </span>
          )}
          <h4
            className="text-sm font-semibold text-gray-900 line-clamp-1 group-hover:text-blue-600 transition-colors"
            title={product.name}
          >
            {product.name}
          </h4>
          <p className="text-xs text-gray-500 line-clamp-2 mt-1 leading-snug">
            {product.short_description || "High quality item from our collection."}
          </p>
        </div>

        <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-col gap-2">
          {/* Price & Currency */}
          <div className="flex items-baseline justify-between">
            <span className="text-base font-bold text-gray-900">${product.price.toFixed(2)}</span>
            <span className="text-[11px] text-gray-400 font-medium">
              {product.currency || "USD"}
            </span>
          </div>

          {/* ── GUEST: Login-to-add-to-cart banner ── */}
          {!isAuthLoading && !isLoggedIn ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 flex flex-col items-center gap-2 text-center">
              <div className="flex items-center gap-1.5 text-amber-700">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <p className="text-[11px] font-semibold leading-snug">
                  Sign in to add this to your cart
                </p>
              </div>
              <Link
                href={`/login?redirect=/products/${product.id}`}
                onClick={() => {
                  // Mark the chat drawer as "was open" so it auto-restores after login
                  try {
                    sessionStorage.setItem(GUEST_OPEN_KEY, "1");
                  } catch {}
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[11px] font-semibold px-3 py-1.5 transition-colors shadow-sm w-full justify-center"
              >
                <LogIn className="w-3 h-3" />
                Log in to continue
              </Link>
              <Link
                href={`/products/${product.id}`}
                className="text-[10px] text-gray-500 hover:text-blue-600 transition-colors"
              >
                View full details
              </Link>
            </div>
          ) : (
            <>
              {/* Quantity Selector – shown only when in stock and logged in */}
              {!isOutOfStock && (
                <div className="flex items-center justify-between gap-1 text-xs">
                  <span className="text-gray-500 font-medium">Qty:</span>
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1 || isLoading}
                      aria-label="Decrease quantity"
                      className="p-1 hover:bg-gray-200 text-gray-600 disabled:opacity-30 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-2 text-xs font-semibold text-gray-800 min-w-5 text-center">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(1)}
                      disabled={
                        isLoading || (product.stock !== undefined && quantity >= product.stock)
                      }
                      aria-label="Increase quantity"
                      className="p-1 hover:bg-gray-200 text-gray-600 disabled:opacity-30 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Add to Cart Button */}
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isOutOfStock || isLoading}
                aria-busy={isLoading}
                data-testid={`add-to-cart-${product.id}`}
                className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 ${
                  isOutOfStock
                    ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                    : justAdded
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm hover:shadow"
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Adding...</span>
                  </>
                ) : justAdded ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                    <span>Added to cart!</span>
                  </>
                ) : isOutOfStock ? (
                  <span>Out of stock</span>
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Add to Cart</span>
                  </>
                )}
              </button>

              {/* View Details / Cart Link */}
              {justAdded ? (
                <Link
                  href="/cart"
                  className="text-center text-[11px] font-semibold text-emerald-700 hover:underline pt-0.5"
                >
                  View Cart &rarr;
                </Link>
              ) : (
                <Link
                  href={`/products/${product.id}`}
                  className="text-center text-[11px] text-gray-500 hover:text-blue-600 transition-colors"
                >
                  View full details
                </Link>
              )}

              {/* In-card Error Feedback */}
              {errorMessage && (
                <p
                  className="text-[11px] text-red-600 text-center mt-1 bg-red-50 p-1 rounded"
                  role="alert"
                >
                  {errorMessage}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
