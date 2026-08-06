"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2, Search } from "lucide-react";
import type { Product } from "@/types";
import type { StockFilter } from "@/lib/services/products";
import { formatCurrency } from "@/lib/utils";
import {
  createAdminProduct,
  deleteAdminProduct,
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

const inputClass =
  "h-10 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-[13px] text-[#333333] outline-none placeholder:text-[#8a94a6] focus:border-[#2563EB]";

export function ProductsPageClient() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [stock, setStock] = useState<StockFilter>("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminProducts({
        search: debounced,
        stock,
        minPrice,
        maxPrice,
        page,
      });
      setProducts(data.products);
      setTotalPages(data.totalPages);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [debounced, stock, minPrice, maxPrice, page, toast]);

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

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          value={stock}
          onChange={(e) => {
            setStock(e.target.value as StockFilter);
            resetPage();
          }}
          className={inputClass}
        >
          <option value="all">All stock</option>
          <option value="in_stock">In stock</option>
          <option value="low_stock">Low stock (≤10)</option>
          <option value="out_of_stock">Out of stock</option>
        </select>
        <input
          type="number"
          min={0}
          value={minPrice}
          onChange={(e) => {
            setMinPrice(e.target.value);
            resetPage();
          }}
          placeholder="Min price"
          className={inputClass}
        />
        <input
          type="number"
          min={0}
          value={maxPrice}
          onChange={(e) => {
            setMaxPrice(e.target.value);
            resetPage();
          }}
          placeholder="Max price"
          className={inputClass}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#e5e7eb] text-[12px] font-medium text-[#8a94a6]">
              <th className="pb-3 pr-4 font-medium">Title</th>
              <th className="pb-3 pr-4 font-medium">Price</th>
              <th className="pb-3 pr-4 font-medium">Stock</th>
              <th className="pb-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-[#8a94a6]">
                  Loading…
                </td>
              </tr>
            ) : !products.length ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-[#8a94a6]">
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
                  <td className="py-3.5 pr-4 tabular-nums text-[#333333]">
                    {formatCurrency(p.price)}
                  </td>
                  <td className="py-3.5 pr-4 text-[#333333]">{p.stock ?? 0}</td>
                  <td className="py-3.5">
                    <div className="flex items-center gap-1">
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
            await deleteAdminProduct(deleteId);
            setProducts((prev) => prev.filter((p) => p.id !== deleteId));
            toast.success("Product deleted successfully");
            setDeleteId(null);
            const data = await fetchAdminProducts({
              search: debounced,
              stock,
              minPrice,
              maxPrice,
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
