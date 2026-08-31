import bcrypt from "bcryptjs";

import { mockUser, validSignUpPayload } from "@/__tests__/mocks/data/users";
import { apiBody, getRequest, jsonRequest, parseJson } from "@/__tests__/mocks/helpers";
import { POST as forgotPasswordRoute } from "@/app/api/auth/forgot-password/route";
import { POST as registerRoute } from "@/app/api/auth/register/route";
import {
  GET as validateResetTokenRoute,
  POST as resetPasswordRoute,
} from "@/app/api/auth/reset-password/route";
import { register } from "@/lib/controllers/register";
import * as authService from "@/lib/services/auth";

jest.mock("../../lib/services/auth");
jest.mock("../../lib/mail", () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed-password"),
}));

const mockedAuth = authService as jest.Mocked<typeof authService>;

describe("Authentication — register controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 for invalid payload", async () => {
    const result = await register({ email: "not-an-email" });

    expect(result.status).toBe(400);
    expect(result.body.success).toBe(false);
    expect(mockedAuth.findUserByEmail).not.toHaveBeenCalled();
  });

  it("returns 409 when email already exists", async () => {
    mockedAuth.findUserByEmail.mockResolvedValue(mockUser as never);

    const result = await register(validSignUpPayload);

    expect(result.status).toBe(409);
    expect(apiBody<{ error: string }>(result.body).error).toMatch(/already exists/i);
    expect(mockedAuth.createUser).not.toHaveBeenCalled();
  });

  it("creates user with hashed password on success", async () => {
    mockedAuth.findUserByEmail.mockResolvedValue(null);
    mockedAuth.createUser.mockResolvedValue(mockUser as never);

    const result = await register(validSignUpPayload);

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(bcrypt.hash).toHaveBeenCalledWith(validSignUpPayload.password, 12);
    expect(mockedAuth.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: validSignUpPayload.email,
        passwordHash: "hashed-password",
      })
    );
  });
});

describe("Authentication — register API route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuth.findUserByEmail.mockResolvedValue(null);
    mockedAuth.createUser.mockResolvedValue(mockUser as never);
  });

  it("POST /api/auth/register returns created user", async () => {
    const response = await registerRoute(
      jsonRequest("http://localhost/api/auth/register", validSignUpPayload)
    );
    const body = await parseJson<{ success: boolean; user: { email: string } }>(response);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user.email).toBe(mockUser.email);
  });

  it("POST /api/auth/register returns 400 for invalid payload", async () => {
    const response = await registerRoute(
      jsonRequest("http://localhost/api/auth/register", { email: "bad-email" })
    );
    const body = await parseJson<{ success: boolean; error?: string }>(response);

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("POST /api/auth/register returns 500 on unexpected error", async () => {
    mockedAuth.createUser.mockRejectedValue(new Error("DB down"));

    const response = await registerRoute(
      jsonRequest("http://localhost/api/auth/register", validSignUpPayload)
    );
    const body = await parseJson<{ success: boolean; error: string }>(response);

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Registration failed");
  });
});

describe("Authentication — forgot password controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns generic success when user is not found", async () => {
    const { forgotPassword } = await import("@/lib/controllers/forgot-password");
    mockedAuth.findUserByEmail.mockResolvedValue(null);

    const result = await forgotPassword({ email: "missing@example.com" });

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(mockedAuth.setUserResetToken).not.toHaveBeenCalled();
  });

  it("sets reset token when user exists", async () => {
    const { forgotPassword } = await import("@/lib/controllers/forgot-password");
    mockedAuth.findUserByEmail.mockResolvedValue(mockUser as never);
    mockedAuth.setUserResetToken.mockResolvedValue(mockUser as never);

    const result = await forgotPassword({ email: mockUser.email });

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(mockedAuth.setUserResetToken).toHaveBeenCalledWith(
      mockUser.id,
      expect.any(String),
      expect.any(Date)
    );
  });
});

describe("Authentication — reset password controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 for invalid token payload", async () => {
    const { resetPassword } = await import("@/lib/controllers/reset-password");

    const result = await resetPassword({ token: "", password: "short", confirmPassword: "short" });

    expect(result.status).toBe(400);
    expect(result.body.success).toBe(false);
  });

  it("returns 400 for expired or invalid token", async () => {
    const { resetPassword } = await import("@/lib/controllers/reset-password");
    mockedAuth.findUserByValidResetToken.mockResolvedValue(null);
    mockedAuth.clearResetToken.mockResolvedValue(undefined);

    const result = await resetPassword({
      token: "invalid-token-value",
      password: "SecurePass1!",
      confirmPassword: "SecurePass1!",
    });

    expect(result.status).toBe(400);
    expect(apiBody<{ error: string }>(result.body).error).toMatch(/invalid or expired/i);
  });

  it("updates password when token is valid", async () => {
    const { resetPassword } = await import("@/lib/controllers/reset-password");
    mockedAuth.findUserByValidResetToken.mockResolvedValue({
      ...mockUser,
      resetTokenExp: new Date(Date.now() + 3600_000),
    } as never);
    mockedAuth.updatePasswordAndClearResetToken.mockResolvedValue(mockUser as never);

    const result = await resetPassword({
      token: "valid-reset-token",
      password: "NewSecure1!",
      confirmPassword: "NewSecure1!",
    });

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(mockedAuth.updatePasswordAndClearResetToken).toHaveBeenCalledWith(
      mockUser.id,
      expect.any(String)
    );
  });
});

describe("Authentication — forgot password API route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuth.findUserByEmail.mockResolvedValue(null);
  });

  it("POST /api/auth/forgot-password returns generic success", async () => {
    const response = await forgotPasswordRoute(
      jsonRequest("http://localhost/api/auth/forgot-password", { email: "missing@example.com" })
    );
    const body = await parseJson<{ success: boolean; message: string }>(response);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

describe("Authentication — reset password API routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET /api/auth/reset-password validates token query param", async () => {
    mockedAuth.findUserByValidResetToken.mockResolvedValue(null);
    mockedAuth.clearResetToken.mockResolvedValue(undefined);

    const response = await validateResetTokenRoute(
      getRequest("http://localhost/api/auth/reset-password?token=bad-token")
    );
    const body = await parseJson<{ success: boolean; valid: boolean }>(response);

    expect(response.status).toBe(400);
    expect(body.valid).toBe(false);
  });

  it("POST /api/auth/reset-password updates password", async () => {
    mockedAuth.findUserByValidResetToken.mockResolvedValue({
      ...mockUser,
      resetTokenExp: new Date(Date.now() + 3600_000),
    } as never);
    mockedAuth.updatePasswordAndClearResetToken.mockResolvedValue(mockUser as never);

    const response = await resetPasswordRoute(
      jsonRequest("http://localhost/api/auth/reset-password", {
        token: "valid-reset-token",
        password: "NewSecure1!",
        confirmPassword: "NewSecure1!",
      })
    );
    const body = await parseJson<{ success: boolean; message: string }>(response);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
