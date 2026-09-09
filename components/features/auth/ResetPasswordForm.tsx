"use client";

import { useEffect, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

import { AuthCard } from "@/components/features/auth/AuthCard";
import { AuthCardHeader } from "@/components/features/auth/AuthCardHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { resetPasswordRequest, validateResetTokenRequest } from "@/lib/api/auth";
import { resetTokenExpiryLabel } from "@/lib/constants/auth";
import { type ResetPasswordInput, resetPasswordSchema } from "@/lib/validations/auth";

const fieldClassName = "rounded-xl px-3.5 py-2.5";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const token = searchParams.get("token") ?? "";
  const [tokenStatus, setTokenStatus] = useState<"checking" | "valid" | "invalid">("checking");
  const [tokenError, setTokenError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    let cancelled = false;

    async function checkToken() {
      if (!token) {
        if (!cancelled) {
          setTokenStatus("invalid");
          setTokenError("Missing reset token. Request a new reset link.");
        }
        return;
      }

      try {
        await validateResetTokenRequest(token);
        if (!cancelled) setTokenStatus("valid");
      } catch (err) {
        if (!cancelled) {
          setTokenStatus("invalid");
          setTokenError(
            err instanceof Error ? err.message : "Invalid or expired reset link. Request a new one."
          );
        }
      }
    }

    void checkToken();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await resetPasswordRequest(token, values.password, values.confirmPassword);
      toast.success("Your password has been updated. Please login with your new password.");
      window.setTimeout(() => router.push("/login"), 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Reset failed";
      toast.error(message);
      if (/invalid|expired/i.test(message)) {
        setTokenStatus("invalid");
        setTokenError(message);
      }
    }
  });

  if (tokenStatus === "checking") {
    return (
      <AuthCard>
        <AuthCardHeader title="Reset Password" description="Checking your reset link…" />
        <div className="h-24 animate-pulse rounded-xl bg-neutral-border/50" />
      </AuthCard>
    );
  }

  if (tokenStatus === "invalid") {
    return (
      <AuthCard className="space-y-4">
        <AuthCardHeader title="Reset Password" description="This reset link is no longer valid." />
        <p className="text-sm text-neutral-muted">{tokenError}</p>
        <Link
          href="/forgot-password"
          className="inline-block text-sm font-semibold text-brand-500 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          Request a new reset link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <AuthCardHeader
        title="Reset Password"
        description={`Choose a new password. This link expires in ${resetTokenExpiryLabel()} and can only be used once.`}
      />
      <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="Please enter new password"
          important
          className={fieldClassName}
          error={errors.password?.message}
          {...register("password")}
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          important
          placeholder="Please confirm password"
          className={fieldClassName}
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <Button
          type="submit"
          loading={isSubmitting}
          className="rounded-xl py-3 text-[15px] font-semibold shadow-sm shadow-brand-500/20"
        >
          Reset Password
        </Button>
      </form>
    </AuthCard>
  );
}
