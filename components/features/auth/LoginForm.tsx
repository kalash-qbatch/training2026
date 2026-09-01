"use client";

import { useEffect } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { useForm } from "react-hook-form";

import { SocialAuthButtons } from "@/components/features/auth/SocialAuthButtons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { sessionToAuthUser } from "@/lib/session-user";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { type LoginInput, loginSchema } from "@/lib/validations/auth";

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
      // Full navigation so middleware sees the fresh JWT + role
      window.location.assign(destination);
    } catch {
      toast.error("Wrong username/password, please enter correct credentials");
    }
  });

  return (
    <div className="w-full">
      <h1 className="mb-4 text-xl font-medium text-brand-500">Login</h1>
      <Card className="w-full">
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <Input
            label="Enter email address"
            type="email"
            placeholder="Please enter your email"
            autoComplete="email"
            important
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Password"
            type="password"
            placeholder="Please enter your password"
            autoComplete="current-password"
            important
            error={errors.password?.message}
            {...register("password")}
          />
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-neutral-muted">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-neutral-border text-brand-500 focus:ring-brand-500"
              {...register("remember")}
            />
            Remember me
          </label>
          <Button
            type="submit"
            loading={isSubmitting}
            className="mt-1 py-3 text-base font-semibold"
          >
            Login
          </Button>
        </form>
        <SocialAuthButtons context="login" getRememberMe={() => !!getValues("remember")} />
        <div className="mt-5 space-y-2.5 text-center text-sm text-neutral-muted">
          <p>
            Forgot Password!{" "}
            <Link
              href="/forgot-password"
              className="font-medium text-brand-500 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              Reset
            </Link>
          </p>
          <p>
            I don&apos;t have an account!{" "}
            <Link
              href="/register"
              className="font-medium text-brand-500 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              SignUp
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
