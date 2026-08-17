"use client";

import { useRef, useState } from "react";
import { CloudUpload, Trash2 } from "lucide-react";
import { bulkUploadProducts } from "@/lib/api/admin";
import { Modal } from "@/components/ui/Modal";

export function AddMultipleProductsModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [prevOpen, setPrevOpen] = useState(open);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state during render when the modal closes
  // (https://react.dev/learn/you-might-not-need-an-effect)
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setFiles([]);
      setError("");
      setLoading(false);
    }
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Multiple Products"
      className="max-w-lg rounded-xl"
    >
      <div
        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
      >
        <CloudUpload className="mb-2 h-8 w-8 text-[#2563EB]" />
        <p className="text-[13px] font-medium text-gray-700">Drop your file to upload</p>
        <p className="mt-1 text-[12px] text-gray-400">Browse your Device File</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 rounded-lg border border-[#2563EB] px-4 py-1.5 text-[12px] font-medium text-[#2563EB] transition hover:bg-brand-50"
        >
          Browse
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          multiple
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      <a
        href="/templates/products-template.csv"
        download
        className="mt-3 inline-block text-[12px] text-[#2563EB] hover:underline"
      >
        Download CSV template
      </a>

      {files.length ? (
        <div className="mt-4">
          <p className="mb-2 text-[12px] font-medium text-gray-700">Uploaded Files</p>
          <ul className="space-y-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-[12px]"
              >
                <span className="truncate text-gray-700">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-[#EF4444] transition hover:opacity-80"
                  aria-label="Remove file"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-[12px] text-red-500">{error}</p> : null}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          disabled={!files.length || loading}
          onClick={async () => {
            setLoading(true);
            setError("");
            try {
              for (const file of files) {
                await bulkUploadProducts(file);
              }
              onDone();
              onClose();
              setFiles([]);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Upload failed");
            } finally {
              setLoading(false);
            }
          }}
          className="rounded-lg bg-[#2563EB] px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          {loading ? "Uploading…" : "Upload File"}
        </button>
      </div>
    </Modal>
  );
}
