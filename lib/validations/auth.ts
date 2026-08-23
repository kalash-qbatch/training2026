import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Passwords must contain at least 8 characters, 1 capital, 1 number, and 1 symbol")
  .regex(/[A-Z]/, "Passwords must contain at least 8 characters, 1 capital, 1 number, and 1 symbol")
  .regex(/[0-9]/, "Passwords must contain at least 8 characters, 1 capital, 1 number, and 1 symbol")
  .regex(
    /[^A-Za-z0-9]/,
    "Passwords must contain at least 8 characters, 1 capital, 1 number, and 1 symbol"
  );

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  remember: z.boolean().optional(),
});

export const signUpSchema = z
  .object({
    fullName: z.string().min(2, "Enter your full name"),
    email: z.email("Enter a valid email address"),
    mobile: z
      .string()
      .min(10, "Enter a valid mobile number with country code (e.g. +911234567890)")
      .regex(/^[0-9]+$/, "Enter a valid mobile number with country code (e.g. +911234567890)"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password does not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password does not match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
