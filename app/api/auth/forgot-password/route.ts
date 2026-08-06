import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getResetTokenExpiryDate } from "@/lib/constants/auth";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { sendPasswordResetEmail } from "@/lib/mail";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Invalid email",
        },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user?.email) {
      return NextResponse.json({
        success: true,
        message: "If the email exists, a reset link has been sent.",
      });
    }

    const resetToken = randomBytes(32).toString("hex");
    const resetTokenExp = getResetTokenExpiryDate();

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExp },
    });

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

    return NextResponse.json({
      success: true,
      message: "If the email exists, a reset link has been sent.",
      ...(process.env.NODE_ENV !== "production" ? { resetToken } : {}),
    });
  } catch (error) {
    console.error("forgot-password error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process forgot password request" },
      { status: 500 }
    );
  }
}
