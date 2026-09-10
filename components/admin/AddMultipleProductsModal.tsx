"use client";

import { useEffect, useRef, useState } from "react";

import { CheckCircle2, Download, FileSpreadsheet, FolderOpen, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Modal } from "@/components/ui/Modal";
import {
  type BulkCsvProduct,
  collectCsvImageFileNames,
  matchProductImagesFromFolder,
  parseBulkProductsCsv,
} from "@/lib/bulk-csv";
import {
  type BulkDraftImage,
  type BulkDraftProduct,
  emptyBulkProduct,
  useBulkUploadStore,
} from "@/lib/bulk-upload-store";
import { detectColorFromFileName, normalizeColor } from "@/lib/product-options";
import { cn } from "@/lib/utils";

function toDraftProducts(
  parsed: BulkCsvProduct[],
  imagesByTitle: Map<string, File[]>
): BulkDraftProduct[] {
  return parsed.map((p) => {
    const variantColors = p.variants.map((v) => normalizeColor(v.color)).filter(Boolean);
    const files = imagesByTitle.get(p.title.toLowerCase()) ?? [];
    const images: BulkDraftImage[] = files.map((file, index) => {
      const fromName = detectColorFromFileName(file.name);
      const fromVariant = variantColors[index] || variantColors[0] || "";
      return {
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        url: URL.createObjectURL(file),
        fileName: file.name,
        color: fromName || fromVariant,
        file,
      };
    });

    return {
      id: `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: p.title,
      price: p.price,
      stock: p.stock,
      categoryName: p.categoryName.trim(),
      description: p.description,
      variants: p.variants.map((v) => ({
        color: normalizeColor(v.color),
        size: v.size,
        qty: v.qty,
      })),
      images,
    };
  });
}

export function AddMultipleProductsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}) {
  const router = useRouter();
  const setProducts = useBulkUploadStore((s) => s.setProducts);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<BulkCsvProduct[] | null>(null);
  const [csvImageNames, setCsvImageNames] = useState<string[]>([]);
  const [imagesByTitle, setImagesByTitle] = useState<Map<string, File[]>>(new Map());
  const [folderSelected, setFolderSelected] = useState(false);
  const [folderImageCount, setFolderImageCount] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = folderInputRef.current;
    if (!el) return;
    el.setAttribute("webkitdirectory", "");
    el.setAttribute("directory", "");
    el.multiple = true;
  }, [open, parsed]);

  const resetAll = () => {
    setFileName("");
    setParsed(null);
    setCsvImageNames([]);
    setImagesByTitle(new Map());
    setFolderSelected(false);
    setFolderImageCount(0);
    setMatchedCount(0);
    setError("");
    setDragging(false);
    if (csvInputRef.current) csvInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const handleCsvText = (text: string, name: string) => {
    try {
      const products = parseBulkProductsCsv(text);
      const imageNames = collectCsvImageFileNames(products);
      setParsed(products);
      setCsvImageNames(imageNames);
      setFileName(name);
      setImagesByTitle(new Map());
      setFolderSelected(false);
      setFolderImageCount(0);
      setMatchedCount(0);
      setError("");
    } catch (err) {
      setParsed(null);
      setCsvImageNames([]);
      setFileName("");
      setError(err instanceof Error ? err.message : "Failed to parse CSV");
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      handleCsvText(String(e.target?.result ?? ""), file.name);
    };
    reader.onerror = () => setError("Could not read the selected file.");
    reader.readAsText(file);
  };

  const handleFolderSelect = (fileList: FileList | null) => {
    if (!parsed) return;
    if (!fileList?.length) {
      setError("No files were selected from the folder.");
      return;
    }
    const result = matchProductImagesFromFolder(parsed, Array.from(fileList));
    if (!result.folderImageCount) {
      setError("No image files found in that folder.");
      setFolderSelected(false);
      setImagesByTitle(new Map());
      setFolderImageCount(0);
      setMatchedCount(0);
      return;
    }
    setImagesByTitle(result.byProductTitle);
    setFolderImageCount(result.folderImageCount);
    setMatchedCount(result.assignedCount);
    setFolderSelected(true);
    setError("");
  };

  const clearCsv = () => {
    resetAll();
  };

  const handleContinue = () => {
    if (!parsed?.length) {
      setError("Upload a CSV file before continuing.");
      return;
    }
    const drafts = toDraftProducts(parsed, imagesByTitle);
    setProducts(drafts.length ? drafts : [emptyBulkProduct()]);
    resetAll();
    onClose();
    router.push("/admin/products/bulk");
  };

  const productCount = parsed?.length ?? 0;
  const imageRefCount = csvImageNames.length;
  const canContinue = productCount > 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Upload Multiple Products"
      className="max-w-[560px] rounded-2xl"
    >
      <div>
        <div className="space-y-4 pb-1">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e8eef7] bg-[#f8fafc] px-4 py-3">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-[#1e293b]">Need a template?</p>
              <p className="mt-0.5 text-[12px] text-[#94a3b8]">
                XLSX with dropdown options for color, size {"&"} category
              </p>
            </div>
            <a
              href="/templates/products-template.csv"
              download
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#e8f0fe] px-3.5 py-2 text-[13px] font-medium text-[#3b82f6] transition hover:bg-[#dbe7fd]"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
          </div>

          <p className="text-[13px] leading-relaxed text-[#94a3b8]">
            Fill the template, save as CSV, then upload below. You can edit and attach images for
            each product on the next step.
          </p>

          {!parsed ? (
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") csvInputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileSelect(file);
              }}
              onClick={() => csvInputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-12 text-center transition",
                dragging
                  ? "border-[#5B8DEF] bg-[#eef4ff]"
                  : "border-[#c7d7f5] bg-[#f8fbff] hover:border-[#5B8DEF] hover:bg-[#eef4ff]"
              )}
            >
              <Upload className="mb-3 h-8 w-8 text-[#5B8DEF]" strokeWidth={1.75} />
              <p className="text-[15px] font-semibold text-[#334155]">
                Drag {"&"} Drop your CSV file here
              </p>
              <p className="mt-1 text-[13px] text-[#94a3b8]">or click to browse files</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-[#bfdbfe] bg-[#f0f7ff] px-4 py-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white">
                  <FileSpreadsheet className="h-5 w-5 text-[#3b82f6]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[#1e293b]">{fileName}</p>
                  <p className="text-[12px] text-[#64748b]">
                    {productCount} product{productCount === 1 ? "" : "s"} detected
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearCsv}
                  className="rounded-md p-1 text-[#94a3b8] transition hover:bg-white hover:text-[#64748b]"
                  aria-label="Remove CSV file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-xl border border-[#f5d9a8] bg-[#fff8eb] px-4 py-4">
                <p className="text-[14px] font-semibold text-[#b45309]">
                  {imageRefCount > 0
                    ? `${imageRefCount} image${imageRefCount === 1 ? "" : "s"} detected across ${productCount} product${productCount === 1 ? "" : "s"}`
                    : `Add images for ${productCount} product${productCount === 1 ? "" : "s"}`}
                </p>
                <p className="mt-1 text-[13px] text-[#c2410c]">
                  Select the folder containing your images to auto-match by filename.
                </p>
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#f0c674] bg-[#ffe8b8] px-4 py-2.5 text-[14px] font-medium text-[#b45309] transition hover:bg-[#ffdf9a]"
                >
                  <FolderOpen className="h-4 w-4" />
                  {folderSelected ? "Re-select Folder / Files" : "Select Images Folder"}
                </button>
                {folderSelected ? (
                  <div className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {matchedCount} of {folderImageCount} images selected
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
              e.target.value = "";
            }}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFolderSelect(e.target.files);
              e.target.value = "";
            }}
          />

          {error ? <p className="text-[12px] text-red-500">{error}</p> : null}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-[#eef2f7] pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-4 py-2.5 text-[14px] font-medium text-[#475569] transition hover:bg-[#f8fafc]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canContinue}
            onClick={handleContinue}
            className="rounded-lg bg-[#5B8DEF] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#4a7de8] disabled:cursor-not-allowed disabled:bg-[#c5d4f7] disabled:opacity-100"
          >
            Continue
          </button>
        </div>
      </div>
    </Modal>
  );
}
