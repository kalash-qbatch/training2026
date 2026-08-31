/** @jest-environment jsdom */

import { screen } from "@testing-library/react";

import { renderWithProviders } from "@/__tests__/mocks/render";
import CartPage from "@/app/(main)/cart/page";

jest.mock("../../../components/features/cart/CartPageClient", () => ({
  CartPageClient: () => <div data-testid="cart-page-client">Cart Page Client</div>,
}));

describe("Cart page", () => {
  it("renders cart page client", () => {
    renderWithProviders(<CartPage />);

    expect(screen.getByTestId("cart-page-client")).toBeInTheDocument();
  });
});
