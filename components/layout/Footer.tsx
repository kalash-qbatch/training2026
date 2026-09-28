const COPYRIGHT_YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="border-t border-neutral-border py-6 text-center text-xs text-neutral-muted">
      © {COPYRIGHT_YEAR} E-commerce
    </footer>
  );
}
