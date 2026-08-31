import { mockUser, validSignUpPayload } from "@/__tests__/mocks/data/users";
import {
  forgotPasswordRequest,
  resetPasswordRequest,
  signUpRequest,
  validateResetTokenRequest,
} from "@/lib/api/auth";

function mockFetchResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

describe("lib/api/auth — signUpRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("posts registration payload and resolves on success", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(mockFetchResponse(200, { success: true, user: mockUser }));
    global.fetch = fetchMock;

    await expect(signUpRequest(validSignUpPayload)).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validSignUpPayload),
    });
  });

  it("throws with API error message on failure", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockFetchResponse(409, { success: false, error: "Email already exists" }));

    await expect(signUpRequest(validSignUpPayload)).rejects.toThrow("Email already exists");
  });
});

describe("lib/api/auth — forgotPasswordRequest", () => {
  it("resolves when reset email request succeeds", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockFetchResponse(200, { success: true, message: "Email sent" }));

    await expect(forgotPasswordRequest("user@example.com")).resolves.toBeUndefined();
  });

  it("throws when forgot-password request fails", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockFetchResponse(400, { success: false, error: "Invalid email" }));

    await expect(forgotPasswordRequest("bad-email")).rejects.toThrow("Invalid email");
  });
});

describe("lib/api/auth — validateResetTokenRequest", () => {
  it("returns valid token metadata", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockFetchResponse(200, {
        success: true,
        valid: true,
        expiresAt: "2026-08-31T12:00:00.000Z",
      })
    );

    await expect(validateResetTokenRequest("token-123")).resolves.toEqual({
      valid: true,
      expiresAt: "2026-08-31T12:00:00.000Z",
    });
  });

  it("throws for invalid reset token", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockFetchResponse(400, { success: false, valid: false }));

    await expect(validateResetTokenRequest("bad-token")).rejects.toThrow(/invalid or expired/i);
  });
});

describe("lib/api/auth — resetPasswordRequest", () => {
  it("posts new password and resolves on success", async () => {
    const fetchMock = jest.fn().mockResolvedValue(mockFetchResponse(200, { success: true }));
    global.fetch = fetchMock;

    await expect(resetPasswordRequest("token-123", "NewSecure1!")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "token-123",
        password: "NewSecure1!",
        confirmPassword: "NewSecure1!",
      }),
    });
  });
});
