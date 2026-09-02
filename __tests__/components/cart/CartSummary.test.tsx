/** @jest-environment jsdom */

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/__tests__/mocks/render";
import { CartSummary } from "@/components/features/cart/CartSummary";

describe("CartSummary", () => {
  it("renders subtotal, tax, and total", () => {
    renderWithProviders(
      <CartSummary subtotal={59.98} tax={6} total={65.98} onPlaceOrder={jest.fn()} />
    );

    expect(screen.getByText("Sub Total")).toBeInTheDocument();
    expect(screen.getByText("Tax")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /proceed to checkout/i })).toBeInTheDocument();
  });

  it("disables checkout button when disabled", () => {
    renderWithProviders(
      <CartSummary subtotal={59.98} tax={6} total={65.98} disabled onPlaceOrder={jest.fn()} />
    );

    expect(screen.getByRole("button", { name: /proceed to checkout/i })).toBeDisabled();
  });

  it("calls onPlaceOrder when checkout button is clicked", async () => {
    const user = userEvent.setup();
    const onPlaceOrder = jest.fn();

    renderWithProviders(
      <CartSummary subtotal={59.98} tax={6} total={65.98} onPlaceOrder={onPlaceOrder} />
    );

    await user.click(screen.getByRole("button", { name: /proceed to checkout/i }));

    expect(onPlaceOrder).toHaveBeenCalledTimes(1);
  });
});
