"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import type { Category, Product, ProductVariant } from "@/types";
import { fetchAdminCategories } from "@/lib/api/admin";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";

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
const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"];
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

function variantsFromProduct(product: Product): ProductVariant[] {
  return product.variants?.length ? product.variants : [];
}

function totalStock(variants: ProductVariant[], fallback: string) {
  if (variants.length > 0) {
    return String(variants.reduce((sum, v) => sum + v.qty, 0));
  }
  return fallback;
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
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  draft: DraftVariant;
  setDraft: React.Dispatch<React.SetStateAction<DraftVariant>>;
  variants: ProductVariant[];
  setVariants: React.Dispatch<React.SetStateAction<ProductVariant[]>>;
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
}) {
  const hasVariants = variants.length > 0;

  function saveNewCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      setError("Enter a category name");
      return;
    }
    setError("");
  }

  function addVariant() {
    if (!draft.color && !draft.size) {
      setError("Select at least a color or a size");
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
    setForm((f) => ({ ...f, stock: String(next.reduce((sum, v) => sum + v.qty, 0)) }));
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
    const qty = Number(raw);
    if (!Number.isFinite(qty) || qty < 0) return;
    const next = variants.map((v, i) =>
      i === index ? { ...v, qty: Math.floor(qty) } : v
    );
    setVariants(next);
    setForm((f) => ({
      ...f,
      stock: String(next.reduce((sum, v) => sum + v.qty, 0)),
    }));
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
                  Uploading {uploadingCount}{" "}
                  {uploadingCount === 1 ? "image" : "images"}…
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
                        prev.map((item, i) =>
                          i === index ? { ...item, color: v } : item
                        )
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
                required
                type="number"
                min={0}
                value={form.stock}
                readOnly={hasVariants}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                className={`${fieldClass} read-only:bg-[#f8fafc]`}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="block text-[12px] font-medium text-[#6b7280]">
              Category <span className="text-red-500">*</span>
              <div className="mt-1.5">
                <Select
                  value={form.categoryId}
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
                    },
                  ]}
                  placeholder="Select Category"
                  ariaLabel="Category"
                />
              </div>
            </div>
            <div className="block text-[12px] font-medium text-[#6b7280]">
              Status
              <div className="mt-1.5">
                <Select
                  value={form.isActive ? "active" : "inactive"}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, isActive: v === "active" }))
                  }
                  options={[
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
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
            <p className="mb-2 text-[12px] font-medium text-[#6b7280]">
              Add Product Variants
            </p>
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
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
                type="number"
                min={0}
                placeholder="Enter Qty"
                value={draft.qty}
                onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))}
                className="h-10 w-full rounded-md border border-neutral-border px-3 text-[13px] text-neutral-text outline-none focus:border-[#2563EB]"
                aria-label="Quantity"
              />
              <button
                type="button"
                onClick={addVariant}
                className="flex h-10 w-10 items-center justify-center rounded-md bg-[#2563EB] text-white hover:bg-brand-600"
                aria-label="Add color and size"
              >
                <Plus className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {variants.map((v, index) => (
                <div
                  key={`${v.color}-${v.size}`}
                  className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2"
                >
                  <div className="flex h-10 items-center rounded-md border border-neutral-border px-3 text-[13px] text-neutral-text">
                    {v.color || "—"}
                  </div>
                  <div className="flex h-10 items-center rounded-md border border-neutral-border px-3 text-[13px] text-neutral-text">
                    {v.size || "—"}
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={v.qty}
                    onChange={(e) => updateVariantQty(index, e.target.value)}
                    className="h-10 w-full rounded-md border border-neutral-border px-3 text-[13px] tabular-nums text-neutral-text outline-none focus:border-[#2563EB]"
                    aria-label={`Quantity for ${v.color} ${v.size}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeVariant(index)}
                    className="flex h-10 w-10 items-center justify-center rounded-md text-[#EF4444] hover:bg-red-50"
                    aria-label="Remove variant"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
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

export type ProductSavePayload = {
  title: string;
  price: number;
  stock: number;
  image?: string;
  images?: ProductImageDraft[];
  color?: string;
  size?: string;
  variants: ProductVariant[];
  categoryId?: string | null;
  categoryName?: string | null;
  isActive: boolean;
};

function revokeDraftImages(items: ProductImageDraft[]) {
  for (const img of items) {
    if (img.file) URL.revokeObjectURL(img.url);
  }
}

function buildSavePayload(
  form: FormState,
  variants: ProductVariant[],
  images: ProductImageDraft[],
  newCategoryName: string
): ProductSavePayload {
  const stock =
    variants.length > 0
      ? variants.reduce((sum, v) => sum + v.qty, 0)
      : Number(form.stock);
  const isNewCategory = form.categoryId === NEW_CATEGORY;
  return {
    title: form.title,
    price: Number(form.price),
    stock,
    image: images[0]?.file ? undefined : images[0]?.url,
    images,
    color: variants[0]?.color,
    size: variants[0]?.size,
    variants,
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
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [images, setImages] = useState<ProductImageDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { categories, newCategoryName, setNewCategoryName } =
    useCategoryLoader(open);

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
    }
  }

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
      open={open}
      onClose={onClose}
      title="Add a Single Product"
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
        submitLabel="Save"
        fileRef={fileRef}
        onUpload={onUpload}
        uploadingCount={uploadingCount}
        onSubmit={async () => {
          if (
            !form.categoryId ||
            (form.categoryId === NEW_CATEGORY && !newCategoryName.trim())
          ) {
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
            await onSave(
              buildSavePayload(form, variants, images, newCategoryName)
            );
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
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [images, setImages] = useState<ProductImageDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { categories, newCategoryName, setNewCategoryName } =
    useCategoryLoader(open);

  // Repopulate the form when the drawer opens or the product changes
  // (state adjustment during render).
  const [prev, setPrev] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null,
  });
  if (prev.open !== open || prev.product !== product) {
    setPrev({ open, product });
    if (open && product) {
      const nextVariants = variantsFromProduct(product);
      const nextImages = product.images?.length
        ? product.images.map((img) => ({
            url: img.url,
            color: img.color ?? "",
          }))
        : product.imageUrl
          ? [{ url: product.imageUrl, color: "" }]
          : [];
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
    }
  }

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
        onSubmit={async () => {
          if (
            !form.categoryId ||
            (form.categoryId === NEW_CATEGORY && !newCategoryName.trim())
          ) {
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
            await onSave(
              buildSavePayload(form, variants, images, newCategoryName)
            );
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
