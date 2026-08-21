import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { z } from "zod";

import {
  clearResetToken,
  findUserByValidResetToken,
  updatePasswordAndClearResetToken,
} from "@/lib/services/auth";
import { passwordSchema } from "@/lib/validations/auth";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

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

export async function validateResetToken(token: string | null) {
  if (!token) {
    return {
      status: 400,
      body: {
        success: false,
        valid: false,
        error: "Reset token is required",
      },
    };
  }

  const hashedToken = hashToken(token);
  const user = await findUserByValidResetToken(hashedToken);

  if (!user) {
    await clearResetToken(hashedToken);
    return {
      status: 400,
      body: {
        success: false,
        valid: false,
        error: "Invalid or expired reset link. Request a new one.",
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      valid: true,
      expiresAt: user.resetTokenExp,
    },
  };
}

export async function resetPassword(body: unknown) {
  const parsed = resetBodySchema.safeParse(body);

  if (!parsed.success) {
    return {
      status: 400,
      body: {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      },
    };
  }

  const { token, password } = parsed.data;
  const hashedToken = hashToken(token);
  const user = await findUserByValidResetToken(hashedToken);

  if (!user) {
    await clearResetToken(hashedToken);
    return {
      status: 400,
      body: {
        success: false,
        error: "Invalid or expired reset link. Request a new one.",
      },
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await updatePasswordAndClearResetToken(user.id, passwordHash);

  return {
    status: 200,
    body: {
      success: true,
      message: "Your password has been updated. Please login with your new password.",
    },
  };
}
