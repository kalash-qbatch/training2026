import { AuthFrame } from "@/components/features/auth/AuthFrame";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthFrame>{children}</AuthFrame>;
}
