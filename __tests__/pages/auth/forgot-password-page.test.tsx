/** @jest-environment jsdom */

import { screen } from "@testing-library/react";

import { renderWithProviders } from "@/__tests__/mocks/render";
import ForgotPasswordPage from "@/app/(auth)/forgot-password/page";

jest.mock("../../../components/features/auth/ForgotPasswordForm", () => ({
  ForgotPasswordForm: () => <div data-testid="forgot-password-form">Forgot Password Form</div>,
}));

describe("Forgot password page", () => {
  it("renders forgot-password form", () => {
    renderWithProviders(<ForgotPasswordPage />);

    expect(screen.getByTestId("forgot-password-form")).toBeInTheDocument();
  });
});
