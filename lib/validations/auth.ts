import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
  .regex(/[0-9]/, "Password must contain at least 1 number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least 1 special character");

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional(),
});

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name"),
    email: z.string().email("Enter a valid email address").trim().toLowerCase(),
    mobile: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{7,14}$/, "Enter a valid phone number (e.g. +911234567890)"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address").trim().toLowerCase(),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
