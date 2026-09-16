"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ArrowLeft, Plus, Send, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  type BulkProgressPhase,
  BulkUploadProgressModal,
} from "@/components/admin/BulkUploadProgressModal";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import {
  bulkUploadProductsJson,
  createAdminCategory,
  fetchAdminCategories,
  fetchAdminJobStatus,
  uploadAdminImage,
  validateAdminSkus,
} from "@/lib/api/admin";
import {
  type BulkDraftImage,
  type BulkDraftProduct,
  type BulkDraftVariant,
  useBulkUploadStore,
} from "@/lib/bulk-upload-store";
import {
  detectColorFromFileName,
  normalizeColor,
  normalizeSize,
  PRODUCT_COLOR_OPTIONS,
  PRODUCT_SIZE_OPTIONS,
  resolveCategoryName,
  selectSizeValue,
} from "@/lib/product-options";
import {
  DEFAULT_COLOR_CODES,
  extractTitlePrefix,
  generateVariantSku,
  parseSku,
  resolveColorCode,
} from "@/lib/sku";
import type { Category } from "@/types";

const COLOR_OPTIONS = [...PRODUCT_COLOR_OPTIONS];
const SIZE_OPTIONS = [...PRODUCT_SIZE_OPTIONS];
const NEW_CATEGORY = "__new__";

type FieldKey = "title" | "price" | "category" | "images" | "variants";

type FieldError = {
  field: FieldKey;
  message: string;
};

type CardValidationError = {
  productId: string;
  errors: FieldError[];
};

const fieldClass =
  "mt-1.5 h-10 w-full rounded-md border border-[#e5e7eb] bg-white px-3 text-[13px] text-[#111827] outline-none placeholder:text-[#9ca3af] focus:border-[#2563EB]";

const fieldErrorClass = "border-red-400 focus:border-red-500 bg-red-50/40";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function qtyNumber(qty: number | "" | undefined) {
  if (qty === "" || qty == null) return 0;
  const n = Number(qty);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/** Keep "" while clearing/typing; only accept non-negative integers. */
function parseQtyInput(raw: string): number | "" | null {
  if (raw.trim() === "") return "";
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function qtyInputValue(qty: number | "" | undefined) {
  return qty === "" || qty == null ? "" : String(qty);
}

function variantStock(variants: BulkDraftVariant[], fallback: number | "") {
  if (variants.length) return variants.reduce((sum, v) => sum + qtyNumber(v.qty), 0);
  return qtyNumber(fallback);
}

function colorOptionsFor(product: BulkDraftProduct) {
  const extra = new Set<string>();
  for (const v of product.variants) {
    const color = normalizeColor(v.color);
    if (color) extra.add(color);
  }
  for (const img of product.images) {
    const color = normalizeColor(img.color);
    if (color) extra.add(color);
  }
  return [
    ...COLOR_OPTIONS,
    ...[...extra].filter((c) => !COLOR_OPTIONS.some((o) => o.toLowerCase() === c.toLowerCase())),
  ];
}

function sizeOptionsFor(product: BulkDraftProduct) {
  const extra = new Set<string>();
  for (const v of product.variants) {
    const size = normalizeSize(v.size);
    if (size) extra.add(size);
  }
  return [
    ...SIZE_OPTIONS,
    ...[...extra].filter((s) => !SIZE_OPTIONS.some((o) => o.toLowerCase() === s.toLowerCase())),
  ];
}

function selectColorValue(raw: string, options: string[]) {
  const normalized = normalizeColor(raw);
  if (!normalized) return "";
  const match = options.find((o) => o.toLowerCase() === normalized.toLowerCase());
  return match || normalized;
}

/** Preview SKU for a variant — uses real code when updating an existing product. */
function previewVariantSku(product: BulkDraftProduct, variant: BulkDraftVariant): string | null {
  if (variant.sku?.trim()) return variant.sku.trim();
  if (!product.title.trim()) return null;

  const matched =
    parseSku(product.matchedSku || "") ||
    (product.skus ?? []).map((s) => parseSku(s)).find(Boolean) ||
    null;

  const titlePrefix = matched?.titlePrefix || extractTitlePrefix(product.title);
  const code = matched?.code || "???";
  const size = variant.size?.trim();
  if (!size) return null;
  const colorCode = resolveColorCode(
    variant.color,
    Object.entries(DEFAULT_COLOR_CODES).map(([name, c]) => ({ name, code: c }))
  );

  return generateVariantSku(titlePrefix, code, size, colorCode);
}

function variantMatchesExisting(
  variant: BulkDraftVariant,
  existing: Array<{ color: string; size: string; sku?: string }> | undefined,
  previewSku?: string | null
): boolean {
  if (!existing?.length) return false;
  const color = variant.color.trim().toLowerCase();
  const size = variant.size.trim().toLowerCase();
  const sku = (variant.sku || previewSku || "").trim().toLowerCase();

  return existing.some((e) => {
    if (sku && e.sku?.trim().toLowerCase() === sku) return true;
    return e.color.trim().toLowerCase() === color && e.size.trim().toLowerCase() === size;
  });
}

function markVariantsExisting(
  product: BulkDraftProduct,
  existingVariants?: Array<{ color: string; size: string; sku?: string }>
): BulkDraftVariant[] {
  return product.variants.map((v) => {
    const preview = previewVariantSku(
      { ...product, existingVariants: existingVariants ?? product.existingVariants },
      v
    );
    return {
      ...v,
      isExisting: variantMatchesExisting(v, existingVariants ?? product.existingVariants, preview),
    };
  });
}

function ProductCard({
  index,
  product,
  categories,
  validationError,
  cardRef,
  onChange,
  onRemove,
  onClearError,
  onCategoryCreated,
}: {
  index: number;
  product: BulkDraftProduct;
  categories: Category[];
  validationError?: CardValidationError | null;
  cardRef?: (node: HTMLDivElement | null) => void;
  onChange: (next: BulkDraftProduct) => void;
  onRemove: () => void;
  onClearError?: () => void;
  onCategoryCreated: (category: Category) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({ color: "", size: "", qty: "" });
  const [localError, setLocalError] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const colors = colorOptionsFor(product);
  const sizes = sizeOptionsFor(product);
  const isErrorCard = !!validationError?.errors.length;
  const errorFields = new Set(validationError?.errors.map((e) => e.field) ?? []);
  const hasFieldError = (field: FieldKey) => errorFields.has(field);

  const resolvedCategory = resolveCategoryName(product.categoryName, categories);
  const categoryValue = creatingCategory ? NEW_CATEGORY : (resolvedCategory?.categoryId ?? "");
  const categoryOptions = [
    ...categories.map((c) => ({ value: c.id, label: c.name })),
    {
      value: NEW_CATEGORY,
      label: "+ Create New Category",
      accent: true,
      className: "sticky -bottom-0 uppercase w-full z-30 bg-white border-t border-[#e5e7eb]",
    },
  ];

  const patch = (next: BulkDraftProduct) => {
    onClearError?.();
    onChange(next);
  };

  const saveNewCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setCategoryError("Enter a category name");
      return;
    }
    setSavingCategory(true);
    setCategoryError("");
    try {
      const category = await createAdminCategory(name);
      onCategoryCreated(category);
      setCreatingCategory(false);
      setNewCategoryName("");
      patch({ ...product, categoryName: category.name, fileCategoryName: undefined });
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setSavingCategory(false);
    }
  };

  const addVariant = () => {
    if (!draft.color.trim()) {
      setLocalError("Select a color");
      return;
    }
    if (!draft.size.trim()) {
      setLocalError("Select a size (use Free Size if the product has no size)");
      return;
    }
    if (draft.qty === "") {
      setLocalError("Enter a quantity before adding");
      return;
    }
    const qty = Number(draft.qty);
    if (!Number.isFinite(qty) || qty < 0) {
      setLocalError("Quantity must be 0 or more");
      return;
    }
    const exists = product.variants.some(
      (v) =>
        v.color.toLowerCase() === draft.color.toLowerCase() &&
        v.size.toLowerCase() === draft.size.toLowerCase()
    );
    if (exists) {
      setLocalError("That color and size combination already exists");
      return;
    }
    const variants = [
      ...product.variants,
      {
        color: normalizeColor(draft.color),
        size: normalizeSize(draft.size),
        qty,
        isExisting: false,
      },
    ];
    patch({ ...product, variants, stock: variantStock(variants, product.stock) });
    setDraft({ color: "", size: "", qty: "" });
    setLocalError("");
  };

  const onUploadFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const nextImages: BulkDraftImage[] = [...product.images];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const fromName = detectColorFromFileName(file.name);
      const matching = product.variants.find(
        (v) => fromName && v.color.toLowerCase() === fromName.toLowerCase()
      );
      // Tag image with a matching variant color only — never invent Black from the filename alone.
      nextImages.push({
        id: uid(),
        url: URL.createObjectURL(file),
        fileName: file.name,
        color: matching?.color || "",
        file,
      });
    }

    // Do not create/overwrite variants from image filenames (e.g. *_black.jpg → Black).
    patch({
      ...product,
      images: nextImages,
      stock: variantStock(product.variants, product.stock),
    });
  };

  const removeImage = (imgId: string) => {
    const target = product.images.find((i) => i.id === imgId);
    if (target?.file) URL.revokeObjectURL(target.url);
    patch({ ...product, images: product.images.filter((i) => i.id !== imgId) });
  };

  return (
    <div
      ref={cardRef}
      data-product-id={product.id}
      className={`rounded-xl border bg-white p-5 shadow-sm transition ${
        isErrorCard ? "border-red-400 ring-2 ring-red-200" : "border-[#e5e7eb]"
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-semibold text-[#111827]">
              <span className="text-[#2563EB]">#{index + 1}</span>{" "}
              {product.title.trim() || "Untitled Product"}
            </h2>
            {product.isUpdate && product.existingProductId ? (
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
                Update Product
              </span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                New Product
              </span>
            )}
          </div>
          {product.isUpdate && product.existingProductId ? (
            <p className="text-[12px] leading-snug text-[#64748b]">
              SKU{" "}
              <span className="font-mono font-medium text-[#334155]">
                {product.matchedSku || product.skus?.[0] || "—"}
              </span>{" "}
              already exists — submitted quantities will be added to current stock.
            </p>
          ) : product.unmatchedSkus?.length ? (
            <p className="text-[12px] leading-snug text-[#64748b]">
              SKU{" "}
              <span className="font-mono font-medium text-[#334155]">
                {product.unmatchedSkus.join(", ")}
              </span>{" "}
              not found — creating as a new product.
            </p>
          ) : !product.skus?.length ? (
            <p className="text-[12px] leading-snug text-[#64748b]">
              No SKU provided — creating as a new product.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-md p-1.5 text-[#EF4444] transition hover:bg-red-50"
          aria-label={`Remove product ${index + 1}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(240px,0.9fr)_1.1fr]">
        <div data-field="images">
          <p className="mb-1.5 text-[12px] font-medium text-[#6b7280]">
            Product Images{" "}
            {product.isUpdate && product.existingProductId ? (
              <span className="font-normal text-[#94a3b8]">(optional — keep existing)</span>
            ) : (
              <span className="text-red-500">*</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`flex h-36 w-full flex-col items-center justify-center rounded-lg border border-dashed bg-[#fafbfc] transition hover:border-[#2563EB] hover:text-[#2563EB] ${
              hasFieldError("images")
                ? "border-red-400 text-red-500"
                : "border-[#d1d5db] text-[#9ca3af]"
            }`}
          >
            <Upload className="mb-2 h-6 w-6" />
            <span className="text-[12px]">
              {product.isUpdate && product.existingProductId
                ? "Add more images (optional)"
                : "Upload multiple images"}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              onUploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {hasFieldError("images") ? (
            <p className="mt-1.5 text-[12px] text-red-500">At least one image is required</p>
          ) : null}
          {product.images.length ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {product.images.map((img) => (
                <div
                  key={img.id}
                  className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-white"
                >
                  <div className="relative aspect-square bg-[#f8fafc]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#EF4444] text-white"
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" strokeWidth={2.5} />
                    </button>
                  </div>
                  <Select
                    value={selectColorValue(img.color, colors)}
                    onChange={(v) =>
                      patch({
                        ...product,
                        images: product.images.map((item) =>
                          item.id === img.id ? { ...item, color: normalizeColor(v) } : item
                        ),
                      })
                    }
                    options={[
                      { value: "", label: "Global (Default)" },
                      ...colors.map((c) => ({ value: c, label: c })),
                    ]}
                    className="h-9 rounded-none border-0 border-t border-[#e5e7eb] px-2 text-[12px] focus:border-[#e5e7eb]"
                    ariaLabel="Assign image color"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-3">
          <label className="block text-[12px] font-medium text-[#6b7280]" data-field="title">
            Product Name <span className="text-red-500">*</span>
            <input
              value={product.title}
              onChange={(e) => patch({ ...product, title: e.target.value })}
              placeholder="e.g. Product name"
              className={`${fieldClass} ${hasFieldError("title") ? fieldErrorClass : ""}`}
            />
            {hasFieldError("title") ? (
              <p className="mt-1.5 text-[12px] font-normal text-red-500">
                Product name is required
              </p>
            ) : null}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-medium text-[#6b7280]" data-field="price">
              Price <span className="text-red-500">*</span>
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={product.price || ""}
                onChange={(e) => patch({ ...product, price: parseFloat(e.target.value) || 0 })}
                className={`${fieldClass} ${hasFieldError("price") ? fieldErrorClass : ""}`}
              />
              {hasFieldError("price") ? (
                <p className="mt-1.5 text-[12px] font-normal text-red-500">
                  Price must be greater than 0
                </p>
              ) : null}
            </label>
            <label className="block text-[12px] font-medium text-[#6b7280]">
              Total Quantity
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={
                  product.variants.length === 1
                    ? qtyInputValue(product.variants[0].qty)
                    : product.variants.length > 1
                      ? String(variantStock(product.variants, product.stock))
                      : qtyInputValue(product.stock)
                }
                readOnly={product.variants.length > 1}
                onChange={(e) => {
                  const parsed = parseQtyInput(e.target.value);
                  if (parsed === null) return;
                  if (product.variants.length === 1) {
                    const variants = [{ ...product.variants[0], qty: parsed }];
                    patch({
                      ...product,
                      stock: parsed === "" ? "" : parsed,
                      variants,
                    });
                    return;
                  }
                  patch({ ...product, stock: parsed === "" ? "" : parsed });
                }}
                className={`${fieldClass} read-only:bg-[#f8fafc]`}
              />
              {product.variants.length > 1 ? (
                <span className="mt-1 block text-[11px] font-normal text-[#94a3b8]">
                  Sum of variant quantities — edit qtys below to update stock
                </span>
              ) : null}
            </label>
          </div>

          <div className="block text-[12px] font-medium text-[#6b7280]" data-field="category">
            Category <span className="text-red-500">*</span>
            <div className="mt-1.5">
              <Select
                value={categoryValue}
                buttonClass="!uppercase"
                onChange={(value) => {
                  if (value === NEW_CATEGORY) {
                    setCreatingCategory(true);
                    setNewCategoryName(product.fileCategoryName?.trim() || "");
                    setCategoryError("");
                    patch({ ...product, categoryName: "" });
                    return;
                  }
                  setCreatingCategory(false);
                  setNewCategoryName("");
                  setCategoryError("");
                  const cat = categories.find((c) => c.id === value);
                  patch({ ...product, categoryName: cat?.name || "" });
                }}
                options={categoryOptions}
                placeholder="Select Category"
                ariaLabel="Category"
                searchable
                searchPlaceholder="Search category…"
                className={hasFieldError("category") ? fieldErrorClass : undefined}
              />
            </div>
            {creatingCategory ? (
              <div className="mt-2 flex gap-2">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category name"
                  className="h-10 min-w-0 flex-1 rounded-md border border-neutral-border px-3 text-[13px] text-neutral-text outline-none focus:border-[#2563EB]"
                />
                <button
                  type="button"
                  disabled={savingCategory}
                  onClick={() => void saveNewCategory()}
                  className="shrink-0 rounded-md bg-[#2563EB] px-3 text-[13px] font-medium text-white hover:bg-brand-600 disabled:opacity-60"
                >
                  {savingCategory ? "Adding…" : "Add"}
                </button>
              </div>
            ) : null}
            {categoryError ? (
              <p className="mt-1.5 text-[12px] font-normal text-red-500">{categoryError}</p>
            ) : null}
            {hasFieldError("category") ? (
              <p className="mt-1.5 text-[12px] font-normal text-red-500">Category is required</p>
            ) : null}
          </div>

          <div className="pt-2" data-field="variants">
            <p className="mb-2 text-[12px] font-medium text-[#6b7280]">
              Add Product Variants <span className="text-red-500">*</span>
            </p>
            <div
              className={`rounded-lg ${
                hasFieldError("variants") ? "border border-red-300 bg-red-50/50 p-2" : ""
              }`}
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                <Select
                  value={draft.color}
                  onChange={(v) => setDraft((d) => ({ ...d, color: v }))}
                  options={[
                    { value: "", label: "Select Color" },
                    ...colors.map((c) => ({ value: c, label: c })),
                  ]}
                  ariaLabel="Color"
                />
                <Select
                  value={draft.size}
                  onChange={(v) => setDraft((d) => ({ ...d, size: v }))}
                  options={[
                    { value: "", label: "Select Size" },
                    ...sizes.map((s) => ({ value: s, label: s })),
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
                  className="h-10 w-full rounded-md border border-[#e5e7eb] px-3 text-[13px] outline-none focus:border-[#2563EB]"
                  aria-label="Quantity"
                />
                <button
                  type="button"
                  onClick={addVariant}
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-[#2563EB] text-[13px] font-medium text-white transition hover:bg-brand-600 sm:w-10"
                  aria-label="Add variant"
                >
                  <Plus className="h-5 w-5" strokeWidth={2.5} />
                  <span className="sm:hidden">Add</span>
                </button>
              </div>

              <div className="mt-2 space-y-2">
                {product.variants.map((v, vIdx) => {
                  const previewSku = previewVariantSku(product, v);
                  const isCodePending = Boolean(previewSku?.includes("-???-"));
                  const isExisting =
                    v.isExisting ?? variantMatchesExisting(v, product.existingVariants, previewSku);
                  return (
                    <div
                      key={`${v.color}-${v.size}-${vIdx}`}
                      className={`space-y-1 rounded-lg border p-2 ${
                        isExisting
                          ? "border-blue-100 bg-blue-50/40"
                          : "border-emerald-100 bg-emerald-50/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 px-0.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            isExisting
                              ? "bg-blue-100 text-blue-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {isExisting ? "Existing variant" : "New variant"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
                        <Select
                          value={selectColorValue(v.color, colors)}
                          onChange={(color) => {
                            const variants = product.variants.map((item, i) => {
                              if (i !== vIdx) return item;
                              const next = {
                                ...item,
                                color: normalizeColor(color),
                                sku: undefined,
                              };
                              const preview = previewVariantSku(product, next);
                              return {
                                ...next,
                                isExisting: variantMatchesExisting(
                                  next,
                                  product.existingVariants,
                                  preview
                                ),
                              };
                            });
                            patch({ ...product, variants });
                          }}
                          options={[
                            { value: "", label: "Select Color" },
                            ...colors.map((c) => ({ value: c, label: c })),
                          ]}
                          ariaLabel={`Color for variant ${vIdx + 1}`}
                        />
                        <Select
                          value={selectSizeValue(v.size, sizes)}
                          onChange={(size) => {
                            const variants = product.variants.map((item, i) => {
                              if (i !== vIdx) return item;
                              const next = { ...item, size: normalizeSize(size), sku: undefined };
                              const preview = previewVariantSku(product, next);
                              return {
                                ...next,
                                isExisting: variantMatchesExisting(
                                  next,
                                  product.existingVariants,
                                  preview
                                ),
                              };
                            });
                            patch({ ...product, variants });
                          }}
                          options={[
                            { value: "", label: "Select Size" },
                            ...sizes.map((s) => ({ value: s, label: s })),
                          ]}
                          ariaLabel={`Size for variant ${vIdx + 1}`}
                        />
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={qtyInputValue(v.qty)}
                          onChange={(e) => {
                            const parsed = parseQtyInput(e.target.value);
                            if (parsed === null) return;
                            const variants = product.variants.map((item, i) =>
                              i === vIdx ? { ...item, qty: parsed } : item
                            );
                            patch({
                              ...product,
                              variants,
                              stock: variantStock(variants, qtyNumber(product.stock)),
                            });
                          }}
                          className="h-10 w-full rounded-md border border-[#e5e7eb] bg-white px-3 text-[13px] tabular-nums outline-none focus:border-[#2563EB]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const variants = product.variants.filter((_, i) => i !== vIdx);
                            patch({
                              ...product,
                              variants,
                              stock: variantStock(variants, product.stock),
                            });
                          }}
                          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md text-[#EF4444] transition hover:bg-red-50 sm:w-10"
                          aria-label="Remove variant"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="text-[12px] font-medium sm:hidden">Remove</span>
                        </button>
                      </div>
                      {previewSku ? (
                        <p className="text-[11px] tabular-nums text-[#64748b]">
                          SKU: <span className="font-medium text-[#111827]">{previewSku}</span>
                          {isCodePending ? (
                            <span className="ml-1 font-normal text-[#94a3b8]">
                              (code assigned on submit)
                            </span>
                          ) : isExisting ? (
                            <span className="ml-1 font-normal text-blue-600">
                              · will add to stock
                            </span>
                          ) : (
                            <span className="ml-1 font-normal text-emerald-600">· will create</span>
                          )}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
            {hasFieldError("variants") ? (
              <p className="mt-1.5 text-[12px] text-red-500">Add at least one color/size variant</p>
            ) : null}
            {localError ? <p className="mt-2 text-[12px] text-red-500">{localError}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BulkAddProductsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const products = useBulkUploadStore((s) => s.products);
  const setProducts = useBulkUploadStore((s) => s.setProducts);
  const updateProduct = useBulkUploadStore((s) => s.updateProduct);
  const removeProduct = useBulkUploadStore((s) => s.removeProduct);
  const addProduct = useBulkUploadStore((s) => s.addProduct);
  const clear = useBulkUploadStore((s) => s.clear);

  const [categories, setCategories] = useState<Category[]>([]);
  const [validationErrors, setValidationErrors] = useState<CardValidationError[]>([]);
  const [progressOpen, setProgressOpen] = useState(false);
  const [phase, setPhase] = useState<BulkProgressPhase>("images");
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [progressMessage, setProgressMessage] = useState<string>();
  const [progressError, setProgressError] = useState<string>();
  const hasProducts = products.length > 0;
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  const errorsByProductId = useMemo(() => {
    const map = new Map<string, CardValidationError>();
    for (const item of validationErrors) map.set(item.productId, item);
    return map;
  }, [validationErrors]);

  const scrollToFirstError = useCallback((errors: CardValidationError[]) => {
    const first = errors[0];
    if (!first) return;
    const card = cardRefs.current.get(first.productId);
    if (!card) return;

    // Start from the top of the first invalid card, then settle on first bad field.
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    const firstField = first.errors[0]?.field;
    if (!firstField) return;

    window.setTimeout(() => {
      const section = card.querySelector(`[data-field="${firstField}"]`) as HTMLElement | null;
      section?.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusable = section?.querySelector<HTMLElement>(
        "input, button, [role='button'], select, textarea"
      );
      focusable?.focus({ preventScroll: true });
    }, 320);
  }, []);

  const clearProductError = useCallback((productId: string) => {
    setValidationErrors((prev) => prev.filter((e) => e.productId !== productId));
  }, []);

  useEffect(() => {
    void fetchAdminCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // Validate CSV SKUs once when products land on the review page
  useEffect(() => {
    const snapshot = products;
    if (!snapshot.length) return;

    const allSkus = snapshot.flatMap((p) => p.skus ?? []).filter(Boolean);
    let cancelled = false;

    const applyClassification = (
      matchedBySku: Map<
        string,
        {
          sku: string;
          productId: string;
          productTitle: string;
          specificationId?: string;
          existingVariants?: Array<{ color: string; size: string; sku?: string }>;
        }
      >
    ) => {
      if (cancelled) return;
      const next = snapshot.map((p) => {
        const skus = (p.skus ?? []).map((s) => s.trim()).filter(Boolean);
        if (!skus.length) {
          return {
            ...p,
            isUpdate: false,
            existingProductId: undefined,
            matchedSku: undefined,
            unmatchedSkus: [],
            existingVariants: [],
            variants: p.variants.map((v) => ({ ...v, isExisting: false })),
          };
        }
        const hit = skus.map((s) => matchedBySku.get(s.toLowerCase())).find(Boolean);
        const unmatched = skus.filter((s) => !matchedBySku.has(s.toLowerCase()));
        if (hit) {
          const existingVariants = hit.existingVariants ?? [];
          const base: BulkDraftProduct = {
            ...p,
            isUpdate: true,
            existingProductId: hit.productId,
            matchedSku: hit.sku,
            unmatchedSkus: unmatched,
            existingVariants,
          };
          return {
            ...base,
            variants: markVariantsExisting(base, existingVariants),
          };
        }
        return {
          ...p,
          isUpdate: false,
          existingProductId: undefined,
          matchedSku: undefined,
          unmatchedSkus: unmatched,
          existingVariants: [],
          variants: p.variants.map((v) => ({ ...v, isExisting: false })),
        };
      });
      setProducts(next);
    };

    if (!allSkus.length) {
      applyClassification(new Map());
      return;
    }

    void validateAdminSkus(allSkus)
      .then((result) => {
        if (cancelled) return;
        const matchedBySku = new Map(result.matched.map((m) => [m.sku.toLowerCase(), m]));
        if (result.unmatched.length) {
          toast.warning(
            result.unmatched.length === 1
              ? `Product with SKU '${result.unmatched[0]}' not found; will be created as new.`
              : `${result.unmatched.length} SKUs entered weren't found and will be created as new products`
          );
        }
        if (result.matched.length) {
          toast.info(
            result.matched.length === 1
              ? `SKU '${result.matched[0].sku}' matches an existing product — will update.`
              : `${result.matched.length} SKUs match existing products — those rows will update.`
          );
        }
        applyClassification(matchedBySku);
      })
      .catch(() => {
        // On validation failure, treat all as new products
        applyClassification(new Map());
      });
    return () => {
      cancelled = true;
    };
    // Only on initial product load from CSV
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Map CSV category onto existing Select options only; clear unmatched names.
  // Keep fileCategoryName so "Create New Category" can auto-fill from the file.
  useEffect(() => {
    if (!categories.length) return;
    const current = useBulkUploadStore.getState().products;
    if (!current.length) return;

    let changed = false;
    const next = current.map((p) => {
      const fromFile = (p.fileCategoryName || p.categoryName || "").trim();
      const resolved = resolveCategoryName(p.categoryName || fromFile, categories);
      const categoryName = resolved?.categoryName ?? "";
      const fileCategoryName = resolved ? undefined : fromFile || undefined;

      const variants = p.variants.map((v) => {
        const color = normalizeColor(v.color);
        const size = normalizeSize(v.size);
        if (color !== v.color || size !== v.size) changed = true;
        return { ...v, color, size };
      });

      const images = p.images.map((img) => {
        // Keep whatever the user set — do not re-apply filename colors (cleared color stayed Black).
        const color = normalizeColor(img.color);
        if (color !== img.color) changed = true;
        return { ...img, color };
      });

      if (categoryName !== p.categoryName || fileCategoryName !== p.fileCategoryName) {
        changed = true;
      }

      return { ...p, categoryName, fileCategoryName, variants, images };
    });

    if (changed) setProducts(next);
  }, [categories, setProducts]);

  const title = useMemo(() => `Bulk Add Products (${products.length})`, [products.length]);

  const goBack = useCallback(() => {
    clear();
    router.push("/admin/products");
  }, [clear, router]);

  const pollJob = async (jobId: string, productTotal: number) => {
    setPhase("processing");
    setTotal(productTotal);
    setCurrent(0);
    setProgressMessage(`Processing products (0/${productTotal})...`);

    const started = Date.now();
    while (Date.now() - started < 5 * 60_000) {
      await new Promise((r) => setTimeout(r, 900));
      try {
        const status = await fetchAdminJobStatus(jobId);
        if (status.state === "PROGRESS" && status.meta) {
          const cur = Number(status.meta.current ?? 0);
          const tot = Number(status.meta.total ?? productTotal);
          setCurrent(cur);
          setTotal(tot);
          setProgressMessage(`Processing products (${cur}/${tot})...`);
        } else if (status.state === "SUCCESS") {
          setCurrent(productTotal);
          setTotal(productTotal);
          setPhase("done");
          setProgressMessage("Bulk upload complete");
          return;
        } else if (status.state === "FAILURE") {
          throw new Error(status.error || "Background job failed");
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("Background job")) throw err;
      }
    }
    throw new Error("Timed out waiting for job completion");
  };

  const handleSubmit = async () => {
    const allErrors: CardValidationError[] = [];

    for (const [idx, p] of products.entries()) {
      const label = p.title.trim() || `Product #${idx + 1}`;
      const errors: FieldError[] = [];

      if (!p.title.trim()) {
        errors.push({ field: "title", message: `Product #${idx + 1} needs a name` });
      }
      if (p.price <= 0) {
        errors.push({
          field: "price",
          message: `Product "${label}" needs a price greater than 0`,
        });
      }
      if (!p.categoryName.trim()) {
        errors.push({
          field: "category",
          message: `Product "${label}" needs a category`,
        });
      }
      if (!p.images.length && !(p.isUpdate && p.existingProductId)) {
        errors.push({
          field: "images",
          message: `Product "${label}" needs at least one image`,
        });
      }
      if (!p.variants.length) {
        errors.push({
          field: "variants",
          message: `Product "${label}" needs at least one variant`,
        });
      } else {
        const missingSize = p.variants.findIndex((v) => !v.size?.trim());
        const missingColor = p.variants.findIndex((v) => !v.color?.trim());
        if (missingColor >= 0 || missingSize >= 0) {
          errors.push({
            field: "variants",
            message: `Product "${label}" variants need both color and size (use Free Size if there is no size)`,
          });
        }
      }

      if (errors.length) {
        allErrors.push({ productId: p.id, errors });
      }
    }

    if (allErrors.length) {
      setValidationErrors(allErrors);
      const totalIssues = allErrors.reduce((sum, item) => sum + item.errors.length, 0);
      toast.error(
        `${totalIssues} validation error${totalIssues === 1 ? "" : "s"} across ${allErrors.length} product${allErrors.length === 1 ? "" : "s"}`
      );
      requestAnimationFrame(() => scrollToFirstError(allErrors));
      return;
    }

    setValidationErrors([]);

    const imageJobs = products.flatMap((p) => {
      // Updates keep existing images — don't upload folder matches again
      if (p.isUpdate && p.existingProductId) return [];
      return p.images.filter((img) => img.file).map((img) => ({ productId: p.id, image: img }));
    });

    setProgressOpen(true);
    setProgressError(undefined);
    setPhase("images");
    setCurrent(0);
    setTotal(Math.max(imageJobs.length, 1));
    setProgressMessage(
      imageJobs.length ? `Uploading images (0/${imageJobs.length})...` : "Preparing products..."
    );

    try {
      const uploadedByKey = new Map<string, string>();

      for (let i = 0; i < imageJobs.length; i++) {
        const { productId, image } = imageJobs[i];
        if (!image.file) continue;
        const url = await uploadAdminImage(image.file);
        uploadedByKey.set(`${productId}:${image.id}`, url);
        setCurrent(i + 1);
        setProgressMessage(`Uploading images (${i + 1}/${imageJobs.length})...`);
      }

      setPhase("queue");
      setProgressMessage("Submitting products to queue...");
      setCurrent(1);
      setTotal(1);

      const payload = products.map((p) => {
        const isUpdate = Boolean(p.isUpdate && p.existingProductId);
        const images = isUpdate
          ? [] // keep existing gallery on update — never append duplicates
          : p.images.map((img) => ({
              url: uploadedByKey.get(`${p.id}:${img.id}`) || img.url,
              color: img.color || undefined,
            }));
        const stock = variantStock(p.variants, p.stock);
        return {
          title: p.title.trim(),
          price: p.price,
          stock,
          ...(images.length ? { image: images[0]?.url, images } : {}),
          color: p.variants[0]?.color,
          size: p.variants[0]?.size,
          categoryName: p.categoryName.trim(),
          variants: p.variants.map((v) => ({
            color: v.color,
            size: v.size,
            qty: qtyNumber(v.qty),
            sku: v.sku,
          })),
          isUpdate,
          existingProductId: p.existingProductId,
          sku: p.matchedSku || p.skus?.[0],
        };
      });

      // Re-validate matched SKUs at confirm time (stale review gap)
      const updateSkus = payload
        .filter((p) => p.isUpdate && p.sku)
        .map((p) => p.sku!)
        .filter(Boolean);
      if (updateSkus.length) {
        const recheck = await validateAdminSkus(updateSkus);
        const stillMatched = new Set(recheck.matched.map((m) => m.sku.toLowerCase()));
        for (const row of payload) {
          if (row.isUpdate && row.sku && !stillMatched.has(row.sku.toLowerCase())) {
            row.isUpdate = false;
            row.existingProductId = undefined;
            toast.warning(`Product with SKU '${row.sku}' not found; will be created as new.`);
          }
        }
      }

      const res = await bulkUploadProductsJson(payload);

      if (res.jobId) {
        await pollJob(res.jobId, products.length);
      } else {
        setPhase("done");
        setCurrent(1);
        setTotal(1);
        setProgressMessage(res.message || "Products uploaded successfully");
      }

      await new Promise((r) => setTimeout(r, 700));
      clear();
      toast.success(res.message || "Products queued successfully");
      router.push("/admin/products");
    } catch (err) {
      setPhase("error");
      setProgressError(err instanceof Error ? err.message : "Bulk upload failed");
      toast.error(err instanceof Error ? err.message : "Bulk upload failed");
    }
  };

  const goToProductsPage = () => {
    router.push("/admin/products");
  };

  if (!hasProducts) {
    return (
      <div className="-mx-4 -my-6 min-h-[calc(100vh-3.5rem)] bg-[#f3f4f6] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-5">
          <div className="sticky top-14 z-40 -mx-4 space-y-3 bg-[#f3f4f6] px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="rounded-xl border border-[#e5e7eb] bg-white px-5 py-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <button
                    type="button"
                    onClick={goBack}
                    className="mt-0.5 rounded-md p-1.5 text-[#64748b] transition hover:bg-[#f1f5f9]"
                    aria-label="Back to products"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <h1 className="text-[20px] font-semibold tracking-tight text-[#111827]">
                      {title}
                    </h1>
                    <p className="mt-1 text-[13px] text-[#94a3b8]">
                      Review pre-filled CSV data, add images, edit details, then submit to queue
                      tasks.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                  <button
                    type="button"
                    onClick={addProduct}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#2563EB] bg-white px-3.5 py-2 text-[13px] font-medium text-[#2563EB] transition hover:bg-brand-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add Product Card
                  </button>
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-[13px] font-semibold text-white opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    Submit All Products
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-[#e5e7eb] bg-white px-6 py-16 text-center shadow-sm">
            <p className="text-[14px] text-[#94a3b8]">
              No product cards yet. Add a blank card to get started.
            </p>
            <button
              type="button"
              onClick={goToProductsPage}
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-brand-600"
            >
              Go to Products Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 -my-6 min-h-[calc(100vh-3.5rem)] bg-[#f3f4f6] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div
          className={`sticky top-14 z-40 -mx-4 space-y-3 px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 ${
            validationErrors.length ? "bg-red-50" : "bg-[#f3f4f6]"
          }`}
        >
          <div className="rounded-xl border border-[#e5e7eb] bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  className="mt-0.5 rounded-md p-1.5 text-[#64748b] transition hover:bg-[#f1f5f9]"
                  aria-label="Back to products"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h1 className="text-[20px] font-semibold tracking-tight text-[#111827]">
                    {title}
                  </h1>
                  <p className="mt-1 text-[13px] text-[#94a3b8]">
                    Review pre-filled CSV data, add images, edit details, then submit to queue
                    tasks.
                  </p>
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto lg:shrink-0">
                <button
                  type="button"
                  onClick={addProduct}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#2563EB] bg-white px-3.5 py-2 text-center text-[13px] font-medium text-[#2563EB] transition hover:bg-brand-50 sm:flex-initial"
                >
                  <Plus className="h-4 w-4" />
                  Add Product Card
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={!hasProducts || (progressOpen && phase !== "error")}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-center text-[13px] font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60 sm:flex-initial"
                >
                  <Send className="h-4 w-4" />
                  Submit All Products
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              index={index}
              product={product}
              categories={categories}
              validationError={errorsByProductId.get(product.id) ?? null}
              cardRef={(node) => {
                if (node) cardRefs.current.set(product.id, node);
                else cardRefs.current.delete(product.id);
              }}
              onClearError={() => clearProductError(product.id)}
              onCategoryCreated={(category) => {
                setCategories((prev) => {
                  if (prev.some((c) => c.id === category.id)) return prev;
                  return [...prev, category].sort((a, b) => a.name.localeCompare(b.name));
                });
              }}
              onChange={(next) => updateProduct(product.id, next)}
              onRemove={() => {
                clearProductError(product.id);
                removeProduct(product.id);
              }}
            />
          ))}
        </div>

        <BulkUploadProgressModal
          open={progressOpen}
          phase={phase}
          current={current}
          total={total}
          message={progressMessage}
          error={progressError}
        />

        {phase === "error" && progressOpen ? (
          <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
            <button
              type="button"
              onClick={() => setProgressOpen(false)}
              className="rounded-lg bg-white px-4 py-2 text-[13px] font-medium text-[#334155] shadow-lg ring-1 ring-[#e5e7eb]"
            >
              Close
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
