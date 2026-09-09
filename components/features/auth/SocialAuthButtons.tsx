"use client";

import { signIn } from "next-auth/react";
import type { ReactNode } from "react";

import { FacebookIcon, GoogleIcon } from "@/components/ui/SocialIcons";
import { useToast } from "@/components/ui/Toast";
import { authCallbackUrl } from "@/lib/app-url";

type Provider = "google" | "facebook";

const providers: {
  id: Provider;
  label: string;
  shortLabel: string;
  icon: ReactNode;
}[] = [
  {
    id: "google",
    label: "Continue with Google",
    shortLabel: "Google",
    icon: <GoogleIcon size={18} />,
  },
  {
    id: "facebook",
    label: "Continue with Facebook",
    shortLabel: "Facebook",
    icon: <FacebookIcon size={18} className="text-[#1877F2]" />,
  },
];

type SocialAuthButtonsProps = {
  context?: "login" | "signup";
  getRememberMe?: () => boolean;
};

function setRememberMeCookie(isRemember: boolean) {
  document.cookie = `auth_remember_me=${isRemember}; path=/; max-age=300; SameSite=Lax`;
}

export function SocialAuthButtons({ context = "login", getRememberMe }: SocialAuthButtonsProps) {
  const { toast } = useToast();

  async function handleProvider(id: Provider, label: string) {
    try {
      setRememberMeCookie(getRememberMe ? getRememberMe() : true);
      await signIn(id, { callbackUrl: authCallbackUrl("/products") });
    } catch {
      toast.error(
        `${label} failed. Try again or use email ${context === "signup" ? "sign up" : "login"}.`
      );
    }
  }

  return (
    <div className="mt-5">
      <div className="relative mb-3.5 text-center">
        <span className="absolute inset-x-0 top-1/2 h-px bg-neutral-border" aria-hidden />
        <span className="relative bg-neutral-surface px-3 text-[11px] font-medium uppercase tracking-[0.1em] text-neutral-muted">
          Or continue with
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {providers.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-label={p.label}
            onClick={() => handleProvider(p.id, p.label)}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-neutral-border bg-white px-3 py-2 text-sm font-medium text-neutral-text transition hover:bg-neutral-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            {p.icon}
            <span className="truncate">{p.shortLabel}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
