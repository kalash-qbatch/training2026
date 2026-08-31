/** @jest-environment jsdom */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mockCartItem } from "@/__tests__/mocks/data/cart";
import { mockOrder } from "@/__tests__/mocks/data/orders";
import { mockPush } from "@/__tests__/mocks/next-navigation";
import { renderWithProviders } from "@/__tests__/mocks/render";
import { CartPageClient } from "@/components/features/cart/CartPageClient";
import { placeOrder as placeOrderApi } from "@/lib/api/orders";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useCartStore } from "@/lib/store/useCartStore";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
}));

jest.mock("../../../lib/api/orders", () => ({
  placeOrder: jest.fn(),
}));

const mockedPlaceOrder = placeOrderApi as jest.MockedFunction<typeof placeOrderApi>;

describe("CartPageClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: null, isAuthenticated: false });
    useCartStore.setState({
      items: [],
      loaded: true,
      setItems: useCartStore.getState().setItems,
      clearLocal: useCartStore.getState().clearLocal,
      fetchCart: useCartStore.getState().fetchCart,
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

  it("redirects unauthenticated users to login when placing order", async () => {
    const user = userEvent.setup();
    useCartStore.setState({ items: [mockCartItem] });

    renderWithProviders(<CartPageClient />);

    await user.click(screen.getByRole("button", { name: /place order/i }));

    expect(mockPush).toHaveBeenCalledWith("/login?next=/cart");
    expect(mockedPlaceOrder).not.toHaveBeenCalled();
  });

  it("places order for authenticated user and opens success modal", async () => {
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
    useCartStore.setState({ items: [mockCartItem] });
    mockedPlaceOrder.mockResolvedValue(mockOrder);

    renderWithProviders(<CartPageClient />);

    await user.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => {
      expect(mockedPlaceOrder).toHaveBeenCalledWith([
        {
          productId: mockCartItem.productId,
          specificationId: mockCartItem.specificationId,
          quantity: mockCartItem.qty,
        },
      ]);
    });

    expect(await screen.findByText(/your order has been successfully placed/i)).toBeInTheDocument();
    expect(useCartStore.getState().removeItems).toHaveBeenCalled();
  });

  it("shows error toast when order placement fails", async () => {
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
    useCartStore.setState({ items: [mockCartItem] });
    mockedPlaceOrder.mockRejectedValue(new Error("Not enough stock"));

    renderWithProviders(<CartPageClient />);

    await user.click(screen.getByRole("button", { name: /place order/i }));

    expect(await screen.findByText(/not enough stock/i)).toBeInTheDocument();
  });
});
