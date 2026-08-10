"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Pencil, Plus, Trash2 } from "lucide-react";
import type { Category, Product, ProductVariant } from "@/types";
import {
  createAdminCategory,
  fetchAdminCategories,
  uploadAdminImage,
} from "@/lib/api/admin";
import { Drawer } from "@/components/ui/Drawer";

const COLOR_OPTIONS = [
  "Black",
  "Blue",
  "Red",
  "Green",
  "White",
  "Brown",
  "Gray",
  "Yellow",
];
const SIZE_OPTIONS = ["Small", "Medium", "Large", "XL", "XXL"];
const NEW_CATEGORY = "__new__";

type FormState = {
  title: string;
  price: string;
  stock: string;
  image: string;
  categoryId: string;
};

type DraftVariant = {
  color: string;
  size: string;
  qty: string;
};

function emptyForm(): FormState {
  return { title: "", price: "", stock: "", image: "", categoryId: "" };
}

function emptyDraft(): DraftVariant {
  return { color: "", size: "", qty: "" };
}

function variantsFromProduct(product: Product): ProductVariant[] {
  if (product.variants?.length) return product.variants;
  if (product.color || product.sizes?.length) {
    return [
      {
        color: product.color || "Black",
        size: product.sizes?.[0] || "Medium",
        qty: product.stock ?? 0,
      },
    ];
  }
  return [];
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
  categories,
  setCategories,
  newCategoryName,
  setNewCategoryName,
  error,
  setError,
  loading,
  submitLabel,
  onSubmit,
  fileRef,
  onUpload,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  draft: DraftVariant;
  setDraft: React.Dispatch<React.SetStateAction<DraftVariant>>;
  variants: ProductVariant[];
  setVariants: React.Dispatch<React.SetStateAction<ProductVariant[]>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  newCategoryName: string;
  setNewCategoryName: React.Dispatch<React.SetStateAction<string>>;
  error: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  submitLabel: string;
  onSubmit: () => Promise<void>;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (file: File) => Promise<void>;
}) {
  const hasVariants = variants.length > 0;
  const [creatingCategory, setCreatingCategory] = useState(false);

  async function saveNewCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      setError("Enter a category name");
      return;
    }
    setCreatingCategory(true);
    setError("");
    try {
      const category = await createAdminCategory(name);
      setCategories((prev) => {
        if (prev.some((c) => c.id === category.id)) return prev;
        return [...prev, category].sort((a, b) => a.name.localeCompare(b.name));
      });
      setForm((f) => ({ ...f, categoryId: category.id }));
      setNewCategoryName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setCreatingCategory(false);
    }
  }

  function addVariant() {
    if (!draft.color || !draft.size || draft.qty === "") {
      setError("Select color, size, and quantity before adding");
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

  return (
    <form
      className="flex h-full flex-col"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit();
      }}
    >
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="relative mx-auto h-[140px] w-[140px] shrink-0 overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f8fafc] sm:mx-0">
          {form.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#9ca3af]">
              <Camera className="h-8 w-8" />
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute right-2 top-2 rounded-full bg-[#2563EB] p-1.5 text-white shadow-sm"
            aria-label="Upload image"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onUpload(file);
            }}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <label className="block text-[12px] font-medium text-[#6b7280]">
            Product Name
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1.5 h-10 w-full rounded-md border border-[#d0d5dd] px-3 text-[13px] text-[#333] outline-none focus:border-[#2563EB]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-medium text-[#6b7280]">
              Price
              <input
                required
                type="number"
                min={0.01}
                step="0.01"
                placeholder="$00.00"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="mt-1.5 h-10 w-full rounded-md border border-[#d0d5dd] px-3 text-[13px] text-[#333] outline-none focus:border-[#2563EB]"
              />
            </label>
            <label className="block text-[12px] font-medium text-[#6b7280]">
              Quantity (total)
              <input
                required
                type="number"
                min={0}
                value={form.stock}
                readOnly={hasVariants}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                className="mt-1.5 h-10 w-full rounded-md border border-[#d0d5dd] px-3 text-[13px] text-[#333] outline-none focus:border-[#2563EB] read-only:bg-[#f8fafc]"
                title={
                  hasVariants
                    ? "Auto total from color/size rows — edit qty on each row below"
                    : undefined
                }
              />
            </label>
          </div>
          <label className="block text-[12px] font-medium text-[#6b7280]">
            Category
            <select
              required
              value={form.categoryId}
              onChange={(e) => {
                const value = e.target.value;
                setForm((f) => ({
                  ...f,
                  categoryId: value === NEW_CATEGORY ? NEW_CATEGORY : value,
                }));
                if (value !== NEW_CATEGORY) setNewCategoryName("");
              }}
              className="mt-1.5 h-10 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-[13px] text-[#333] outline-none focus:border-[#2563EB]"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW_CATEGORY}>+ Create new category</option>
            </select>
          </label>
          {form.categoryId === NEW_CATEGORY ? (
            <div className="flex gap-2">
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New category name"
                className="h-10 min-w-0 flex-1 rounded-md border border-[#d0d5dd] px-3 text-[13px] text-[#333] outline-none focus:border-[#2563EB]"
              />
              <button
                type="button"
                disabled={creatingCategory}
                onClick={() => void saveNewCategory()}
                className="shrink-0 rounded-md bg-[#2563EB] px-3 text-[13px] font-medium text-white hover:bg-[#1e6aef] disabled:opacity-60"
              >
                {creatingCategory ? "Saving…" : "Add"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
          <label className="block text-[12px] font-medium text-[#6b7280]">
            <span className="sr-only">Color</span>
            <select
              value={draft.color}
              onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
              className="mt-0 h-10 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-[13px] text-[#333] outline-none focus:border-[#2563EB]"
            >
              <option value="">Select Color</option>
              {COLOR_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-medium text-[#6b7280]">
            <span className="sr-only">Size</span>
            <select
              value={draft.size}
              onChange={(e) => setDraft((d) => ({ ...d, size: e.target.value }))}
              className="h-10 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-[13px] text-[#333] outline-none focus:border-[#2563EB]"
            >
              <option value="">Select Size</option>
              {SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-medium text-[#6b7280]">
            <span className="sr-only">Qty</span>
            <input
              type="number"
              min={0}
              placeholder="Enter Qty"
              value={draft.qty}
              onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))}
              className="h-10 w-full rounded-md border border-[#d0d5dd] px-3 text-[13px] text-[#333] outline-none focus:border-[#2563EB]"
            />
          </label>
          <button
            type="button"
            onClick={addVariant}
            className="flex h-10 w-10 items-center justify-center rounded-md bg-[#2563EB] text-white hover:bg-[#1e6aef]"
            aria-label="Add color and size"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        <p className="text-[12px] text-[#8a94a6]">
          Color / size stock — edit <strong>Qty</strong> on each row (this is what the storefront uses)
        </p>
        <div className="space-y-2">
          {variants.map((v, index) => (
            <div
              key={`${v.color}-${v.size}`}
              className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2"
            >
              <div className="flex h-10 items-center rounded-md border border-[#d0d5dd] px-3 text-[13px] text-[#333]">
                {v.color}
              </div>
              <div className="flex h-10 items-center rounded-md border border-[#d0d5dd] px-3 text-[13px] text-[#333]">
                {v.size}
              </div>
              <input
                type="number"
                min={0}
                value={v.qty}
                onChange={(e) => updateVariantQty(index, e.target.value)}
                className="h-10 w-full rounded-md border border-[#d0d5dd] px-3 text-[13px] tabular-nums text-[#333] outline-none focus:border-[#2563EB]"
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

      {error ? <p className="mt-4 text-[12px] text-red-500">{error}</p> : null}

      <div className="mt-auto flex justify-end pt-8">
        <button
          type="submit"
          disabled={loading}
          className="min-w-[120px] rounded-md bg-[#2563EB] px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-[#1e6aef] disabled:opacity-60"
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
  color?: string;
  size?: string;
  variants: ProductVariant[];
  categoryId?: string | null;
};

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { categories, setCategories, newCategoryName, setNewCategoryName } =
    useCategoryLoader(open);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setDraft(emptyDraft());
    setVariants([]);
    setNewCategoryName("");
    setError("");
  }, [open, setNewCategoryName]);

  async function onUpload(file: File) {
    try {
      const url = await uploadAdminImage(file);
      setForm((f) => ({ ...f, image: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Add a Single Product">
      <ProductFormFields
        form={form}
        setForm={setForm}
        draft={draft}
        setDraft={setDraft}
        variants={variants}
        setVariants={setVariants}
        categories={categories}
        setCategories={setCategories}
        newCategoryName={newCategoryName}
        setNewCategoryName={setNewCategoryName}
        error={error}
        setError={setError}
        loading={loading}
        submitLabel="Save"
        fileRef={fileRef}
        onUpload={onUpload}
        onSubmit={async () => {
          if (!form.categoryId || form.categoryId === NEW_CATEGORY) {
            setError("Select or create a category first");
            return;
          }
          setLoading(true);
          setError("");
          try {
            const stock =
              variants.length > 0
                ? variants.reduce((sum, v) => sum + v.qty, 0)
                : Number(form.stock);
            await onSave({
              title: form.title,
              price: Number(form.price),
              stock,
              image: form.image || undefined,
              color: variants[0]?.color,
              size: variants[0]?.size,
              variants,
              categoryId: form.categoryId,
            });
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { categories, setCategories, newCategoryName, setNewCategoryName } =
    useCategoryLoader(open);

  useEffect(() => {
    if (!product || !open) return;
    const nextVariants = variantsFromProduct(product);
    setForm({
      title: product.name,
      price: String(product.price),
      stock: totalStock(nextVariants, String(product.stock ?? 0)),
      image: product.imageUrl,
      categoryId: product.categoryId ?? product.category?.id ?? "",
    });
    setVariants(nextVariants);
    setDraft(emptyDraft());
    setNewCategoryName("");
    setError("");
  }, [product, open, setNewCategoryName]);

  async function onUpload(file: File) {
    try {
      const url = await uploadAdminImage(file);
      setForm((f) => ({ ...f, image: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  return (
    <Drawer open={open && !!product} onClose={onClose} title="Edit a Single Product">
      <ProductFormFields
        form={form}
        setForm={setForm}
        draft={draft}
        setDraft={setDraft}
        variants={variants}
        setVariants={setVariants}
        categories={categories}
        setCategories={setCategories}
        newCategoryName={newCategoryName}
        setNewCategoryName={setNewCategoryName}
        error={error}
        setError={setError}
        loading={loading}
        submitLabel="Update"
        fileRef={fileRef}
        onUpload={onUpload}
        onSubmit={async () => {
          if (!form.categoryId || form.categoryId === NEW_CATEGORY) {
            setError("Select or create a category first");
            return;
          }
          setLoading(true);
          setError("");
          try {
            const stock =
              variants.length > 0
                ? variants.reduce((sum, v) => sum + v.qty, 0)
                : Number(form.stock);
            await onSave({
              title: form.title,
              price: Number(form.price),
              stock,
              image: form.image || undefined,
              color: variants[0]?.color,
              size: variants[0]?.size,
              variants,
              categoryId: form.categoryId,
            });
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
