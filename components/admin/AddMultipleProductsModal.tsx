"use client";

import { useEffect, useRef, useState } from "react";

import { CheckCircle2, Download, FileSpreadsheet, FolderOpen, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Modal } from "@/components/ui/Modal";
import {
  type BulkCsvProduct,
  collectCsvImageFileNames,
  isImageMappedToProduct,
  matchProductImagesFromFolder,
  parseBulkProductsFile,
  resolveBulkVariants,
} from "@/lib/bulk-csv";
import {
  type BulkDraftImage,
  type BulkDraftProduct,
  emptyBulkProduct,
  useBulkUploadStore,
} from "@/lib/bulk-upload-store";
import { detectColorFromFileName, normalizeColor } from "@/lib/product-options";
import { cn } from "@/lib/utils";

function colorForImage(
  fileName: string,
  product: BulkCsvProduct,
  variants: Array<{ color: string }>
): string {
  const base = fileName.toLowerCase();
  const baseNoExt = base.replace(/\.[^.]+$/, "");
  const fromCsv = product.imageRefs.find((r) => {
    const listed = r.fileName.toLowerCase();
    const listedNoExt = listed.replace(/\.[^.]+$/, "");
    return listed === base || listedNoExt === baseNoExt || base.endsWith(listed);
  });
  // CSV row color wins (e.g. jacket_red.jpeg → Black in the sheet).
  if (fromCsv?.color) return normalizeColor(fromCsv.color);

  const fromName = detectColorFromFileName(fileName);
  if (fromName) {
    const csvMatch = variants.find((v) => v.color.toLowerCase() === fromName.toLowerCase());
    if (csvMatch) return csvMatch.color;
    return normalizeColor(fromName);
  }

  return normalizeColor(variants[0]?.color || "");
}

/**
 * Build draft products. When the CSV/XLSX has color/size/qty rows, those win exactly —
 * images must never invent colors or even-split stock over file data.
 */
function toDraftProducts(
  parsed: BulkCsvProduct[],
  imagesByProductId: Map<string, File[]>
): BulkDraftProduct[] {
  return parsed.map((p) => {
    const files = imagesByProductId.get(p.id) ?? [];
    const attachedNames = files.map((f) => f.name || f.webkitRelativePath.split("/").pop() || "");
    const variants = resolveBulkVariants(p, attachedNames);

    const images: BulkDraftImage[] = [];
    for (const file of files) {
      const fileName = file.name || file.webkitRelativePath.split("/").pop() || "";
      if (p.imageFileNames.length > 0 && !isImageMappedToProduct(p, fileName)) {
        console.warn(
          `[bulk-csv] Image "${fileName}" attached to "${p.title}" via title/color match (not listed in CSV image column)`
        );
      }
      images.push({
        id: `img-${p.id}-${fileName}`,
        url: URL.createObjectURL(file),
        fileName,
        color: colorForImage(fileName, p, variants),
        file,
      });
    }

    const stock = variants.length ? variants.reduce((sum, v) => sum + v.qty, 0) : p.stock;

    return {
      id: p.id,
      title: p.title,
      price: p.price,
      stock,
      categoryName: p.categoryName.trim(),
      variants,
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
  const [imagesByProductId, setImagesByProductId] = useState<Map<string, File[]>>(new Map());
  const [folderSelected, setFolderSelected] = useState(false);
  const [folderImageCount, setFolderImageCount] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
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
    setImagesByProductId(new Map());
    setFolderSelected(false);
    setFolderImageCount(0);
    setMatchedCount(0);
    setUnmatchedCount(0);
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
      const products = parseBulkProductsFile(text, name);
      const imageNames = collectCsvImageFileNames(products);
      setParsed(products);
      setCsvImageNames(imageNames);
      setFileName(name);
      setImagesByProductId(new Map());
      setFolderSelected(false);
      setFolderImageCount(0);
      setMatchedCount(0);
      setUnmatchedCount(0);
      setError("");
    } catch (err) {
      setParsed(null);
      setCsvImageNames([]);
      setFileName("");
      setError(err instanceof Error ? err.message : "Failed to parse file");
    }
  };

  const handleFileSelect = (file: File) => {
    const lower = file.name.toLowerCase();
    const isCsv = lower.endsWith(".csv");
    const isExcel = lower.endsWith(".xlsx") || lower.endsWith(".xls");
    if (!isCsv && !isExcel) {
      setError("Please upload a .csv or .xlsx file.");
      return;
    }

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result;
          if (!(buffer instanceof ArrayBuffer)) {
            setError("Could not read the Excel file.");
            return;
          }
          const products = parseBulkProductsFile(buffer, file.name);
          const imageNames = collectCsvImageFileNames(products);
          setParsed(products);
          setCsvImageNames(imageNames);
          setFileName(file.name);
          setImagesByProductId(new Map());
          setFolderSelected(false);
          setFolderImageCount(0);
          setMatchedCount(0);
          setUnmatchedCount(0);
          setError("");
        } catch (err) {
          setParsed(null);
          setCsvImageNames([]);
          setFileName("");
          setError(err instanceof Error ? err.message : "Failed to parse Excel file");
        }
      };
      reader.onerror = () => setError("Could not read the selected file.");
      reader.readAsArrayBuffer(file);
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
      setImagesByProductId(new Map());
      setFolderImageCount(0);
      setMatchedCount(0);
      setUnmatchedCount(0);
      return;
    }
    setImagesByProductId(result.byProductId);
    setFolderImageCount(result.folderImageCount);
    setMatchedCount(result.assignedCount);
    setUnmatchedCount(result.unmatchedFolderFiles.length);
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
    const drafts = toDraftProducts(parsed, imagesByProductId);
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
                CSV or XLSX with color, size {"&"} qty per variant row
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
            Fill one row per color/size with its own qty (e.g. Blue/M/15, Black/L/16), save as CSV
            or XLSX, then upload. Sizes and quantities come from these rows — not from image
            filenames.
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
                Drag {"&"} Drop your CSV or Excel file here
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
                    {parsed
                      ? ` · ${parsed.reduce((n, p) => n + p.variants.length, 0)} variants`
                      : ""}
                  </p>
                  {parsed?.[0]?.variants.length ? (
                    <p className="mt-0.5 truncate text-[11px] text-[#94a3b8]">
                      e.g.{" "}
                      {parsed[0].variants
                        .slice(0, 3)
                        .map((v) => `${v.color || "—"}/${v.size || "—"}/${v.qty}`)
                        .join(", ")}
                    </p>
                  ) : null}
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
                  Select the folder containing your images. Files are matched by CSV image filename
                  first, then by product title / color in the filename. Unmatched files are skipped
                  (never shared across products).
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
                  <div className="mt-3 space-y-1 text-[13px] font-medium">
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      {matchedCount} of {folderImageCount} images matched to CSV rows
                    </div>
                    {unmatchedCount > 0 ? (
                      <p className="text-[12px] font-normal text-[#b45309]">
                        {unmatchedCount} folder image{unmatchedCount === 1 ? "" : "s"} skipped (no
                        unique match to a product)
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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
