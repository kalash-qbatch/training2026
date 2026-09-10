"use client";

import { create } from "zustand";

export type BulkDraftImage = {
  id: string;
  url: string;
  fileName: string;
  color: string;
  file?: File;
};

export type BulkDraftVariant = {
  color: string;
  size: string;
  qty: number;
};

export type BulkDraftProduct = {
  id: string;
  title: string;
  price: number;
  stock: number;
  categoryName: string;
  description: string;
  variants: BulkDraftVariant[];
  images: BulkDraftImage[];
};

type BulkUploadState = {
  products: BulkDraftProduct[];
  setProducts: (products: BulkDraftProduct[]) => void;
  updateProduct: (id: string, updates: Partial<BulkDraftProduct>) => void;
  removeProduct: (id: string) => void;
  addProduct: () => void;
  clear: () => void;
};

function newId() {
  return `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyBulkProduct(): BulkDraftProduct {
  return {
    id: newId(),
    title: "",
    price: 0,
    stock: 0,
    categoryName: "",
    description: "",
    variants: [],
    images: [],
  };
}

export const useBulkUploadStore = create<BulkUploadState>((set) => ({
  products: [],
  setProducts: (products) => set({ products }),
  updateProduct: (id, updates) =>
    set((state) => ({
      products: state.products.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  removeProduct: (id) =>
    set((state) => {
      const target = state.products.find((p) => p.id === id);
      if (target) {
        for (const img of target.images) {
          if (img.file) URL.revokeObjectURL(img.url);
        }
      }
      return { products: state.products.filter((p) => p.id !== id) };
    }),
  addProduct: () =>
    set((state) => ({
      products: [...state.products, emptyBulkProduct()],
    })),
  clear: () =>
    set((state) => {
      for (const p of state.products) {
        for (const img of p.images) {
          if (img.file) URL.revokeObjectURL(img.url);
        }
      }
      return { products: [] };
    }),
}));
