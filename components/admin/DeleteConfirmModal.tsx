"use client";

import { AlertTriangle } from "lucide-react";
import { Modal, ModalActions } from "@/components/ui/Modal";

export function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Remove Product">
      <div className="mb-1 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-[#F59E0B]" />
        <p className="text-[13px] text-gray-600">
          Are You Sure You Want To Delete The Item?
        </p>
      </div>
      <ModalActions
        onCancel={onClose}
        onConfirm={onConfirm}
        loading={loading}
      />
    </Modal>
  );
}
