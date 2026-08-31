/** @jest-environment jsdom */

import { screen } from "@testing-library/react";

import { renderWithProviders } from "@/__tests__/mocks/render";
import LoginPage from "@/app/(auth)/login/page";

jest.mock("../../../components/features/auth/LoginForm", () => ({
  LoginForm: () => <div data-testid="login-form">Login Form</div>,
}));

describe("Login page", () => {
  it("renders login form inside suspense boundary", async () => {
    renderWithProviders(<LoginPage />);

    expect(await screen.findByTestId("login-form")).toBeInTheDocument();
  });
});
