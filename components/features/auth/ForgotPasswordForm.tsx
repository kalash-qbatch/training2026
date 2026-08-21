"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
      reset(); // clear the form state on success
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    }
  });

  return (
    <div className="w-full">
      <h1 className="mb-4 text-xl font-medium text-brand-500">Forgot Password</h1>
      <Card className="w-full">
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <Input
            label="Enter email address"
            type="email"
            important
            placeholder="Please enter your email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Button
            type="submit"
            loading={isSubmitting}
            className="mt-1 py-3 text-base font-semibold"
          >
            Forgot Password
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-neutral-muted">
          No, I remember my password!{" "}
          <Link href="/login" className="font-medium text-brand-500 hover:text-brand-600">
            Login
          </Link>
        </p>
      </Card>
    </div>
  );
}
