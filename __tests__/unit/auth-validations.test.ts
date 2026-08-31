import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signUpSchema,
} from "@/lib/validations/auth";

describe("auth validations — loginSchema", () => {
  it("accepts valid login input", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "secret",
      remember: true,
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "secret",
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("auth validations — signUpSchema", () => {
  it("accepts valid sign-up input", () => {
    const result = signUpSchema.safeParse({
      fullName: "John Smith",
      email: "john@example.com",
      mobile: "+911122334455",
      password: "SecurePass1!",
      confirmPassword: "SecurePass1!",
    });

    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = signUpSchema.safeParse({
      fullName: "John Smith",
      email: "john@example.com",
      mobile: "+911122334455",
      password: "SecurePass1!",
      confirmPassword: "Different1!",
    });

    expect(result.success).toBe(false);
  });

  it("rejects weak password", () => {
    const result = signUpSchema.safeParse({
      fullName: "John Smith",
      email: "john@example.com",
      mobile: "+911122334455",
      password: "weak",
      confirmPassword: "weak",
    });

    expect(result.success).toBe(false);
  });
});

describe("auth validations — forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(true);
  });
});

describe("auth validations — resetPasswordSchema", () => {
  it("accepts matching strong passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "NewSecure1!",
      confirmPassword: "NewSecure1!",
    });

    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "NewSecure1!",
      confirmPassword: "OtherSecure1!",
    });

    expect(result.success).toBe(false);
  });
});
