"use client";

import { AlertTriangle } from "lucide-react";
import { Modal, ModalActions } from "@/components/ui/Modal";

export function RemoveProductModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Remove Product?">
      <div className="flex flex-col items-center text-center">
        <AlertTriangle
          className="mb-3 h-12 w-12 text-status-warning-fg"
          aria-hidden
        />
        <p className="text-sm text-neutral-text">
          Are you sure you want to delete the item!
        </p>
      </div>
      <ModalActions onCancel={onClose} onConfirm={onConfirm} />
    </Modal>
  );
}
