"use client";

import React, { type ComponentProps, useRef } from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import type { ChatbotProduct } from "@/lib/chatbot/types";

import { ProductChatCard } from "./ProductChatCard";

type ProductAction = NonNullable<ComponentProps<typeof ProductChatCard>["onAction"]>;

interface ProductCarouselProps {
  products: ChatbotProduct[];
  onAddToCartSuccess?: (productName: string, quantity: number) => void;
  onAddToCartError?: (error: string) => void;
  onAction?: ProductAction;
}

export function ProductCarousel({
  products,
  onAddToCartSuccess,
  onAddToCartError,
  onAction,
}: ProductCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!products || products.length === 0) return null;

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = 260; // Card width + gap
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <div
      className="relative w-full my-2 group/carousel"
      role="region"
      aria-label="Product recommendations carousel"
    >
      {/* Scroll Left Button */}
      {products.length > 1 && (
        <button
          type="button"
          onClick={() => handleScroll("left")}
          aria-label="Scroll left"
          className="absolute -left-2.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-full shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:text-black opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-200 focus:opacity-100"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Horizontal Cards Container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 pt-1 px-1 scroll-smooth snap-x snap-mandatory scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent"
        style={{ scrollbarWidth: "thin" }}
      >
        {products.map((product) => (
          <div key={product.id} className="snap-start shrink-0">
            <ProductChatCard
              product={product}
              onAddToCartSuccess={onAddToCartSuccess}
              onAddToCartError={onAddToCartError}
              onAction={onAction}
            />
          </div>
        ))}
      </div>

      {/* Scroll Right Button */}
      {products.length > 1 && (
        <button
          type="button"
          onClick={() => handleScroll("right")}
          aria-label="Scroll right"
          className="absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-full shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:text-black opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-200 focus:opacity-100"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
