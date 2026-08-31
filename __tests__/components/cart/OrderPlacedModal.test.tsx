/** @jest-environment jsdom */

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/__tests__/mocks/render";
import { OrderPlacedModal } from "@/components/features/cart/OrderPlacedModal";

describe("OrderPlacedModal", () => {
  it("renders success content when open", () => {
    renderWithProviders(<OrderPlacedModal open onDetails={jest.fn()} onHome={jest.fn()} />);

    expect(screen.getByText(/your order has been successfully placed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /check order details/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /return to home/i })).toBeInTheDocument();
  });

  it("calls action handlers from buttons", async () => {
    const user = userEvent.setup();
    const onDetails = jest.fn();
    const onHome = jest.fn();

    renderWithProviders(<OrderPlacedModal open onDetails={onDetails} onHome={onHome} />);

    await user.click(screen.getByRole("button", { name: /check order details/i }));
    await user.click(screen.getByRole("button", { name: /return to home/i }));

    expect(onDetails).toHaveBeenCalledTimes(1);
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});
