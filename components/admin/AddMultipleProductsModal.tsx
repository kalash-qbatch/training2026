"use client";

import { useRef, useState } from "react";

import { AlertCircle, CloudUpload, Image as ImageIcon, Plus, Trash2 } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { bulkUploadProductsJson, uploadAdminImage } from "@/lib/api/admin";

interface ParsedProduct {
  id: string;
  title: string;
  price: number;
  stock: number;
  description: string;
  category: string;
  color: string;
  size: string;
  image: string;
  imageUploading?: boolean;
}

export function AddMultipleProductsModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [products, setProducts] = useState<ParsedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal closes
  const resetAll = () => {
    setStep("upload");
    setProducts([]);
    setError("");
    setLoading(false);
  };

  const handleCsvParse = (text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      setError("CSV file must have a header row and at least one product row.");
      return;
    }

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
    const titleIdx = header.indexOf("title");
    const priceIdx = header.indexOf("price");
    const stockIdx = header.indexOf("stock");
    const descIdx = header.indexOf("description");
    const catIdx = header.indexOf("category");
    const colorIdx = header.indexOf("color");
    const sizeIdx = header.indexOf("size");
    const imgIdx = header.indexOf("image");

    if (titleIdx === -1 || priceIdx === -1) {
      setError("CSV must contain at least 'title' and 'price' columns.");
      return;
    }

    const parsed: ParsedProduct[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const title = cols[titleIdx] || "";
      if (!title) continue;

      parsed.push({
        id: `prod-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        price: Number(cols[priceIdx]) || 0,
        stock: stockIdx >= 0 ? Number(cols[stockIdx]) || 0 : 10,
        description: descIdx >= 0 ? cols[descIdx] : "",
        category: catIdx >= 0 ? cols[catIdx] : "",
        color: colorIdx >= 0 ? cols[colorIdx] : "",
        size: sizeIdx >= 0 ? cols[sizeIdx] : "",
        image: imgIdx >= 0 ? cols[imgIdx] : "",
      });
    }

    if (!parsed.length) {
      setError("No valid products found in the uploaded file.");
      return;
    }

    setProducts(parsed);
    setStep("review");
    setError("");
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file (one file at max).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      handleCsvParse(text);
    };
    reader.readAsText(file);
  };

  const updateProduct = (id: string, updates: Partial<ParsedProduct>) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const removeProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const addNewProduct = () => {
    setProducts((prev) => [
      ...prev,
      {
        id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: "New Product",
        price: 9.99,
        stock: 20,
        description: "",
        category: "",
        color: "",
        size: "",
        image: "",
      },
    ]);
  };

  const handleImageUpload = async (id: string, file: File) => {
    updateProduct(id, { imageUploading: true });
    try {
      const url = await uploadAdminImage(file);
      updateProduct(id, { image: url, imageUploading: false });
      toast.success("Image uploaded successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image upload failed");
      updateProduct(id, { imageUploading: false });
    }
  };

  const handleSubmit = async () => {
    if (!products.length) {
      setError("Cannot submit an empty product list.");
      return;
    }

    // Client-side validations
    for (const [idx, p] of products.entries()) {
      if (!p.title.trim()) {
        setError(`Product #${idx + 1} has no title.`);
        return;
      }
      if (p.price <= 0) {
        setError(`Product "${p.title}" must have a price greater than 0.`);
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      const res = await bulkUploadProductsJson(
        products.map((p) => ({
          title: p.title.trim(),
          description: p.description.trim() || undefined,
          price: p.price,
          stock: p.stock,
          image: p.image.trim() || undefined,
          color: p.color.trim() || undefined,
          size: p.size.trim() || undefined,
          categoryName: p.category.trim() || undefined,
        }))
      );

      toast.success(res.message || "Products queued for upload!");
      resetAll();
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        resetAll();
        onClose();
      }}
      title={
        step === "upload"
          ? "Upload Multiple Products (.csv)"
          : `Review Products (${products.length})`
      }
      className={step === "review" ? "max-w-4xl max-h-[90vh] flex flex-col" : "max-w-lg rounded-xl"}
    >
      {step === "upload" ? (
        <div>
          <div
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) {
                handleFileSelect(e.dataTransfer.files[0]);
              }
            }}
          >
            <CloudUpload className="mb-2 h-8 w-8 text-[#2563EB]" />
            <p className="text-[13px] font-medium text-gray-700">
              Drop your .csv file here (1 file max)
            </p>
            <p className="mt-1 text-[12px] text-gray-400">
              CSV will be parsed into interactive product items
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-3 rounded-lg border border-[#2563EB] px-4 py-1.5 text-[12px] font-medium text-[#2563EB] transition hover:bg-brand-50"
            >
              Browse CSV File
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-[12px]">
            <a
              href="/templates/products-template.csv"
              download
              className="text-[#2563EB] hover:underline"
            >
              Download CSV template
            </a>
            <span className="text-gray-400">Max 1 file</span>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-1.5 text-[12px] text-red-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <p className="text-[13px] text-gray-600">
              Review details, edit values, upload images, or add/remove products before submitting
              to the FastAPI worker.
            </p>
            <button
              type="button"
              onClick={addNewProduct}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2563EB] bg-white px-3 py-1.5 text-[12px] font-medium text-[#2563EB] hover:bg-brand-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add Product
            </button>
          </div>

          {error && (
            <div className="my-2 flex items-center gap-1.5 text-[12px] text-red-500 bg-red-50 p-2.5 rounded-md">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto pr-1 py-3 space-y-3">
            {products.map((p, index) => (
              <div
                key={p.id}
                className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm transition hover:border-blue-200"
              >
                <div className="flex items-start gap-4">
                  {/* Image section */}
                  <div className="flex flex-col items-center">
                    <div className="relative h-20 w-20 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt={p.title} className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-gray-300" />
                      )}
                      {p.imageUploading && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-[10px] text-white">
                          Uploading…
                        </div>
                      )}
                    </div>
                    <label className="mt-1 cursor-pointer text-[11px] font-medium text-[#2563EB] hover:underline">
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleImageUpload(p.id, e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Form fields */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2.5">
                    <div className="md:col-span-2">
                      <label className="text-[11px] font-medium text-gray-600">
                        Product Title *
                      </label>
                      <input
                        value={p.title}
                        onChange={(e) => updateProduct(p.id, { title: e.target.value })}
                        placeholder="e.g. Wireless Headphones"
                        className="mt-0.5 h-8 w-full rounded border border-gray-200 px-2 text-[12px] outline-none focus:border-[#2563EB]"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-gray-600">Price ($) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={p.price}
                        onChange={(e) =>
                          updateProduct(p.id, { price: parseFloat(e.target.value) || 0 })
                        }
                        className="mt-0.5 h-8 w-full rounded border border-gray-200 px-2 text-[12px] outline-none focus:border-[#2563EB]"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-gray-600">Stock Qty</label>
                      <input
                        type="number"
                        value={p.stock}
                        onChange={(e) =>
                          updateProduct(p.id, { stock: parseInt(e.target.value) || 0 })
                        }
                        className="mt-0.5 h-8 w-full rounded border border-gray-200 px-2 text-[12px] outline-none focus:border-[#2563EB]"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-gray-600">Category</label>
                      <input
                        value={p.category}
                        onChange={(e) => updateProduct(p.id, { category: e.target.value })}
                        placeholder="e.g. Electronics"
                        className="mt-0.5 h-8 w-full rounded border border-gray-200 px-2 text-[12px] outline-none focus:border-[#2563EB]"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-gray-600">Color</label>
                      <input
                        value={p.color}
                        onChange={(e) => updateProduct(p.id, { color: e.target.value })}
                        placeholder="e.g. Black"
                        className="mt-0.5 h-8 w-full rounded border border-gray-200 px-2 text-[12px] outline-none focus:border-[#2563EB]"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-gray-600">Size</label>
                      <input
                        value={p.size}
                        onChange={(e) => updateProduct(p.id, { size: e.target.value })}
                        placeholder="e.g. M / XL"
                        className="mt-0.5 h-8 w-full rounded border border-gray-200 px-2 text-[12px] outline-none focus:border-[#2563EB]"
                      />
                    </div>

                    <div className="flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => removeProduct(p.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 py-1.5"
                        title="Remove product"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep("upload")}
              className="text-[12px] text-gray-600 hover:underline"
            >
              ← Choose another file
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  resetAll();
                  onClose();
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || !products.length}
                onClick={handleSubmit}
                className="rounded-lg bg-[#2563EB] px-5 py-2 text-[13px] font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
              >
                {loading ? "Submitting to Queue…" : `Submit ${products.length} Products`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
