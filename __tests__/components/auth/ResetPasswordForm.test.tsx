/** @jest-environment jsdom */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mockPush } from "@/__tests__/mocks/next-navigation";
import { renderWithProviders } from "@/__tests__/mocks/render";
import { ResetPasswordForm } from "@/components/features/auth/ResetPasswordForm";
import { resetPasswordRequest, validateResetTokenRequest } from "@/lib/api/auth";

let searchParamsToken = "valid-token";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
  useSearchParams: () => ({
    get: (key: string) => (key === "token" ? searchParamsToken : null),
  }),
}));

jest.mock("../../../lib/api/auth", () => ({
  validateResetTokenRequest: jest.fn(),
  resetPasswordRequest: jest.fn(),
}));

const mockedValidateToken = validateResetTokenRequest as jest.MockedFunction<
  typeof validateResetTokenRequest
>;
const mockedResetPassword = resetPasswordRequest as jest.MockedFunction<
  typeof resetPasswordRequest
>;

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchParamsToken = "valid-token";
    mockedValidateToken.mockResolvedValue({
      valid: true,
      expiresAt: "2026-08-31T12:00:00.000Z",
    });
  });

  it("shows invalid state when token is missing", async () => {
    searchParamsToken = "";

    renderWithProviders(<ResetPasswordForm />);

    expect(await screen.findByText(/missing reset token/i)).toBeInTheDocument();
    expect(mockedValidateToken).not.toHaveBeenCalled();
  });

  it("renders reset form after token validation succeeds", async () => {
    renderWithProviders(<ResetPasswordForm />);

    expect(await screen.findByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(mockedValidateToken).toHaveBeenCalledWith("valid-token");
  });

  it("shows invalid state when token validation fails", async () => {
    mockedValidateToken.mockRejectedValue(new Error("Invalid or expired reset link"));

    renderWithProviders(<ResetPasswordForm />);

    expect(await screen.findByText(/invalid or expired reset link/i)).toBeInTheDocument();
  });

  it("submits new password and redirects to login", async () => {
    const user = userEvent.setup();
    mockedResetPassword.mockResolvedValue(undefined);

    renderWithProviders(<ResetPasswordForm />);
    await screen.findByLabelText(/new password/i);

    await user.type(screen.getByLabelText(/new password/i), "NewSecure1!");
    await user.type(screen.getByLabelText(/confirm password/i), "NewSecure1!");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(mockedResetPassword).toHaveBeenCalledWith("valid-token", "NewSecure1!", "NewSecure1!");
    });

    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith("/login");
      },
      { timeout: 2000 }
    );
  });
});
