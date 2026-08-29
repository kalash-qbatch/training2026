"use client";

import { type ReactNode, useState } from "react";

import {
  AlertCircle,
  ArrowLeft,
  Building2,
  ChevronRight,
  Hash,
  Mail,
  MapPin,
  Phone,
  User,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { UserInfo, UserInfoErrors } from "@/types";

type Props = {
  initial: UserInfo;
  onContinue: (info: UserInfo) => void;
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1 text-xs text-red-500" role="alert">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

function inputCls(hasError: boolean, extra?: string) {
  return cn(
    "w-full rounded-lg border bg-white text-sm text-neutral-text",
    "placeholder:text-neutral-muted/90 transition-colors",
    "focus-visible:outline-none focus-visible:ring-2",
    hasError
      ? "border-red-400 focus-visible:border-red-400 focus-visible:ring-red-200"
      : "border-neutral-border focus-visible:border-brand-500 focus-visible:ring-brand-500/20",
    extra
  );
}

function Field({
  id,
  label,
  error,
  icon,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="group min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-neutral-text">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        {icon ? (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-muted transition-colors group-focus-within:text-brand-500">
            {icon}
          </div>
        ) : null}
        {children}
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-muted">
      {children}
    </p>
  );
}

export function UserInfoForm({ initial, onContinue }: Props) {
  const [form, setForm] = useState<UserInfo>(initial);
  const [errors, setErrors] = useState<UserInfoErrors>({});

  function validate(): boolean {
    const e: UserInfoErrors = {};

    if (!form.fullName.trim()) e.fullName = "Full name is required";
    else if (form.fullName.trim().length < 2) e.fullName = "Name must be at least 2 characters";

    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email address";

    if (!form.phone.trim()) e.phone = "Phone number is required";
    else if (!/^\+?[\d\s\-()]{7,15}$/.test(form.phone)) e.phone = "Enter a valid phone number";

    if (!form.address.trim()) e.address = "Street address is required";
    if (!form.city.trim()) e.city = "City is required";
    if (!form.postalCode.trim()) e.postalCode = "Postal code is required";

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleChange(field: keyof UserInfo, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) onContinue(form);
  }

  const iconCls = "h-4 w-4";

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-5 sm:space-y-6">
        <div>
          <h2 className="text-base font-semibold text-neutral-text">Delivery information</h2>
          <p className="mt-0.5 text-sm text-neutral-muted">Where should we send your order?</p>
        </div>

        <div className="space-y-4">
          <SectionLabel>Contact</SectionLabel>
          <Field
            id="checkout-full-name"
            label="Full Name"
            error={errors.fullName}
            icon={<User className={iconCls} />}
          >
            <input
              id="checkout-full-name"
              type="text"
              name="name"
              autoComplete="name"
              value={form.fullName}
              onChange={(e) => handleChange("fullName", e.target.value)}
              placeholder="John Doe"
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? "checkout-full-name-error" : undefined}
              className={inputCls(!!errors.fullName, "h-11 py-2.5 pl-10 pr-3.5")}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="checkout-email"
              label="Email Address"
              error={errors.email}
              icon={<Mail className={iconCls} />}
            >
              <input
                id="checkout-email"
                type="email"
                name="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="john@example.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "checkout-email-error" : undefined}
                className={inputCls(!!errors.email, "h-11 py-2.5 pl-10 pr-3.5")}
              />
            </Field>

            <Field
              id="checkout-phone"
              label="Phone Number"
              error={errors.phone}
              icon={<Phone className={iconCls} />}
            >
              <input
                id="checkout-phone"
                type="tel"
                name="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="(555) 000-0000"
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? "checkout-phone-error" : undefined}
                className={inputCls(!!errors.phone, "h-11 py-2.5 pl-10 pr-3.5")}
              />
            </Field>
          </div>
        </div>

        <div className="space-y-4 border-t border-neutral-100 pt-5">
          <SectionLabel>Shipping address</SectionLabel>
          <div className="group">
            <label
              htmlFor="checkout-address"
              className="mb-1.5 block text-sm font-medium text-neutral-text"
            >
              Street Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-3 text-neutral-muted transition-colors group-focus-within:text-brand-500">
                <MapPin className={iconCls} />
              </div>
              <textarea
                id="checkout-address"
                name="street-address"
                autoComplete="street-address"
                value={form.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="123 Main Street, Apt 4B"
                rows={2}
                aria-invalid={Boolean(errors.address)}
                aria-describedby={errors.address ? "checkout-address-error" : undefined}
                className={inputCls(!!errors.address, "resize-none py-2.5 pl-10 pr-3.5")}
              />
            </div>
            <FieldError id="checkout-address-error" message={errors.address} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="checkout-city"
              label="City"
              error={errors.city}
              icon={<Building2 className={iconCls} />}
            >
              <input
                id="checkout-city"
                type="text"
                name="city"
                autoComplete="address-level2"
                value={form.city}
                onChange={(e) => handleChange("city", e.target.value)}
                placeholder="New York"
                aria-invalid={Boolean(errors.city)}
                aria-describedby={errors.city ? "checkout-city-error" : undefined}
                className={inputCls(!!errors.city, "h-11 px-3.5 py-2.5 pl-10")}
              />
            </Field>

            <Field
              id="checkout-postal"
              label="Postal Code"
              error={errors.postalCode}
              icon={<Hash className={iconCls} />}
            >
              <input
                id="checkout-postal"
                type="text"
                name="postal-code"
                autoComplete="postal-code"
                value={form.postalCode}
                onChange={(e) => handleChange("postalCode", e.target.value)}
                placeholder="10001"
                aria-invalid={Boolean(errors.postalCode)}
                aria-describedby={errors.postalCode ? "checkout-postal-error" : undefined}
                className={inputCls(!!errors.postalCode, "h-11 px-3.5 py-2.5 pl-10")}
              />
            </Field>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <Button type="submit" className="h-12 w-full rounded-lg text-[15px] font-semibold">
            Continue to Payment
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Link
            href="/cart"
            className="flex items-center justify-center gap-1.5 text-sm text-neutral-muted transition-colors hover:text-brand-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Cart
          </Link>
        </div>
      </div>
    </form>
  );
}
