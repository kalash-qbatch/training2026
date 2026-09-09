"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { AuthCard } from "@/components/features/auth/AuthCard";
import { AuthCardHeader } from "@/components/features/auth/AuthCardHeader";
import { SocialAuthButtons } from "@/components/features/auth/SocialAuthButtons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { signUpRequest } from "@/lib/api/auth";
import { type SignUpInput, signUpSchema } from "@/lib/validations/auth";

const fieldClassName = "rounded-xl px-3.5 py-2.5";

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
      toast.success("Your account has been created.");
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    }
  });

  return (
    <AuthCard>
      <AuthCardHeader
        title="SignUp"
        description="Create your account to start shopping and tracking orders."
      />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input
          label="Fullname"
          placeholder="Please enter your full name"
          autoComplete="name"
          error={errors.fullName?.message}
          important
          className={fieldClassName}
          {...register("fullName")}
        />
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          important
          placeholder="Please enter your email"
          className={fieldClassName}
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          label="Mobile"
          type="tel"
          autoComplete="tel"
          placeholder="Please enter your mobile"
          important
          className={fieldClassName}
          error={errors.mobile?.message}
          {...register("mobile")}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          important
          placeholder="Please enter your password"
          className={fieldClassName}
          error={errors.password?.message}
          {...register("password")}
        />
        <Input
          label="Confirm Password"
          type="password"
          autoComplete="new-password"
          important
          placeholder="Please confirm your password"
          className={fieldClassName}
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <Button
          type="submit"
          loading={isSubmitting}
          className="mt-1 rounded-xl py-3 text-[15px] font-semibold shadow-sm shadow-brand-500/20"
        >
          SignUp
        </Button>
      </form>
      <SocialAuthButtons context="signup" />
      <p className="mt-5 text-center text-sm text-neutral-muted">
        Already have an account?{" "}
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
