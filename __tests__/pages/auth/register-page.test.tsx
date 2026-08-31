/** @jest-environment jsdom */

import { screen } from "@testing-library/react";

import { renderWithProviders } from "@/__tests__/mocks/render";
import RegisterPage from "@/app/(auth)/register/page";

jest.mock("../../../components/features/auth/SignUpForm", () => ({
  SignUpForm: () => <div data-testid="signup-form">Sign Up Form</div>,
}));

describe("Register page", () => {
  it("renders sign-up form", async () => {
    renderWithProviders(<RegisterPage />);

    expect(await screen.findByTestId("signup-form")).toBeInTheDocument();
  });
});
