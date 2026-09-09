"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";

import { AuthCard } from "@/components/features/auth/AuthCard";
import { AuthCardHeader } from "@/components/features/auth/AuthCardHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { forgotPasswordRequest } from "@/lib/api/auth";
import { resetTokenExpiryLabel } from "@/lib/constants/auth";
import { type ForgotPasswordInput, forgotPasswordSchema } from "@/lib/validations/auth";

export function ForgotPasswordForm() {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await forgotPasswordRequest(values.email);
      toast.success(
        `Reset link sent. It expires in ${resetTokenExpiryLabel()} and can only be used once.`
      );
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    }
  });

  return (
    <AuthCard>
      <AuthCardHeader
        title="Forgot Password"
        description="Enter your email and we'll send a one-time reset link."
      />
      <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
        <Input
          label="Enter email address"
          type="email"
          autoComplete="email"
          important
          placeholder="Please enter your email"
          className="rounded-xl px-3.5 py-2.5"
          error={errors.email?.message}
          {...register("email")}
        />
        <Button
          type="submit"
          loading={isSubmitting}
          className="rounded-xl py-3 text-[15px] font-semibold shadow-sm shadow-brand-500/20"
        >
          Forgot Password
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-neutral-muted">
        Remember your password?{" "}
        <Link
          href="/login"
          className="font-semibold text-brand-500 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          Login
        </Link>
      </p>
    </AuthCard>
  );
}
