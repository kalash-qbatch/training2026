"use client";

import { AlertTriangle } from "lucide-react";

import { Modal, ModalActions } from "@/components/ui/Modal";

export function RemoveProductModal({
  open,
  onClose,
  onConfirm,
  title = "Remove Product?",
  description = "Are you sure you want to delete the item!",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col items-center text-center">
        <AlertTriangle className="mb-3 h-12 w-12 text-status-warning-fg" aria-hidden />
        <p className="text-sm text-neutral-text">{description}</p>
      </div>
      <ModalActions onCancel={onClose} onConfirm={onConfirm} />
    </Modal>
  );
}
