"use client";

import { useEffect } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { useForm } from "react-hook-form";

import { AuthCard } from "@/components/features/auth/AuthCard";
import { AuthCardHeader } from "@/components/features/auth/AuthCardHeader";
import { SocialAuthButtons } from "@/components/features/auth/SocialAuthButtons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { sessionToAuthUser } from "@/lib/session-user";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { type LoginInput, loginSchema } from "@/lib/validations/auth";

const fieldClassName = "rounded-xl px-3.5 py-2.5";

export function LoginForm() {
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  useEffect(() => {
    const error = searchParams.get("error");
    if (!error) return;
    const messages: Record<string, string> = {
      OAuthAccountNotLinked: "This email is already registered with another sign-in method.",
      OAuthCallback: "Social login failed. Please try again.",
      AccessDenied: "Access was denied. Please try again.",
      Configuration: "Social login is misconfigured. Check OAuth app settings.",
      CredentialsSignin: "Wrong username/password, please enter correct credentials",
      Default: "Social login failed. Please try again.",
    };
    toast.error(messages[error] ?? messages.Default);
  }, [searchParams, toast]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        rememberMe: values.remember ? "true" : "false",
        redirect: false,
      });

      if (result?.error) {
        toast.error("Wrong username/password, please enter correct credentials");
        return;
      }

      const session = await getSession();
      const authUser = session ? sessionToAuthUser(session) : null;
      if (authUser) {
        login(authUser);
      }

      toast.success("Logged in successfully");
      const next = searchParams.get("next");
      const isAdmin = authUser?.role === "ADMIN";
      const destination = isAdmin
        ? next?.startsWith("/admin")
          ? next
          : "/admin/products"
        : next || "/products";
      window.location.assign(destination);
    } catch {
      toast.error("Wrong username/password, please enter correct credentials");
    }
  });

  return (
    <AuthCard>
      <AuthCardHeader
        title="Login"
        description="Welcome back. Enter your details to continue shopping."
      />
      <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
        <Input
          label="Enter email address"
          type="email"
          placeholder="Please enter your email"
          autoComplete="email"
          important
          className={fieldClassName}
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          label="Password"
          type="password"
          placeholder="Please enter your password"
          autoComplete="current-password"
          important
          className={fieldClassName}
          error={errors.password?.message}
          {...register("password")}
        />
        <div className="flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-neutral-muted">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-neutral-border text-brand-500 focus:ring-brand-500"
              {...register("remember")}
            />
            Remember me
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-brand-500 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Forgot password?
          </Link>
        </div>
        <Button
          type="submit"
          loading={isSubmitting}
          className="rounded-xl py-3 text-[15px] font-semibold shadow-sm shadow-brand-500/20"
        >
          Login
        </Button>
      </form>
      <SocialAuthButtons context="login" getRememberMe={() => !!getValues("remember")} />
      <p className="mt-5 text-center text-sm text-neutral-muted">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-semibold text-brand-500 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          Sign up
        </Link>
      </p>
    </AuthCard>
  );
}
