import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { passwordSchema } from "@/lib/validations/auth";

const resetBodySchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password does not match",
    path: ["confirmPassword"],
  });

async function invalidateToken(token: string) {
  await prisma.user.updateMany({
    where: { resetToken: token },
    data: { resetToken: null, resetTokenExp: null },
  });
}

async function findValidResetUser(token: string) {
  return prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExp: { gt: new Date() },
    },
  });
}

/** Validate reset link (time + one-time). Clears expired tokens. */
export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, valid: false, error: "Reset token is required" },
        { status: 400 }
      );
    }

    const user = await findValidResetUser(token);

    if (!user) {
      await invalidateToken(token);
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: "Invalid or expired reset link. Request a new one.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      valid: true,
      expiresAt: user.resetTokenExp,
    });
  } catch (error) {
    console.error("reset-password validate error:", error);
    return NextResponse.json(
      { success: false, valid: false, error: "Failed to validate reset link" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resetBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Invalid input",
        },
        { status: 400 }
      );
    }

    const { token, password } = parsed.data;
    const user = await findValidResetUser(token);

    if (!user) {
      await invalidateToken(token);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired reset link. Request a new one.",
        },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Successful attempt: clear token so the link cannot be reused.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExp: null,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Your password has been updated. Please login with your new password.",
    });
  } catch (error) {
    console.error("reset-password error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
