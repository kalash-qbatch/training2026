"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Pencil, Trash2, Search } from "lucide-react";
import { colorSwatch, formatCurrency, isLightSwatch } from "@/lib/utils";
import type { Category, Product, ProductVariant } from "@/types";
import {
  createAdminProduct,
  deleteAdminProduct,
  fetchAdminCategories,
  fetchAdminProducts,
  updateAdminProduct,
} from "@/lib/api/admin";
import { useToast } from "@/components/ui/Toast";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { DeleteConfirmModal } from "@/components/admin/DeleteConfirmModal";
import {
  AddProductDrawer,
  EditProductDrawer,
} from "@/components/admin/ProductDrawers";
import { AddMultipleProductsModal } from "@/components/admin/AddMultipleProductsModal";
import { ProductPreviewModal } from "@/components/admin/ProductPreviewModal";

const inputClass =
  "h-10 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-[13px] text-[#333333] outline-none placeholder:text-[#8a94a6] focus:border-[#2563EB]";

function stockByColor(product: Product): Array<{ color: string; qty: number }> {
  if (product.variants?.length) {
    const map = new Map<string, number>();
    for (const v of product.variants as ProductVariant[]) {
      const key = v.color.trim();
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + v.qty);
    }
    return [...map.entries()].map(([color, qty]) => ({ color, qty }));
  }
  if (product.color) {
    return [{ color: product.color, qty: product.stock ?? 0 }];
  }
  return [{ color: "", qty: product.stock ?? 0 }];
}

function StockColorCircles({ product }: { product: Product }) {
  const rows = stockByColor(product);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {rows.map(({ color, qty }) => {
        const isWhite = color.trim().toLowerCase() === "white";
        const bg = isWhite ? "#FFFFFF" : color ? colorSwatch(color) : "#94A3B8";
        const light = isLightSwatch(bg);
        return (
          <span
            key={color || "stock"}
            title={color ? `${color}: ${qty}` : `Stock: ${qty}`}
            className="inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums"
            style={{
              backgroundColor: bg,
              color: light ? "#111827" : "#FFFFFF",
              border: light ? "1px solid #111827" : "1px solid transparent",
            }}
          >
            {qty}
          </span>
        );
      })}
    </div>
  );
}
export function ProductsPageClient() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "">("");
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    void fetchAdminCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [addOpen, editProduct]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminProducts({
        search: debounced,
        categoryId: categoryId || undefined,
        status,
        page,
      });
      setProducts(data.products);
      setTotalPages(data.totalPages);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [debounced, categoryId, status, page, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetPage = () => setPage(1);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[22px] font-semibold text-[#2563EB]">Products</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-md border border-[#2563EB] bg-white px-3.5 py-2 text-[13px] font-medium text-[#2563EB] transition hover:bg-brand-50"
          >
            + Add a Single Product
          </button>
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="rounded-md bg-[#2563EB] px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-[#1e6aef]"
          >
            + Add Multiple Products
          </button>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="relative">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            placeholder="Search by name"
            className={`${inputClass} pr-10`}
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a94a6]" />
        </div>
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            resetPage();
          }}
          className={inputClass}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "active" | "inactive" | "");
            resetPage();
          }}
          className={inputClass}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#e5e7eb] text-[12px] font-medium text-[#8a94a6]">
              <th className="pb-3 pr-4 font-medium">Title</th>
              <th className="pb-3 pr-4 font-medium">Category</th>
              <th className="pb-3 pr-4 font-medium">Price</th>
              <th className="pb-3 pr-4 font-medium">Stock</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[#8a94a6]">
                  Loading…
                </td>
              </tr>
            ) : !products.length ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[#8a94a6]">
                  No products found
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-[#f3f4f6] last:border-0"
                >
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.imageUrl}
                        alt=""
                        className="h-10 w-10 rounded object-cover"
                      />
                      <p className="font-medium text-[#333333]">{p.name}</p>
                    </div>
                  </td>
                  <td className="py-3.5 pr-4 text-[#333333]">
                    {p.category?.name ?? "—"}
                  </td>
                  <td className="py-3.5 pr-4 tabular-nums text-[#333333]">
                    {formatCurrency(p.price)}
                  </td>
                  <td className="py-3.5 pr-4">
                    <StockColorCircles product={p} />
                  </td>
                  <td className="py-3.5 pr-4">
                    <span
                      className={
                        p.isActive
                          ? "rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700"
                          : "rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600"
                      }
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewProduct(p)}
                        className="rounded p-1.5 text-[#6b7280] transition hover:bg-neutral-bg"
                        aria-label="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditProduct(p)}
                        className="rounded p-1.5 text-[#2563EB] transition hover:bg-brand-50"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(p.id)}
                        className="rounded p-1.5 text-[#EF4444] transition hover:bg-red-50"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination page={page} totalPages={totalPages} onChange={setPage} />

      <ProductPreviewModal
        product={previewProduct}
        onClose={() => setPreviewProduct(null)}
      />
      <AddProductDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={async (data) => {
          await createAdminProduct(data);
          toast.success("Product created successfully");
          await load();
        }}
      />
      <EditProductDrawer
        open={!!editProduct}
        product={editProduct}
        onClose={() => setEditProduct(null)}
        onSave={async (data) => {
          if (!editProduct) return;
          await updateAdminProduct(editProduct.id, data);
          toast.success("Product updated successfully");
          await load();
        }}
      />
      <AddMultipleProductsModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onDone={async () => {
          toast.success("Products uploaded successfully");
          await load();
        }}
      />
      <DeleteConfirmModal
        open={!!deleteId}
        loading={deleting}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          setDeleting(true);
          try {
            const result = await deleteAdminProduct(deleteId);
            setDeleteId(null);
            toast.success(
              result.deactivated
                ? "Product set to Inactive because it appears in past orders"
                : "Product deleted successfully"
            );
            const data = await fetchAdminProducts({
              search: debounced,
              categoryId: categoryId || undefined,
              status,
              page,
            });
            if (data.page > data.totalPages) {
              setPage(data.totalPages);
            } else {
              setProducts(data.products);
              setTotalPages(data.totalPages);
            }
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Delete failed");
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}
