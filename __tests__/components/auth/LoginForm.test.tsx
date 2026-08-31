/** @jest-environment jsdom */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mockPush, mockSearchParams } from "@/__tests__/mocks/next-navigation";
import { renderWithProviders } from "@/__tests__/mocks/render";
import { LoginForm } from "@/components/features/auth/LoginForm";
import { useAuthStore } from "@/lib/store/useAuthStore";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
  useSearchParams: () => mockSearchParams(),
}));

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
  getSession: jest.fn(),
}));

jest.mock("../../../components/features/auth/SocialAuthButtons", () => ({
  SocialAuthButtons: () => <div data-testid="social-auth-buttons" />,
}));

import { getSession, signIn } from "next-auth/react";

const mockedSignIn = signIn as jest.MockedFunction<typeof signIn>;
const mockedGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe("LoginForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  it("renders login fields and submit button", () => {
    renderWithProviders(<LoginForm />);

    expect(screen.getByRole("heading", { name: /login/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/enter email address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/please enter your password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^login$/i })).toBeInTheDocument();
    expect(screen.getByTestId("social-auth-buttons")).toBeInTheDocument();
  });

  it("shows validation errors for empty submit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.click(screen.getByRole("button", { name: /^login$/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    expect(mockedSignIn).not.toHaveBeenCalled();
  });

  it("logs in successfully and updates auth store", async () => {
    const user = userEvent.setup();
    mockedSignIn.mockResolvedValue({
      ok: true,
      error: undefined,
      code: undefined,
      status: 200,
      url: null,
    });
    mockedGetSession.mockResolvedValue({
      user: {
        id: "user-1",
        email: "john@example.com",
        name: "John Smith",
        role: "USER",
      },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    });

    renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText(/enter email address/i), "john@example.com");
    await user.type(screen.getByPlaceholderText(/please enter your password/i), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    await waitFor(() => {
      expect(mockedSignIn).toHaveBeenCalledWith("credentials", {
        email: "john@example.com",
        password: "SecurePass1!",
        rememberMe: "false",
        redirect: false,
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    expect(useAuthStore.getState().user?.email).toBe("john@example.com");
    expect(await screen.findByText(/logged in successfully/i)).toBeInTheDocument();
  });

  it("shows error toast when credentials are invalid", async () => {
    const user = userEvent.setup();
    mockedSignIn.mockResolvedValue({
      ok: false,
      error: "CredentialsSignin",
      code: "credentials",
      status: 401,
      url: null,
    });

    renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText(/enter email address/i), "john@example.com");
    await user.type(screen.getByPlaceholderText(/please enter your password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    expect(await screen.findByText(/wrong username\/password/i)).toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
