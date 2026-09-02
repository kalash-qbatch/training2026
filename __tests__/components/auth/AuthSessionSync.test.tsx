/** @jest-environment jsdom */

import { render } from "@testing-library/react";

import { mockUser } from "@/__tests__/mocks/data/users";
import { AuthSessionSync } from "@/components/features/auth/AuthSessionSync";
import { useAuthStore } from "@/lib/store/useAuthStore";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

import { useSession } from "next-auth/react";

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;

describe("AuthSessionSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  it("does nothing while session is loading", () => {
    mockedUseSession.mockReturnValue({
      data: null,
      status: "loading",
      update: jest.fn(),
    });

    render(<AuthSessionSync />);

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("logs out when session is unauthenticated", () => {
    useAuthStore.setState({
      user: { id: mockUser.id, email: mockUser.email, fullName: mockUser.fullName, role: "USER" },
      isAuthenticated: true,
    });
    mockedUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: jest.fn(),
    });

    render(<AuthSessionSync />);

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("syncs authenticated session into auth store", () => {
    mockedUseSession.mockReturnValue({
      data: {
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.fullName,
          role: "USER",
        },
        expires: new Date(Date.now() + 3600_000).toISOString(),
      },
      status: "authenticated",
      update: jest.fn(),
    });

    render(<AuthSessionSync />);

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.email).toBe(mockUser.email);
  });

  it("keeps existing auth store state when the same user is already logged in", () => {
    const existingUser = {
      id: mockUser.id,
      email: mockUser.email,
      fullName: mockUser.fullName,
      role: "USER" as const,
    };
    useAuthStore.setState({ user: existingUser, isAuthenticated: true });
    mockedUseSession.mockReturnValue({
      data: {
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.fullName,
          role: "USER",
        },
        expires: new Date(Date.now() + 3600_000).toISOString(),
      },
      status: "authenticated",
      update: jest.fn(),
    });

    render(<AuthSessionSync />);

    expect(useAuthStore.getState().user).toEqual(existingUser);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
