export async function signUpRequest(data: {
  fullName: string;
  email: string;
  mobile: string;
  password: string;
  confirmPassword?: string;
}): Promise<void> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: data.fullName,
      email: data.email,
      mobile: data.mobile,
      password: data.password,
      confirmPassword: data.confirmPassword ?? data.password,
    }),
  });
  const json = (await res.json()) as { success?: boolean; error?: string };
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Sign up failed");
  }
}

export async function forgotPasswordRequest(email: string): Promise<void> {
  const res = await fetch("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = (await res.json()) as {
    success?: boolean;
    error?: string;
    resetToken?: string;
  };
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to send reset email");
  }
  if (data.resetToken && process.env.NODE_ENV !== "production") {
    console.info("[dev] reset token:", data.resetToken);
  }
}

export async function validateResetTokenRequest(
  token: string
): Promise<{ valid: boolean; expiresAt?: string }> {
  const res = await fetch(
    `/api/auth/reset-password?token=${encodeURIComponent(token)}`
  );
  const data = (await res.json()) as {
    success?: boolean;
    valid?: boolean;
    expiresAt?: string;
    error?: string;
  };
  if (!res.ok || !data.valid) {
    throw new Error(data.error || "Invalid or expired reset link");
  }
  return { valid: true, expiresAt: data.expiresAt };
}

export async function resetPasswordRequest(
  token: string,
  password: string,
  confirmPassword: string = password
): Promise<void> {
  const res = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      password,
      confirmPassword,
    }),
  });
  const data = (await res.json()) as { success?: boolean; error?: string };
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to reset password");
  }
}
