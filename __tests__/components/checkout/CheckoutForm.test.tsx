/** @jest-environment jsdom */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mockCartItem } from "@/__tests__/mocks/data/cart";
import { mockShippingInfo } from "@/__tests__/mocks/data/checkout";
import { mockOrder } from "@/__tests__/mocks/data/orders";
import { renderWithProviders } from "@/__tests__/mocks/render";
import { CheckoutForm } from "@/components/features/checkout/CheckoutForm";
import { useCartStore } from "@/lib/store/useCartStore";

const mockConfirmCardPayment = jest.fn();
const mockGetElement = jest.fn();

jest.mock("@stripe/react-stripe-js", () => ({
  CardElement: () => <div data-testid="card-element" />,
  useStripe: () => ({
    confirmCardPayment: mockConfirmCardPayment,
  }),
  useElements: () => ({
    getElement: mockGetElement,
  }),
}));

describe("CheckoutForm", () => {
  const onSuccess = jest.fn();
  const onError = jest.fn();
  const onBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useCartStore.setState({
      items: [mockCartItem],
      removeItems: jest.fn().mockResolvedValue(undefined),
    } as never);
  });

  function renderForm(overrides: Partial<React.ComponentProps<typeof CheckoutForm>> = {}) {
    return renderWithProviders(
      <CheckoutForm
        selectedItems={[mockCartItem]}
        subtotal={59.98}
        tax={4.8}
        total={64.78}
        savedPMs={[]}
        userInfo={mockShippingInfo}
        onSuccess={onSuccess}
        onError={onError}
        onBack={onBack}
        {...overrides}
      />
    );
  }

  it("renders COD and card payment options", () => {
    renderForm();

    expect(screen.getByRole("heading", { name: /payment details/i })).toBeInTheDocument();
    expect(screen.getByText("Cash on Delivery")).toBeInTheDocument();
    expect(screen.getByText(/credit \/ debit card/i)).toBeInTheDocument();
    expect(screen.getByText(mockShippingInfo.fullName)).toBeInTheDocument();
  });

  it("places COD order and clears cart on success", async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, order: mockOrder }),
    } as Response);

    renderForm();

    await user.click(screen.getByRole("button", { name: /place order \(cash on delivery\)/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: "COD",
          items: [
            {
              productId: mockCartItem.productId,
              specificationId: mockCartItem.specificationId,
              quantity: mockCartItem.qty,
            },
          ],
          orderId: undefined,
          shipping: mockShippingInfo,
        }),
      });
      expect(onSuccess).toHaveBeenCalledWith(mockOrder.id, "COD");
    });
  });

  it("completes card payment flow with new card", async () => {
    const user = userEvent.setup();
    mockGetElement.mockReturnValue({});
    mockConfirmCardPayment.mockResolvedValue({ error: null });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          clientSecret: "pi_secret",
          paymentIntentId: "pi_123",
          orderId: mockOrder.id,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, order: mockOrder }),
      } as Response);

    renderForm();

    await user.click(screen.getByLabelText(/credit \/ debit card/i));
    await user.click(screen.getByRole("button", { name: /pay \$64\.78 securely/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/checkout/create-intent", expect.any(Object));
      expect(mockConfirmCardPayment).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith(mockOrder.id, "CARD");
    });
  });

  it("calls onError when card confirmation fails on client", async () => {
    const user = userEvent.setup();
    mockGetElement.mockReturnValue({});
    mockConfirmCardPayment.mockResolvedValue({
      error: { message: "Your card was declined." },
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          clientSecret: "pi_secret",
          paymentIntentId: "pi_123",
          orderId: mockOrder.id,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false }),
      } as Response);

    renderForm();

    await user.click(screen.getByLabelText(/credit \/ debit card/i));
    await user.click(screen.getByRole("button", { name: /pay \$64\.78 securely/i }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Payment Failed",
          orderId: mockOrder.id,
          recoverable: true,
        })
      );
    });
  });

  it("uses retry order id for COD switch flow", async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, order: { ...mockOrder, paymentMethod: "COD" } }),
    } as Response);

    renderForm({ retryOrderId: mockOrder.id });

    await user.click(screen.getByRole("button", { name: /switch to cash on delivery/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: "COD",
          items: undefined,
          orderId: mockOrder.id,
          shipping: undefined,
        }),
      });
    });
  });
});
