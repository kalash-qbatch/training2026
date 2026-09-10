"use client";

import { CheckCircle2, FolderOpen, Loader2 } from "lucide-react";

import { Modal } from "@/components/ui/Modal";

export type BulkProgressPhase = "images" | "queue" | "processing" | "done" | "error";

export function BulkUploadProgressModal({
  open,
  phase,
  current,
  total,
  message,
  error,
}: {
  open: boolean;
  phase: BulkProgressPhase;
  current: number;
  total: number;
  message?: string;
  error?: string;
}) {
  const safeTotal = Math.max(total, 1);
  const pct = Math.min(100, Math.round((current / safeTotal) * 100));
  const isError = phase === "error";

  const statusText =
    message ||
    (phase === "images"
      ? `Uploading images (${current}/${total})...`
      : phase === "queue"
        ? "Submitting products to queue..."
        : phase === "processing"
          ? `Processing products (${current}/${total})...`
          : phase === "done"
            ? "Bulk upload complete"
            : "Something went wrong");

  const footerLeft =
    phase === "images"
      ? `${current} of ${total} images`
      : phase === "processing"
        ? `${current} of ${total} products`
        : phase === "queue"
          ? "Queuing job…"
          : phase === "done"
            ? "Complete"
            : "Failed";

  return (
    <Modal
      open={open}
      onClose={() => undefined}
      title="Processing Bulk Upload"
      hideHeader
      className="max-w-md rounded-2xl p-8"
    >
      <div className="flex flex-col items-center text-center">
        {isError ? (
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
            <span className="text-xl font-bold">!</span>
          </div>
        ) : phase === "done" ? (
          <CheckCircle2 className="mb-5 h-12 w-12 text-emerald-500" strokeWidth={1.75} />
        ) : (
          <Loader2 className="mb-5 h-12 w-12 animate-spin text-[#5B8DEF]" strokeWidth={2} />
        )}

        <h2 className="text-[20px] font-semibold tracking-tight text-[#1e293b]">
          {isError ? "Upload Failed" : "Processing Bulk Upload"}
        </h2>
        <p className={`mt-2 text-[14px] ${isError ? "text-red-500" : "text-[#94a3b8]"}`}>
          {isError ? error || statusText : statusText}
        </p>

        {!isError ? (
          <>
            <div className="mt-8 h-2 w-full overflow-hidden rounded-full bg-[#eef2f7]">
              <div
                className="h-full rounded-full bg-[#5B8DEF] transition-[width] duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-3 flex w-full items-center justify-between text-[13px] text-[#94a3b8]">
              <span>{footerLeft}</span>
              <span>{pct}%</span>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

export function FolderHintIcon() {
  return <FolderOpen className="h-4 w-4" />;
}
