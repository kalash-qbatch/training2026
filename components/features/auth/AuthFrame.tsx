import Image from "next/image";
import Link from "next/link";

import { BRAND_LOGO_SRC, BRAND_NAME } from "@/components/brand/BrandLogo";

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative h-dvh overflow-hidden min-[1000px]:grid min-[1000px]:grid-cols-2">
      <aside className="absolute inset-0 overflow-hidden bg-neutral-900 min-[1000px]:relative min-[1000px]:h-dvh">
        <Image
          src="/images/auth-atmosphere.png"
          alt=""
          fill
          priority
          sizes="(max-width: 999px) 100vw, 50vw"
          className="object-cover object-[62%_center]"
        />
        <div
          className="absolute inset-0 bg-gradient-to-tr from-brand-700/30 via-transparent to-transparent"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-neutral-900/45 min-[1000px]:bg-gradient-to-t min-[1000px]:from-neutral-900/90 min-[1000px]:via-neutral-900/30 min-[1000px]:to-neutral-900/5"
          aria-hidden
        />

        <div className="absolute inset-0 flex flex-col justify-between p-5 sm:p-8 min-[1000px]:p-8 lg:p-10 xl:p-12">
          <Link
            href="/products"
            className="hidden w-fit items-center gap-2.5 rounded-full border border-white/20 bg-white/15 py-1.5 pl-1.5 pr-3 text-white shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-md transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 min-[1000px]:inline-flex"
            aria-label={BRAND_NAME}
          >
            <span className="relative h-9 w-9 overflow-hidden rounded-full ring-1 ring-white/30">
              <Image
                src={BRAND_LOGO_SRC}
                alt=""
                width={36}
                height={36}
                priority
                className="h-full w-full object-cover"
              />
            </span>
            <span className="pr-1 text-sm font-semibold tracking-wide">{BRAND_NAME}</span>
          </Link>

          <div className="hidden max-w-md space-y-3 min-[1000px]:block">
            <p className="text-3xl font-semibold leading-[1.15] tracking-tight text-white drop-shadow-sm lg:text-4xl">
              Shop premium finds with a faster checkout.
            </p>
            <p className="max-w-sm text-sm leading-relaxed text-white/80 lg:text-base">
              Sign in to manage your cart, track orders, and pick up where you left off.
            </p>
          </div>
        </div>
      </aside>

      <section className="relative z-10 flex h-dvh flex-col overflow-hidden px-4 py-6 sm:px-6 min-[1000px]:bg-neutral-bg min-[1000px]:px-8">
        <div
          className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_at_top,_var(--color-brand-50)_0%,_transparent_55%)] min-[1000px]:block"
          aria-hidden
        />
        <div className="relative m-auto flex max-h-full w-full max-w-[400px] min-h-0 flex-col animate-fade-in-up">
          {children}
        </div>
      </section>
    </main>
  );
}
