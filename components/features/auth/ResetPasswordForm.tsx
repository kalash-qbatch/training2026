"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validations/auth";
import {
  resetPasswordRequest,
  validateResetTokenRequest,
} from "@/lib/api/auth";
import { resetTokenExpiryLabel } from "@/lib/constants/auth";
import { useToast } from "@/components/ui/Toast";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const token = searchParams.get("token") ?? "";
  const [tokenStatus, setTokenStatus] = useState<
    "checking" | "valid" | "invalid"
  >("checking");
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
            err instanceof Error
              ? err.message
              : "Invalid or expired reset link. Request a new one."
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
      await resetPasswordRequest(
        token,
        values.password,
        values.confirmPassword
      );
      toast.success(
        "Your password has been updated. Please login with your new password."
      );
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
      <div className="w-full">
        <h1 className="mb-4 text-xl font-medium text-brand-500">
          Reset Password
        </h1>
        <Card className="w-full">
          <div className="h-24 animate-pulse rounded-lg bg-neutral-border/50" />
        </Card>
      </div>
    );
  }

  if (tokenStatus === "invalid") {
    return (
      <div className="w-full">
        <h1 className="mb-4 text-xl font-medium text-brand-500">
          Reset Password
        </h1>
        <Card className="w-full space-y-4">
          <p className="text-sm text-neutral-muted">{tokenError}</p>
          <Link
            href="/forgot-password"
            className="inline-block text-sm font-medium text-brand-500 hover:text-brand-600"
          >
            Request a new reset link
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1 className="mb-4 text-xl font-medium text-brand-500">Reset Password</h1>
      <Card className="w-full">
        <p className="mb-5 text-sm text-neutral-muted">
          Choose a new password. This link expires in{" "}
          <span className="font-medium text-neutral-text">
            {resetTokenExpiryLabel()}
          </span>{" "}
          and can only be used once.
        </p>
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <Input
            label="New password"
            type="password"
            placeholder="Please enter new password"
            error={errors.password?.message}
            {...register("password")}
          />
          <Input
            label="Confirm password"
            type="password"
            placeholder="Please confirm password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
          <Button
            type="submit"
            loading={isSubmitting}
            className="mt-1 py-3 text-base font-semibold"
          >
            Reset Password
          </Button>
        </form>
      </Card>
    </div>
  );
}
