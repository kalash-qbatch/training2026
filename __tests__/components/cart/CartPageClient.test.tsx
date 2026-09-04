/** @jest-environment jsdom */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mockCartItem } from "@/__tests__/mocks/data/cart";
import { mockPush } from "@/__tests__/mocks/next-navigation";
import { renderWithProviders } from "@/__tests__/mocks/render";
import { CartPageClient } from "@/components/features/cart/CartPageClient";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useCartStore } from "@/lib/store/useCartStore";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
}));

describe("CartPageClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: null, isAuthenticated: false });
    useCartStore.setState({
      items: [],
      loaded: true,
      setItems: useCartStore.getState().setItems,
      clearLocal: useCartStore.getState().clearLocal,
      fetchCart: jest.fn().mockResolvedValue(undefined),
      getCartQty: useCartStore.getState().getCartQty,
      addItem: useCartStore.getState().addItem,
      updateQty: jest.fn().mockResolvedValue(undefined),
      removeItem: jest.fn().mockResolvedValue(undefined),
      removeItems: jest.fn().mockResolvedValue(undefined),
      clearCart: jest.fn().mockResolvedValue(undefined),
    });
  });

  it("shows empty state when cart has no items", () => {
    renderWithProviders(<CartPageClient />);

    expect(screen.getByText(/your bag is empty/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse products/i })).toHaveAttribute(
      "href",
      "/products"
    );
  });

  it("redirects unauthenticated users to login when proceeding to checkout", async () => {
    const user = userEvent.setup();
    useCartStore.setState({ items: [mockCartItem] });

    renderWithProviders(<CartPageClient />);

    await user.click(screen.getByRole("button", { name: /proceed to checkout/i }));

    expect(mockPush).toHaveBeenCalledWith("/login?next=/checkout");
  });

  it("redirects authenticated users to checkout", async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: "user-1",
        fullName: "Jane Doe",
        email: "jane@example.com",
        role: "USER",
      },
    });
    useCartStore.setState({
      items: [mockCartItem],
      fetchCart: jest.fn().mockImplementation(async () => {
        useCartStore.setState({ items: [mockCartItem] });
      }),
    });

    renderWithProviders(<CartPageClient />);

    await user.click(screen.getByRole("button", { name: /proceed to checkout/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/checkout");
    });
  });
});
