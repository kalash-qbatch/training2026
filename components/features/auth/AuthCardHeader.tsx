import { BrandLogo } from "@/components/brand/BrandLogo";

type AuthCardHeaderProps = {
  title: string;
  description: string;
};

export function AuthCardHeader({ title, description }: AuthCardHeaderProps) {
  return (
    <header className="mb-5 shrink-0 space-y-1.5">
      <div className="mb-3.5 block min-[1000px]:hidden">
        <BrandLogo href="/products" size="sm" showWordmark />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
      <p className="text-sm leading-relaxed text-neutral-muted">{description}</p>
    </header>
  );
}
