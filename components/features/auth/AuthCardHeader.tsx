type AuthCardHeaderProps = {
  title: string;
  description: string;
};

export function AuthCardHeader({ title, description }: AuthCardHeaderProps) {
  return (
    <header className="mb-5 space-y-1.5">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
      <p className="text-sm leading-relaxed text-neutral-muted">{description}</p>
    </header>
  );
}
