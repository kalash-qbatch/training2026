/** @jest-environment jsdom */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/__tests__/mocks/render";
import { ForgotPasswordForm } from "@/components/features/auth/ForgotPasswordForm";
import { forgotPasswordRequest } from "@/lib/api/auth";

jest.mock("../../../lib/api/auth", () => ({
  forgotPasswordRequest: jest.fn(),
}));

const mockedForgotPasswordRequest = forgotPasswordRequest as jest.MockedFunction<
  typeof forgotPasswordRequest
>;

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders forgot-password form", () => {
    renderWithProviders(<ForgotPasswordForm />);

    expect(screen.getByRole("heading", { name: /forgot password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/enter email address/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /forgot password/i })).toBeInTheDocument();
  });

  it("submits email and shows success toast", async () => {
    const user = userEvent.setup();
    mockedForgotPasswordRequest.mockResolvedValue(undefined);

    renderWithProviders(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/enter email address/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: /forgot password/i }));

    await waitFor(() => {
      expect(mockedForgotPasswordRequest).toHaveBeenCalledWith("user@example.com");
    });

    expect(await screen.findByText(/reset link sent/i)).toBeInTheDocument();
  });

  it("shows error toast when request fails", async () => {
    const user = userEvent.setup();
    mockedForgotPasswordRequest.mockRejectedValue(new Error("Request failed"));

    renderWithProviders(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/enter email address/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: /forgot password/i }));

    expect(await screen.findByText(/request failed/i)).toBeInTheDocument();
  });
});
