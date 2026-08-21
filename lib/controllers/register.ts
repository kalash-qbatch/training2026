import bcrypt from "bcryptjs";

import { createUser, findUserByEmail } from "@/lib/services/auth";
import { signUpSchema } from "@/lib/validations/auth";

export async function register(body: unknown) {
  const parsed = signUpSchema.safeParse(body);

  if (!parsed.success) {
    return {
      status: 400,
      body: {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      },
    };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await findUserByEmail(email);
  if (existing) {
    return {
      status: 409,
      body: {
        success: false,
        error: "An account with this email already exists",
      },
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await createUser({
    fullName: parsed.data.fullName,
    email,
    phone: parsed.data.mobile,
    passwordHash,
  });

  return {
    status: 200,
    body: {
      success: true,
      message: "Your account has been created.",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        mobile: user.phone,
      },
    },
  };
}
