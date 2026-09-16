"use client";

import { useEffect, useRef, useState } from "react";

import { Check, Copy, Loader2, Plus, Trash2, Upload, X } from "lucide-react";

import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { fetchAdminCategories, fetchNextSku } from "@/lib/api/admin";
import { PRODUCT_SIZE_OPTIONS } from "@/lib/product-options";
import {
  baseSku,
  DEFAULT_COLOR_CODES,
  extractTitlePrefix,
  generateVariantSku,
  resolveColorCode,
} from "@/lib/sku";
import type { Category, Product, ProductSavePayload, ProductVariant } from "@/types";

const COLOR_OPTIONS = [
  "Black",
  "Blue",
  "Red",
  "Green",
  "White",
  "Brown",
  "Beige",
  "Gray",
  "Pink",
  "Purple",
  "Orange",
  "Gold",
  "Silver",
  "Bronze",
  "Copper",
  "Brass",
  "Steel",
  "Iron",
  "Yellow",
];
const SIZE_OPTIONS: string[] = [...PRODUCT_SIZE_OPTIONS];
const NEW_CATEGORY = "__new__";

type FormState = {
  title: string;
  price: string;
  stock: string;
  image: string;
  categoryId: string;
  isActive: boolean;
};

type ProductImageDraft = {
  url: string;
  color: string;
  file?: File;
};

type DraftVariant = {
  color: string;
  size: string;
  qty: string;
};

/** Editable variant row — qty may be "" while the user clears the field. */
type FormVariant = Omit<ProductVariant, "qty"> & { qty: number | "" };

const fieldClass =
  "mt-1.5 h-10 w-full rounded-md border border-neutral-border bg-white px-3 text-[13px] text-neutral-text outline-none placeholder:text-neutral-muted focus:border-[#2563EB]";

function emptyForm(): FormState {
  return {
    title: "",
    price: "",
    stock: "",
    image: "",
    categoryId: "",
    isActive: true,
  };
}

function emptyDraft(): DraftVariant {
  return { color: "", size: "", qty: "" };
}

function variantsFromProduct(product: Product): FormVariant[] {
  return product.variants?.length ? product.variants.map((v) => ({ ...v })) : [];
}

function totalStock(variants: FormVariant[], fallback: string) {
  if (variants.length > 0) {
    return String(variants.reduce((sum, v) => sum + (typeof v.qty === "number" ? v.qty : 0), 0));
  }
  return fallback;
}

function coerceVariantQty(qty: number | ""): number {
  if (qty === "" || qty == null) return 0;
  const n = Number(qty);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function previewVariantSku(
  titlePrefix: string | undefined,
  code: string | undefined,
  color: string,
  size: string
) {
  if (!titlePrefix || !code || !color.trim() || !size.trim()) return null;
  const colorCode = resolveColorCode(
    color,
    Object.entries(DEFAULT_COLOR_CODES).map(([name, c]) => ({ name, code: c }))
  );
  return generateVariantSku(titlePrefix, code, size, colorCode);
}

function SkuBadge({ sku, preview = false }: { sku: string; preview?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copySku() {
    try {
      await navigator.clipboard.writeText(sku);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void copySku()}
        title="Copy SKU"
        className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[#dbeafe] bg-[#eff6ff] px-2 py-1 text-left transition hover:border-[#93c5fd] hover:bg-[#dbeafe]"
      >
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[#3b82f6]">
          SKU
        </span>
        <span className="truncate font-mono text-[12px] font-semibold tabular-nums text-[#1e3a8a]">
          {sku}
        </span>
        {copied ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />
        ) : (
          <Copy className="h-3.5 w-3.5 shrink-0 text-[#60a5fa]" />
        )}
      </button>
      {preview ? (
        <span className="rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[10px] font-medium text-[#64748b]">
          Preview — confirmed on save
        </span>
      ) : (
        <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
          Confirmed
        </span>
      )}
    </div>
  );
}

function ProductFormFields({
  form,
  setForm,
  draft,
  setDraft,
  variants,
  setVariants,
  images,
  setImages,
  categories,
  newCategoryName,
  setNewCategoryName,
  error,
  setError,
  loading,
  submitLabel,
  onSubmit,
  fileRef,
  onUpload,
  uploadingCount,
  skuPrefix,
  skuCode,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  draft: DraftVariant;
  setDraft: React.Dispatch<React.SetStateAction<DraftVariant>>;
  variants: FormVariant[];
  setVariants: React.Dispatch<React.SetStateAction<FormVariant[]>>;
  images: ProductImageDraft[];
  setImages: React.Dispatch<React.SetStateAction<ProductImageDraft[]>>;
  categories: Category[];
  newCategoryName: string;
  setNewCategoryName: React.Dispatch<React.SetStateAction<string>>;
  error: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  submitLabel: string;
  onSubmit: () => Promise<void>;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (file: File) => Promise<void>;
  uploadingCount: number;
  skuPrefix?: string;
  skuCode?: string;
}) {
  const productCode = skuPrefix && skuCode ? baseSku(skuPrefix, skuCode) : undefined;
  const draftSku = previewVariantSku(skuPrefix, skuCode, draft.color, draft.size);

  function saveNewCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      setError("Enter a category name");
      return;
    }
    setError("");
  }

  function addVariant() {
    if (!draft.color.trim()) {
      setError("Select a color");
      return;
    }
    if (!draft.size.trim()) {
      setError("Select a size (use Free Size if the product has no size)");
      return;
    }
    if (draft.qty === "") {
      setError("Enter a quantity before adding");
      return;
    }
    const qty = Number(draft.qty);
    if (!Number.isFinite(qty) || qty < 0) {
      setError("Quantity must be 0 or more");
      return;
    }
    const exists = variants.some(
      (v) =>
        v.color.toLowerCase() === draft.color.toLowerCase() &&
        v.size.toLowerCase() === draft.size.toLowerCase()
    );
    if (exists) {
      setError("That color and size combination already exists");
      return;
    }
    const next = [...variants, { color: draft.color, size: draft.size, qty }];
    setVariants(next);
    setForm((f) => ({
      ...f,
      stock: String(next.reduce((sum, v) => sum + coerceVariantQty(v.qty), 0)),
    }));
    setDraft(emptyDraft());
    setError("");
  }

  function removeVariant(index: number) {
    const next = variants.filter((_, i) => i !== index);
    setVariants(next);
    setForm((f) => ({
      ...f,
      stock: totalStock(next, f.stock),
    }));
  }

  function updateVariantQty(index: number, raw: string) {
    if (raw.trim() === "") {
      const next = variants.map((v, i) => (i === index ? { ...v, qty: "" as const } : v));
      setVariants(next);
      setForm((f) => ({
        ...f,
        stock: String(next.reduce((sum, v) => sum + coerceVariantQty(v.qty), 0)),
      }));
      return;
    }
    if (!/^\d+$/.test(raw.trim())) return;
    const qty = Math.floor(Number(raw));
    if (!Number.isFinite(qty) || qty < 0) return;
    const next = variants.map((v, i) => (i === index ? { ...v, qty } : v));
    setVariants(next);
    setForm((f) => ({
      ...f,
      stock: String(next.reduce((sum, v) => sum + coerceVariantQty(v.qty), 0)),
    }));
  }

  function updateVariantField(index: number, field: "color" | "size", value: string) {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value, sku: undefined } : v))
    );
    setError("");
  }

  function validateVariants(): string | null {
    if (!variants.length) return null;
    const missing = variants.findIndex((v) => !v.color?.trim() || !v.size?.trim());
    if (missing >= 0) {
      return `Variant ${missing + 1} needs both a color and a size (use Free Size if there is no size)`;
    }
    return null;
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const removed = prev[index];
      if (removed?.file) URL.revokeObjectURL(removed.url);
      const next = prev.filter((_, i) => i !== index);
      setForm((f) => ({ ...f, image: next[0]?.url ?? "" }));
      return next;
    });
  }

  return (
    <form
      className="flex h-full flex-col"
      onSubmit={async (e) => {
        e.preventDefault();
        const variantError = validateVariants();
        if (variantError) {
          setError(variantError);
          return;
        }
        await onSubmit();
      }}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(240px,0.85fr)_1.15fr]">
        <div>
          <p className="mb-1.5 text-[12px] font-medium text-[#6b7280]">
            Product Images <span className="text-red-500">*</span>
          </p>
          <button
            type="button"
            disabled={uploadingCount > 0}
            onClick={() => fileRef.current?.click()}
            className="flex h-35 w-full flex-col items-center justify-center rounded-lg border border-dashed border-neutral-border bg-[#fafbfc] text-neutral-muted hover:border-[#2563EB] hover:text-[#2563EB] disabled:cursor-wait disabled:opacity-70"
          >
            {uploadingCount > 0 ? (
              <>
                <Loader2 className="mb-2 h-6 w-6 animate-spin text-[#2563EB]" />
                <span className="text-[12px] text-[#2563EB]">
                  Uploading {uploadingCount} {uploadingCount === 1 ? "image" : "images"}…
                </span>
              </>
            ) : (
              <>
                <Upload className="mb-2 h-6 w-6" />
                <span className="text-[12px]">Upload multiple images</span>
              </>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (!files?.length) return;
              void Promise.all(Array.from(files).map((file) => onUpload(file)));
              e.target.value = "";
            }}
          />
          {images.length || uploadingCount > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {images.map((img, index) => (
                <div
                  key={`${img.url}-${index}`}
                  className="rounded-lg border border-[#e5e7eb] bg-white"
                >
                  <div className="relative aspect-square overflow-hidden rounded-t-lg bg-[#f8fafc]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#EF4444] text-white"
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" strokeWidth={2.5} />
                    </button>
                  </div>
                  <Select
                    value={img.color}
                    onChange={(v) =>
                      setImages((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, color: v } : item))
                      )
                    }
                    options={[
                      { value: "", label: "Global (Default)" },
                      ...COLOR_OPTIONS.map((c) => ({ value: c, label: c })),
                    ]}
                    className="h-9 rounded-none border-0 border-t border-[#e5e7eb] px-2 text-[12px] focus:border-[#e5e7eb]"
                    ariaLabel="Assign image color"
                  />
                </div>
              ))}
              {Array.from({ length: uploadingCount }).map((_, i) => (
                <div
                  key={`uploading-${i}`}
                  className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-white"
                >
                  <div className="flex aspect-square animate-pulse items-center justify-center bg-[#f1f5f9]">
                    <Loader2 className="h-6 w-6 animate-spin text-[#2563EB]" />
                  </div>
                  <div className="flex h-9 items-center justify-center border-t border-[#e5e7eb] text-[11px] text-neutral-muted">
                    Uploading…
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-3">
          <label className="block text-[12px] font-medium text-[#6b7280]">
            Product Name <span className="text-red-500">*</span>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Cargo Trousers for Men"
              className={fieldClass}
            />
          </label>
          {productCode ? (
            <div className="-mt-1 flex flex-wrap items-center gap-2 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-2">
              <span className="text-[11px] text-[#64748b]">Product code</span>
              <span className="font-mono text-[12px] font-semibold tabular-nums text-[#0f172a]">
                {productCode}
              </span>
              <span className="text-[11px] text-[#94a3b8]">· shared by all variants</span>
            </div>
          ) : form.title.trim().length >= 2 ? (
            <p className="-mt-1 text-[11px] text-[#94a3b8]">Resolving next SKU code…</p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-medium text-[#6b7280]">
              Price <span className="text-red-500">*</span>
              <input
                required
                type="number"
                min={0.01}
                step="0.01"
                placeholder="$00.00"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className={fieldClass}
              />
            </label>
            <label className="block text-[12px] font-medium text-[#6b7280]">
              Total Quantity
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.stock}
                readOnly={variants.length > 1}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value !== "" && !/^\d+$/.test(value)) return;
                  setForm((f) => ({ ...f, stock: value }));
                  if (variants.length === 1) {
                    const qty: number | "" = value.trim() === "" ? "" : Math.floor(Number(value));
                    setVariants([{ ...variants[0], qty }]);
                  }
                }}
                className={`${fieldClass} read-only:bg-[#f8fafc]`}
              />
              {variants.length > 1 ? (
                <span className="mt-1 block text-[11px] font-normal text-[#94a3b8]">
                  Sum of variant quantities — edit qtys below to update stock
                </span>
              ) : null}
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="block text-[12px] font-medium text-[#6b7280]">
              Category <span className="text-red-500">*</span>
              <div className="mt-1.5">
                <Select
                  value={form.categoryId}
                  buttonClass="!uppercase"
                  onChange={(value) => {
                    setForm((f) => ({
                      ...f,
                      categoryId: value === NEW_CATEGORY ? NEW_CATEGORY : value,
                    }));
                    if (value !== NEW_CATEGORY) setNewCategoryName("");
                  }}
                  options={[
                    ...categories.map((c) => ({ value: c.id, label: c.name })),
                    {
                      value: NEW_CATEGORY,
                      label: "+ Create New Category",
                      accent: true,
                      className:
                        "sticky -bottom-0 uppercase w-full z-30 bg-white border-t border-[#e5e7eb]",
                    },
                  ]}
                  placeholder="Select Category"
                  ariaLabel="Category"
                  searchable
                  searchPlaceholder="Search category…"
                />
              </div>
            </div>
            <div className="block text-[12px] font-medium text-[#6b7280]">
              Status
              <div className="mt-1.5">
                <Select
                  value={form.isActive ? "ACTIVE" : "INACTIVE"}
                  onChange={(v) => setForm((f) => ({ ...f, isActive: v === "ACTIVE" }))}
                  options={[
                    { value: "ACTIVE", label: "ACTIVE" },
                    { value: "INACTIVE", label: "INACTIVE" },
                  ]}
                  ariaLabel="Product status"
                />
              </div>
            </div>
          </div>
          {form.categoryId === NEW_CATEGORY ? (
            <div className="flex gap-2">
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New category name"
                className="h-10 min-w-0 flex-1 rounded-md border border-neutral-border px-3 text-[13px] text-neutral-text outline-none focus:border-[#2563EB]"
              />
              <button
                type="button"
                onClick={saveNewCategory}
                className="shrink-0 rounded-md bg-[#2563EB] px-3 text-[13px] font-medium text-white hover:bg-brand-600"
              >
                Add
              </button>
            </div>
          ) : null}

          <div className="pt-2">
            <p className="mb-2 text-[12px] font-medium text-[#6b7280]">Add Product Variants</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
              <Select
                value={draft.color}
                onChange={(v) => setDraft((d) => ({ ...d, color: v }))}
                options={[
                  { value: "", label: "Select Color" },
                  ...COLOR_OPTIONS.map((c) => ({ value: c, label: c })),
                ]}
                ariaLabel="Color"
              />
              <Select
                value={draft.size}
                onChange={(v) => setDraft((d) => ({ ...d, size: v }))}
                options={[
                  { value: "", label: "Select Size" },
                  ...SIZE_OPTIONS.map((s) => ({ value: s, label: s })),
                ]}
                ariaLabel="Size"
              />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Enter Qty"
                value={draft.qty}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value !== "" && !/^\d+$/.test(value)) return;
                  setDraft((d) => ({ ...d, qty: value }));
                }}
                className="h-10 w-full rounded-md border border-neutral-border px-3 text-[13px] text-neutral-text outline-none focus:border-[#2563EB]"
                aria-label="Quantity"
              />
              <button
                type="button"
                onClick={addVariant}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-[#2563EB] text-[13px] font-medium text-white transition hover:bg-brand-600 sm:w-10"
                aria-label="Add color and size"
              >
                <Plus className="h-5 w-5" strokeWidth={2.5} />
                <span className="sm:hidden">Add</span>
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {draftSku ? (
                <div className="rounded-md border border-dashed border-[#bfdbfe] bg-[#f8fbff] px-3 py-2">
                  <p className="mb-1 text-[11px] text-[#64748b]">Next variant will get</p>
                  <SkuBadge sku={draftSku} preview />
                </div>
              ) : null}
              {variants.map((v, index) => {
                const sku =
                  (v.size?.trim() && v.color?.trim()
                    ? v.sku || previewVariantSku(skuPrefix, skuCode, v.color, v.size)
                    : null) || null;
                const isPreview = !v.sku;
                const sizeMissing = !v.size?.trim();
                return (
                  <div
                    key={`${v.color}-${v.size}-${index}`}
                    className={`rounded-lg border bg-white ${
                      sizeMissing ? "border-red-300" : "border-[#e5e7eb]"
                    }`}
                  >
                    <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
                      <Select
                        value={v.color}
                        onChange={(color) => updateVariantField(index, "color", color)}
                        options={[
                          { value: "", label: "Select Color" },
                          ...COLOR_OPTIONS.map((c) => ({ value: c, label: c })),
                          ...(v.color && !COLOR_OPTIONS.includes(v.color)
                            ? [{ value: v.color, label: v.color }]
                            : []),
                        ]}
                        ariaLabel={`Color for variant ${index + 1}`}
                      />
                      <Select
                        value={v.size}
                        onChange={(size) => updateVariantField(index, "size", size)}
                        options={[
                          { value: "", label: "Select Size" },
                          ...SIZE_OPTIONS.map((s) => ({ value: s, label: s })),
                          ...(v.size && !SIZE_OPTIONS.includes(v.size)
                            ? [{ value: v.size, label: v.size }]
                            : []),
                        ]}
                        ariaLabel={`Size for variant ${index + 1}`}
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={v.qty === "" ? "" : String(v.qty)}
                        onChange={(e) => updateVariantQty(index, e.target.value)}
                        className="h-10 w-full rounded-md border border-neutral-border px-3 text-[13px] tabular-nums text-neutral-text outline-none focus:border-[#2563EB]"
                        aria-label={`Quantity for ${v.color} ${v.size}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeVariant(index)}
                        className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md text-[#EF4444] transition hover:bg-red-50 sm:w-10"
                        aria-label="Remove variant"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="text-[12px] font-medium sm:hidden">Remove</span>
                      </button>
                    </div>
                    {sizeMissing ? (
                      <p className="rounded-b-lg border-t border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-600">
                        Size is required — pick Free Size if this product has no size
                      </p>
                    ) : sku ? (
                      <div className="rounded-b-lg border-t border-[#eef2f7] bg-[#f8fafc] px-3 py-2">
                        <SkuBadge sku={sku} preview={isPreview} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {error ? <p className="mt-4 text-[12px] text-red-500">{error}</p> : null}

      <div className="mt-auto flex justify-end pt-8">
        <button
          type="submit"
          disabled={loading || uploadingCount > 0}
          className="min-w-30 rounded-md bg-[#2563EB] px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {loading ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

export type { ProductSavePayload };

function revokeDraftImages(items: ProductImageDraft[]) {
  for (const img of items) {
    if (img.file) URL.revokeObjectURL(img.url);
  }
}

function buildSavePayload(
  form: FormState,
  variants: FormVariant[],
  images: ProductImageDraft[],
  newCategoryName: string
): ProductSavePayload {
  const normalizedVariants = variants.map((v) => ({
    ...v,
    qty: coerceVariantQty(v.qty),
  }));
  const stock =
    normalizedVariants.length > 0
      ? normalizedVariants.reduce((sum, v) => sum + v.qty, 0)
      : Number(form.stock) || 0;
  const isNewCategory = form.categoryId === NEW_CATEGORY;
  return {
    title: form.title,
    price: Number(form.price),
    stock,
    image: images[0]?.file ? undefined : images[0]?.url,
    images,
    color: normalizedVariants[0]?.color,
    size: normalizedVariants[0]?.size,
    variants: normalizedVariants,
    categoryId: isNewCategory ? null : form.categoryId,
    categoryName: isNewCategory ? newCategoryName.trim() : undefined,
    isActive: form.isActive,
  };
}

function useCategoryLoader(open: boolean) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");

  useEffect(() => {
    if (!open) return;
    void fetchAdminCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [open]);

  return { categories, setCategories, newCategoryName, setNewCategoryName };
}

export function AddProductDrawer({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: ProductSavePayload) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [draft, setDraft] = useState<DraftVariant>(emptyDraft);
  const [variants, setVariants] = useState<FormVariant[]>([]);
  const [images, setImages] = useState<ProductImageDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState("");
  const [skuPrefix, setSkuPrefix] = useState<string>();
  const [skuCode, setSkuCode] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const { categories, newCategoryName, setNewCategoryName } = useCategoryLoader(open);

  // Reset the form whenever the drawer opens (state adjustment during render).
  const [prevOpen, setPrevOpen] = useState(false);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setImages((prev) => {
        revokeDraftImages(prev);
        return [];
      });
      setForm(emptyForm());
      setDraft(emptyDraft());
      setVariants([]);
      setUploadingCount(0);
      setNewCategoryName("");
      setError("");
      setSkuPrefix(undefined);
      setSkuCode(undefined);
    }
  }

  useEffect(() => {
    if (!open) return;
    const title = form.title.trim();
    if (title.length < 2) {
      setTimeout(() => setSkuPrefix(undefined), 0);
      setTimeout(() => setSkuCode(undefined), 0);
      return;
    }
    setTimeout(() => setSkuPrefix(extractTitlePrefix(title)), 0);
    const t = window.setTimeout(() => {
      void fetchNextSku(title)
        .then((data) => {
          if (data.titlePrefix) setSkuPrefix(data.titlePrefix);
          if (data.nextCode) setSkuCode(data.nextCode);
        })
        .catch(() => {
          /* preview only */
        });
    }, 350);
    return () => window.clearTimeout(t);
  }, [form.title, open]);

  async function onUpload(file: File) {
    const url = URL.createObjectURL(file);
    setImages((prev) => {
      const next = [...prev, { url, color: "", file }];
      setForm((f) => ({ ...f, image: next[0]?.url ?? "" }));
      return next;
    });
  }

  return (
    <Drawer open={open} onClose={onClose} title="Add a Single Product" widthClassName="max-w-225">
      <ProductFormFields
        form={form}
        setForm={setForm}
        draft={draft}
        setDraft={setDraft}
        variants={variants}
        setVariants={setVariants}
        images={images}
        setImages={setImages}
        categories={categories}
        newCategoryName={newCategoryName}
        setNewCategoryName={setNewCategoryName}
        error={error}
        setError={setError}
        loading={loading}
        submitLabel="Save"
        fileRef={fileRef}
        onUpload={onUpload}
        uploadingCount={uploadingCount}
        skuPrefix={skuPrefix}
        skuCode={skuCode}
        onSubmit={async () => {
          if (!form.categoryId || (form.categoryId === NEW_CATEGORY && !newCategoryName.trim())) {
            setError("Select or create a category first");
            return;
          }
          if (!images.length) {
            setError("Upload at least one product image");
            return;
          }
          setLoading(true);
          setError("");
          try {
            await onSave(buildSavePayload(form, variants, images, newCategoryName));
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
          } finally {
            setLoading(false);
          }
        }}
      />
    </Drawer>
  );
}

export function EditProductDrawer({
  open,
  product,
  onClose,
  onSave,
}: {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSave: (data: ProductSavePayload) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [draft, setDraft] = useState<DraftVariant>(emptyDraft);
  const [variants, setVariants] = useState<FormVariant[]>([]);
  const [images, setImages] = useState<ProductImageDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState("");
  const [skuPrefix, setSkuPrefix] = useState<string>();
  const [skuCode, setSkuCode] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const { categories, newCategoryName, setNewCategoryName } = useCategoryLoader(open);

  // Repopulate the form when the drawer opens or the product changes
  // (state adjustment during render).
  const [prev, setPrev] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null,
  });
  if (prev.open !== open || prev.product !== product) {
    setPrev({ open, product });
    if (open && product) {
      const nextVariants = variantsFromProduct(product).map((v) => ({
        ...v,
        size:
          !v.size?.trim() || ["na", "n/a", "-"].includes(v.size.trim().toLowerCase())
            ? "Free Size"
            : v.size,
      }));
      const rawImages = product.images?.length
        ? product.images.map((img) => ({
            url: img.url,
            color: img.color ?? "",
          }))
        : product.imageUrl
          ? [{ url: product.imageUrl, color: "" }]
          : [];
      const seenUrls = new Set<string>();
      const nextImages = rawImages.filter((img) => {
        if (!img.url || seenUrls.has(img.url)) return false;
        seenUrls.add(img.url);
        return true;
      });
      setForm({
        title: product.name,
        price: String(product.price),
        stock: totalStock(nextVariants, String(product.stock ?? 0)),
        image: nextImages[0]?.url ?? product.imageUrl,
        categoryId: product.categoryId ?? product.category?.id ?? "",
        isActive: product.isActive !== false,
      });
      setVariants(nextVariants);
      setImages((prev) => {
        revokeDraftImages(prev);
        return nextImages;
      });
      setUploadingCount(0);
      setDraft(emptyDraft());
      setNewCategoryName("");
      setError("");
      setSkuPrefix(product.titlePrefix || extractTitlePrefix(product.name));
      setSkuCode(product.code);
    }
  }

  useEffect(() => {
    if (!open || !product) return;
    const title = form.title.trim();
    if (title.length < 2) return;
    const prefix = extractTitlePrefix(title);
    setTimeout(() => setSkuPrefix(prefix), 0);
    // Title prefix change → preview next code for new prefix; same prefix keeps existing code
    if (product.titlePrefix && prefix === product.titlePrefix && product.code) {
      setTimeout(() => setSkuCode(product.code), 0);
      return;
    }
    const t = window.setTimeout(() => {
      void fetchNextSku(title)
        .then((data) => {
          if (data.titlePrefix) setSkuPrefix(data.titlePrefix);
          if (data.nextCode) setSkuCode(data.nextCode);
        })
        .catch(() => {});
    }, 350);
    return () => window.clearTimeout(t);
  }, [form.title, open, product]);

  async function onUpload(file: File) {
    const url = URL.createObjectURL(file);
    setImages((prev) => {
      const next = [...prev, { url, color: "", file }];
      setForm((f) => ({ ...f, image: next[0]?.url ?? "" }));
      return next;
    });
  }

  return (
    <Drawer
      open={open && !!product}
      onClose={onClose}
      title="Edit a Single Product"
      widthClassName="max-w-225"
    >
      <ProductFormFields
        form={form}
        setForm={setForm}
        draft={draft}
        setDraft={setDraft}
        variants={variants}
        setVariants={setVariants}
        images={images}
        setImages={setImages}
        categories={categories}
        newCategoryName={newCategoryName}
        setNewCategoryName={setNewCategoryName}
        error={error}
        setError={setError}
        loading={loading}
        submitLabel="Update"
        fileRef={fileRef}
        onUpload={onUpload}
        uploadingCount={uploadingCount}
        skuPrefix={skuPrefix}
        skuCode={skuCode}
        onSubmit={async () => {
          if (!form.categoryId || (form.categoryId === NEW_CATEGORY && !newCategoryName.trim())) {
            setError("Select or create a category first");
            return;
          }
          if (!images.length) {
            setError("Upload at least one product image");
            return;
          }
          setLoading(true);
          setError("");
          try {
            await onSave(buildSavePayload(form, variants, images, newCategoryName));
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Update failed");
          } finally {
            setLoading(false);
          }
        }}
      />
    </Drawer>
  );
}
