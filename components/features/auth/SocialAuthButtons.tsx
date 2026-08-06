"use client";

import type { ReactNode } from "react";
import { signIn } from "next-auth/react";
import { useToast } from "@/components/ui/Toast";
import { GithubIcon, GoogleIcon } from "@/components/ui/SocialIcons";

type Provider = "google" | "github";

const providers: {
  id: Provider;
  label: string;
  icon: ReactNode;
  className: string;
}[] = [
  {
    id: "google",
    label: "Continue with Google",
    icon: <GoogleIcon size={18} />,
    className:
      "border-neutral-border bg-white text-neutral-text hover:bg-neutral-bg",
  },
  {
    id: "github",
    label: "Continue with GitHub",
    icon: <GithubIcon size={18} className="text-neutral-text" />,
    className:
      "border-neutral-border bg-neutral-surface text-neutral-text hover:bg-neutral-bg",
  },
];

type SocialAuthButtonsProps = {
  context?: "login" | "signup";
};

export function SocialAuthButtons({ context = "login" }: SocialAuthButtonsProps) {
  const { toast } = useToast();

  async function handleProvider(id: Provider, label: string) {
    try {
      await signIn(id, { callbackUrl: "/products" });
    } catch {
      toast.error(
        `${label} failed. Try again or use email ${context === "signup" ? "sign up" : "login"}.`
      );
    }
  }

  return (
    <div className="mt-5">
      <div className="relative mb-5 text-center">
        <span className="absolute inset-x-0 top-1/2 h-px bg-neutral-border" aria-hidden />
        <span className="relative bg-neutral-surface px-3 text-xs font-medium uppercase tracking-wide text-neutral-muted">
          Or continue with
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {providers.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handleProvider(p.id, p.label)}
            className={`inline-flex w-full items-center justify-center gap-2.5 rounded-md border px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${p.className}`}
          >
            {p.icon}
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
