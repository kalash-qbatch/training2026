"use client";

import { useState } from "react";

import { AlertTriangle, CheckCircle2, CreditCard, Loader2, Plus, Star, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";

import { useToast } from "@/components/ui/Toast";

const AddCardSection = dynamic(
  () => import("./AddCardSection").then((m) => ({ default: m.AddCardSection })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4 animate-pulse">
        <div className="h-12 rounded-xl bg-neutral-border/50" />
        <div className="flex gap-3">
          <div className="h-10 flex-1 rounded-xl bg-neutral-border/50" />
          <div className="h-10 flex-1 rounded-xl bg-neutral-border/40" />
        </div>
      </div>
    ),
  }
);

type SavedPM = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
};

const BRAND_ICONS: Record<string, string> = {
  visa: "💳",
  mastercard: "💳",
  amex: "💳",
  discover: "💳",
  jcb: "💳",
  unionpay: "💳",
  unknown: "💳",
};

function brandLabel(brand: string) {
  const map: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "Amex",
    discover: "Discover",
    jcb: "JCB",
    unionpay: "UnionPay",
  };
  return map[brand] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

function DeleteModal({
  pm,
  onConfirm,
  onCancel,
  deleting,
}: {
  pm: SavedPM;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <h3 className="font-semibold text-neutral-800">Remove Card?</h3>
        </div>
        <p className="mt-3 text-sm text-neutral-600">
          Remove {brandLabel(pm.brand)} ending in{" "}
          <span className="font-semibold">•••• {pm.last4}</span>? This action cannot be undone.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Remove
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function ManagePaymentMethodsClient({ initialPMs }: { initialPMs: SavedPM[] }) {
  const { toast } = useToast();
  const [pms, setPMs] = useState<SavedPM[]>(initialPMs);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SavedPM | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  async function handleSetDefault(pmId: string) {
    setSettingDefault(pmId);
    try {
      const res = await fetch("/api/payment-methods/default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId: pmId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to set default");

      setPMs((prev) => prev.map((pm) => ({ ...pm, isDefault: pm.id === pmId })));
      toast.success("Default payment method updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update default");
    } finally {
      setSettingDefault(null);
    }
  }

  async function handleDelete(pm: SavedPM) {
    setDeletingId(pm.id);
    try {
      const res = await fetch(`/api/payment-methods/${pm.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to remove card");

      setPMs((prev) => prev.filter((p) => p.id !== pm.id));
      toast.success("Card removed successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove card");
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Payment Methods</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Manage your saved cards for faster checkout.
          </p>
        </div>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 rounded-xl border border-brand-300 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-100 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Card
          </button>
        )}
      </div>

      {showAddForm ? (
        <div className="mb-6 rounded-2xl border border-brand-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-neutral-800">Add New Card</h2>
          <AddCardSection
            onSuccess={() => {
              fetch("/api/payment-methods")
                .then((r) => r.json())
                .then((d) => {
                  if (d.success) setPMs(d.paymentMethods);
                });
              setShowAddForm(false);
            }}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      ) : null}

      {pms.length === 0 && !showAddForm ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 py-16 text-center">
          <CreditCard className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
          <p className="font-medium text-neutral-500">No saved cards</p>
          <p className="mt-1 text-sm text-neutral-400">Add a card to speed up checkout.</p>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add Card
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {pms.map((pm) => (
            <div
              key={pm.id}
              className={`flex items-center gap-4 rounded-2xl border bg-white px-5 py-4 shadow-sm transition-all ${
                pm.isDefault ? "border-brand-300 ring-1 ring-brand-200" : "border-neutral-200"
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-2xl">
                {BRAND_ICONS[pm.brand] ?? "💳"}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-neutral-800">
                    {brandLabel(pm.brand)} •••• {pm.last4}
                  </span>
                  {pm.isDefault && (
                    <span className="flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                      <Star className="h-2.5 w-2.5" />
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500">
                  Expires {pm.expMonth.toString().padStart(2, "0")}/{pm.expYear}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!pm.isDefault && (
                  <button
                    type="button"
                    disabled={settingDefault === pm.id}
                    onClick={() => handleSetDefault(pm.id)}
                    className="flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    {settingDefault === pm.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    Set Default
                  </button>
                )}
                <button
                  type="button"
                  disabled={deletingId === pm.id}
                  onClick={() => setConfirmDelete(pm)}
                  className="flex items-center justify-center h-8 w-8 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50"
                  aria-label="Remove card"
                >
                  {deletingId === pm.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete ? (
        <DeleteModal
          pm={confirmDelete}
          deleting={deletingId === confirmDelete.id}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}
    </div>
  );
}
