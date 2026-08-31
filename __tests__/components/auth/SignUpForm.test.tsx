/** @jest-environment jsdom */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { validSignUpPayload } from "@/__tests__/mocks/data/users";
import { mockPush } from "@/__tests__/mocks/next-navigation";
import { renderWithProviders } from "@/__tests__/mocks/render";
import { SignUpForm } from "@/components/features/auth/SignUpForm";
import { signUpRequest } from "@/lib/api/auth";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
}));

jest.mock("../../../lib/api/auth", () => ({
  signUpRequest: jest.fn(),
}));

jest.mock("../../../components/features/auth/SocialAuthButtons", () => ({
  SocialAuthButtons: () => <div data-testid="social-auth-buttons" />,
}));

const mockedSignUpRequest = signUpRequest as jest.MockedFunction<typeof signUpRequest>;

describe("SignUpForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders sign-up fields", () => {
    renderWithProviders(<SignUpForm />);

    expect(screen.getByRole("heading", { name: /signup/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/fullname/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mobile/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/please enter your password/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/please confirm your password/i)).toBeInTheDocument();
  });

  it("submits valid sign-up and redirects to login", async () => {
    const user = userEvent.setup();
    mockedSignUpRequest.mockResolvedValue(undefined);

    renderWithProviders(<SignUpForm />);

    await user.type(screen.getByLabelText(/fullname/i), validSignUpPayload.fullName);
    await user.type(screen.getByLabelText(/email address/i), validSignUpPayload.email);
    await user.type(screen.getByLabelText(/mobile/i), validSignUpPayload.mobile);
    await user.type(
      screen.getByPlaceholderText(/please enter your password/i),
      validSignUpPayload.password
    );
    await user.type(
      screen.getByPlaceholderText(/please confirm your password/i),
      validSignUpPayload.confirmPassword
    );
    await user.click(screen.getByRole("button", { name: /^signup$/i }));

    await waitFor(() => {
      expect(mockedSignUpRequest).toHaveBeenCalledWith(validSignUpPayload);
    });

    expect(await screen.findByText(/account has been created/i)).toBeInTheDocument();
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("shows API error message on failed sign-up", async () => {
    const user = userEvent.setup();
    mockedSignUpRequest.mockRejectedValue(new Error("Email already exists"));

    renderWithProviders(<SignUpForm />);

    await user.type(screen.getByLabelText(/fullname/i), validSignUpPayload.fullName);
    await user.type(screen.getByLabelText(/email address/i), validSignUpPayload.email);
    await user.type(screen.getByLabelText(/mobile/i), validSignUpPayload.mobile);
    await user.type(
      screen.getByPlaceholderText(/please enter your password/i),
      validSignUpPayload.password
    );
    await user.type(
      screen.getByPlaceholderText(/please confirm your password/i),
      validSignUpPayload.confirmPassword
    );
    await user.click(screen.getByRole("button", { name: /^signup$/i }));

    expect(await screen.findByText(/email already exists/i)).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
