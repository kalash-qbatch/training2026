"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, type SignUpInput } from "@/lib/validations/auth";
import { signUpRequest } from "@/lib/api/auth";
import { useToast } from "@/components/ui/Toast";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SocialAuthButtons } from "@/components/features/auth/SocialAuthButtons";

export function SignUpForm() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signUpRequest(values);
      toast.success(
        "Your account has been created. Instructions sent to your email id."
      );
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    }
  });

  return (
    <div className="w-full">
      <h1 className="mb-4 text-xl font-medium text-brand-500">SignUp</h1>
      <Card className="w-full">
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <Input
            label="Fullname"
            placeholder="Please enter your full name"
            error={errors.fullName?.message}
            {...register("fullName")}
          />
          <Input
            label="Email address"
            type="email"
            placeholder="Please enter your email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Mobile"
            type="tel"
            placeholder="Please enter your mobile"
            error={errors.mobile?.message}
            {...register("mobile")}
          />
          <Input
            label="Password"
            type="password"
            placeholder="Please enter your password"
            error={errors.password?.message}
            {...register("password")}
          />
          <Input
            label="Confirm Password"
            type="password"
            placeholder="Please confirm your password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
          <Button
            type="submit"
            loading={isSubmitting}
            className="mt-1 py-3 text-base font-semibold"
          >
            SignUp
          </Button>
        </form>
        <SocialAuthButtons context="signup" />
        <p className="mt-5 text-center text-sm text-neutral-muted">
          Already have an account!{" "}
          <Link
            href="/login"
            className="font-medium text-brand-500 hover:text-brand-600"
          >
            Login
          </Link>
        </p>
      </Card>
    </div>
  );
}
