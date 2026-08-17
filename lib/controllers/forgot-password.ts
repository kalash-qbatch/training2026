import { randomBytes } from "crypto";
import { getResetTokenExpiryDate } from "@/lib/constants/auth";
import { sendPasswordResetEmail } from "@/lib/mail";
import { findUserByEmail, setUserResetToken } from "@/lib/services/auth";
import { forgotPasswordSchema } from "@/lib/validations/auth";

const GENERIC_SUCCESS = {
  success: true as const,
  message: "If the email exists, a reset link has been sent.",
};

export async function forgotPassword(body: unknown) {
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return {
      status: 400,
      body: {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid email",
      },
    };
  }

  const email = parsed.data.email.toLowerCase();
  const user = await findUserByEmail(email);

  if (!user?.email) {
    return { status: 200, body: GENERIC_SUCCESS };
  }

  const resetToken = randomBytes(32).toString("hex");
  const resetTokenExp = getResetTokenExpiryDate();

  await setUserResetToken(user.id, resetToken, resetTokenExp);

  const baseUrl =
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

  await sendPasswordResetEmail({
    to: user.email,
    fullName: user.fullName || user.name || "User",
    resetUrl,
  });

  return {
    status: 200,
    body: {
      ...GENERIC_SUCCESS,
      ...(process.env.NODE_ENV !== "production" ? { resetToken } : {}),
    },
  };
}
