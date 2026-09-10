"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ArrowLeft, Loader2, Plus, Send, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  type BulkProgressPhase,
  BulkUploadProgressModal,
} from "@/components/admin/BulkUploadProgressModal";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import {
  bulkUploadProductsJson,
  fetchAdminCategories,
  fetchAdminJobStatus,
  uploadAdminImage,
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
} from "@/lib/product-options";
import type { Category } from "@/types";

const COLOR_OPTIONS = [...PRODUCT_COLOR_OPTIONS];
const SIZE_OPTIONS = [...PRODUCT_SIZE_OPTIONS];

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

function variantStock(variants: BulkDraftVariant[], fallback: number) {
  if (variants.length) return variants.reduce((sum, v) => sum + v.qty, 0);
  return fallback;
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

function ProductCard({
  index,
  product,
  categories,
  validationError,
  cardRef,
  onChange,
  onRemove,
  onClearError,
}: {
  index: number;
  product: BulkDraftProduct;
  categories: Category[];
  validationError?: CardValidationError | null;
  cardRef?: (node: HTMLDivElement | null) => void;
  onChange: (next: BulkDraftProduct) => void;
  onRemove: () => void;
  onClearError?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({ color: "", size: "", qty: "" });
  const [localError, setLocalError] = useState("");
  const hasVariants = product.variants.length > 0;
  const colors = colorOptionsFor(product);
  const sizes = sizeOptionsFor(product);
  const isErrorCard = !!validationError?.errors.length;
  const errorFields = new Set(validationError?.errors.map((e) => e.field) ?? []);
  const hasFieldError = (field: FieldKey) => errorFields.has(field);

  const resolvedCategory = resolveCategoryName(product.categoryName, categories);
  const categoryValue = resolvedCategory?.categoryId
    ? resolvedCategory.categoryId
    : product.categoryName
      ? `__name__:${resolvedCategory?.categoryName || product.categoryName}`
      : "";

  const categoryOptions = [
    ...categories.map((c) => ({ value: c.id, label: c.name })),
    ...(product.categoryName &&
    !categories.some((c) => c.name.toLowerCase() === product.categoryName.toLowerCase()) &&
    !resolvedCategory?.categoryId
      ? [
          {
            value: `__name__:${resolvedCategory?.categoryName || product.categoryName}`,
            label: resolvedCategory?.categoryName || product.categoryName,
          },
        ]
      : []),
  ];

  const patch = (next: BulkDraftProduct) => {
    onClearError?.();
    onChange(next);
  };

  const addVariant = () => {
    if (!draft.color && !draft.size) {
      setLocalError("Select at least a color or a size");
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
      { color: normalizeColor(draft.color), size: normalizeSize(draft.size), qty },
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
      nextImages.push({
        id: uid(),
        url: URL.createObjectURL(file),
        fileName: file.name,
        color: fromName || normalizeColor(product.variants[0]?.color || ""),
        file,
      });
    }
    patch({ ...product, images: nextImages });
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-[#111827]">
          <span className="text-[#2563EB]">#{index + 1}</span>{" "}
          {product.title.trim() || "Untitled Product"}
        </h2>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-1.5 text-[#EF4444] transition hover:bg-red-50"
          aria-label={`Remove product ${index + 1}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {isErrorCard ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">
          <ul className="list-disc space-y-1 pl-4">
            {validationError!.errors.map((err) => (
              <li key={`${err.field}-${err.message}`}>{err.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(240px,0.9fr)_1.1fr]">
        <div data-field="images">
          <p className="mb-1.5 text-[12px] font-medium text-[#6b7280]">
            Product Images <span className="text-red-500">*</span>
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
            <span className="text-[12px]">Upload multiple images</span>
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
                type="number"
                min={0}
                value={product.stock}
                readOnly={hasVariants}
                onChange={(e) => patch({ ...product, stock: parseInt(e.target.value, 10) || 0 })}
                className={`${fieldClass} read-only:bg-[#f8fafc]`}
              />
            </label>
          </div>

          <div className="block text-[12px] font-medium text-[#6b7280]" data-field="category">
            Category <span className="text-red-500">*</span>
            <div className="mt-1.5">
              <Select
                value={categoryValue}
                onChange={(value) => {
                  if (value.startsWith("__name__:")) {
                    patch({ ...product, categoryName: value.slice("__name__:".length) });
                    return;
                  }
                  const cat = categories.find((c) => c.id === value);
                  patch({ ...product, categoryName: cat?.name || "" });
                }}
                options={categoryOptions}
                placeholder="Select Category"
                ariaLabel="Category"
                className={hasFieldError("category") ? fieldErrorClass : undefined}
              />
            </div>
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
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
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
                  type="number"
                  min={0}
                  placeholder="Enter Qty"
                  value={draft.qty}
                  onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))}
                  className="h-10 w-full rounded-md border border-[#e5e7eb] px-3 text-[13px] outline-none focus:border-[#2563EB]"
                  aria-label="Quantity"
                />
                <button
                  type="button"
                  onClick={addVariant}
                  className="flex h-10 w-10 items-center justify-center rounded-md bg-[#2563EB] text-white hover:bg-brand-600"
                  aria-label="Add variant"
                >
                  <Plus className="h-5 w-5" strokeWidth={2.5} />
                </button>
              </div>

              <div className="mt-2 space-y-2">
                {product.variants.map((v, vIdx) => (
                  <div
                    key={`${v.color}-${v.size}-${vIdx}`}
                    className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2"
                  >
                    <div className="flex h-10 items-center rounded-md border border-[#e5e7eb] px-3 text-[13px]">
                      {v.color || "—"}
                    </div>
                    <div className="flex h-10 items-center rounded-md border border-[#e5e7eb] px-3 text-[13px]">
                      {v.size || "—"}
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={v.qty}
                      onChange={(e) => {
                        const qty = Math.max(0, Math.floor(Number(e.target.value) || 0));
                        const variants = product.variants.map((item, i) =>
                          i === vIdx ? { ...item, qty } : item
                        );
                        patch({
                          ...product,
                          variants,
                          stock: variantStock(variants, product.stock),
                        });
                      }}
                      className="h-10 w-full rounded-md border border-[#e5e7eb] px-3 text-[13px] tabular-nums outline-none focus:border-[#2563EB]"
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
                      className="flex h-10 w-10 items-center justify-center rounded-md text-[#EF4444] hover:bg-red-50"
                      aria-label="Remove variant"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
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
    if (!hasProducts) {
      router.replace("/admin/products");
    }
  }, [hasProducts, router]);

  useEffect(() => {
    void fetchAdminCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // Auto-map CSV category/color values onto real Select options once categories load.
  useEffect(() => {
    const current = useBulkUploadStore.getState().products;
    if (!current.length) return;

    let changed = false;
    const next = current.map((p) => {
      const resolved = resolveCategoryName(p.categoryName, categories);
      const categoryName = resolved?.categoryName || p.categoryName;

      const variants = p.variants.map((v) => {
        const color = normalizeColor(v.color);
        const size = normalizeSize(v.size);
        if (color !== v.color || size !== v.size) changed = true;
        return { ...v, color, size };
      });

      const images = p.images.map((img) => {
        const fromName = detectColorFromFileName(img.fileName);
        const color = normalizeColor(img.color || fromName || variants[0]?.color || "");
        if (color !== img.color) changed = true;
        return { ...img, color };
      });

      if (categoryName !== p.categoryName) changed = true;

      return { ...p, categoryName, variants, images };
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
      if (!p.images.length) {
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

    const imageJobs = products.flatMap((p) =>
      p.images.filter((img) => img.file).map((img) => ({ productId: p.id, image: img }))
    );

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
        const images = p.images.map((img) => ({
          url: uploadedByKey.get(`${p.id}:${img.id}`) || img.url,
          color: img.color || undefined,
        }));
        const stock = variantStock(p.variants, p.stock);
        return {
          title: p.title.trim(),
          description: p.description.trim() || undefined,
          price: p.price,
          stock,
          image: images[0]?.url,
          images,
          color: p.variants[0]?.color,
          size: p.variants[0]?.size,
          categoryName: p.categoryName.trim(),
          variants: p.variants,
        };
      });

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

  if (!hasProducts) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[#94a3b8]">
        <Loader2 className="h-6 w-6 animate-spin" />
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
                  onClick={() => void handleSubmit()}
                  disabled={progressOpen && phase !== "error"}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  Submit All Products
                </button>
              </div>
            </div>
          </div>

          {validationErrors.length ? (
            <div className="max-h-40 overflow-y-auto rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 shadow-sm">
              <p className="font-semibold">
                Fix {validationErrors.reduce((sum, e) => sum + e.errors.length, 0)} error
                {validationErrors.reduce((sum, e) => sum + e.errors.length, 0) === 1
                  ? ""
                  : "s"}{" "}
                before submitting
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {validationErrors.flatMap((card) =>
                  card.errors.map((err) => (
                    <li key={`${card.productId}-${err.field}`}>
                      <button
                        type="button"
                        className="text-left underline-offset-2 hover:underline"
                        onClick={() => scrollToFirstError([card])}
                      >
                        {err.message}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}
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
              onChange={(next) => updateProduct(product.id, next)}
              onRemove={() => {
                clearProductError(product.id);
                if (products.length === 1) {
                  goBack();
                  return;
                }
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
