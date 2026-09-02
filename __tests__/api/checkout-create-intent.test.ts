import {
  mockCardOrder,
  mockShippingInfo,
  mockStripeIntentResponse,
} from "@/__tests__/mocks/data/checkout";
import { mockOrder, validPlaceOrderPayload } from "@/__tests__/mocks/data/orders";
import { mockUser } from "@/__tests__/mocks/data/users";
import { jsonRequest, mockAuthSession, parseJson } from "@/__tests__/mocks/helpers";
import { POST as createIntentRoute } from "@/app/api/checkout/create-intent/route";
import { auth } from "@/auth";
import * as orderService from "@/lib/services/orders";
import * as stripeService from "@/lib/services/stripe";

jest.mock("../../auth", () => ({
  auth: jest.fn(),
  handlers: { GET: jest.fn(), POST: jest.fn() },
  signIn: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock("../../lib/services/orders", () => {
  const actual = jest.requireActual("../../lib/services/orders") as Record<string, unknown>;
  return {
    ...actual,
    createOrder: jest.fn(),
    findOrderById: jest.fn(),
    attachPaymentIntentToOrder: jest.fn(),
    updateOrderStatus: jest.fn(),
  };
});
jest.mock("../../lib/services/stripe", () => ({
  createPaymentIntentForCart: jest.fn(),
  createPaymentIntentForOrder: jest.fn(),
}));

const mockedAuth = auth as jest.MockedFunction<typeof auth>;
const mockedOrders = orderService as jest.Mocked<typeof orderService>;
const mockedStripe = stripeService as jest.Mocked<typeof stripeService>;

describe("Checkout — POST /api/checkout/create-intent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuth.mockResolvedValue(mockAuthSession(mockUser) as never);
    mockedOrders.createOrder.mockResolvedValue(mockOrder);
    mockedOrders.attachPaymentIntentToOrder.mockResolvedValue(mockCardOrder);
    mockedStripe.createPaymentIntentForCart.mockResolvedValue(mockStripeIntentResponse);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const response = await createIntentRoute(
      jsonRequest("http://localhost/api/checkout/create-intent", {
        items: validPlaceOrderPayload.items,
      })
    );
    const body = await parseJson<{ success: boolean; error: string }>(response);

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(mockedOrders.createOrder).not.toHaveBeenCalled();
  });

  it("returns 400 when cart is empty for new order", async () => {
    const response = await createIntentRoute(
      jsonRequest("http://localhost/api/checkout/create-intent", { items: [] })
    );
    const body = await parseJson<{ success: boolean; error: string }>(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe("Cart is empty");
  });

  it("creates order and payment intent for new card checkout", async () => {
    const response = await createIntentRoute(
      jsonRequest("http://localhost/api/checkout/create-intent", {
        items: validPlaceOrderPayload.items,
        shipping: mockShippingInfo,
      })
    );
    const body = await parseJson<{
      success: boolean;
      clientSecret: string;
      paymentIntentId: string;
      orderId: string;
      amount: number;
    }>(response);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.clientSecret).toBe("pi_test_123_secret");
    expect(body.orderId).toBe(mockOrder.id);
    expect(mockedOrders.createOrder).toHaveBeenCalledWith(
      mockUser.id,
      validPlaceOrderPayload.items,
      expect.objectContaining({ paymentMethod: "CARD", paymentStatus: "PENDING" })
    );
    expect(mockedStripe.createPaymentIntentForCart).toHaveBeenCalled();
    expect(mockedOrders.attachPaymentIntentToOrder).toHaveBeenCalledWith(
      mockOrder.id,
      mockUser.id,
      "pi_test_123",
      "pi_test_123_secret"
    );
  });

  it("creates payment intent for existing unpaid order (retry flow)", async () => {
    mockedOrders.findOrderById.mockResolvedValue(mockCardOrder);
    mockedStripe.createPaymentIntentForOrder.mockResolvedValue(mockStripeIntentResponse);

    const response = await createIntentRoute(
      jsonRequest("http://localhost/api/checkout/create-intent", {
        orderId: mockCardOrder.id,
        paymentMethodId: "pm_test_123",
      })
    );
    const body = await parseJson<{ success: boolean; retry: boolean; orderId: string }>(response);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.retry).toBe(true);
    expect(body.orderId).toBe(mockCardOrder.id);
    expect(mockedOrders.createOrder).not.toHaveBeenCalled();
    expect(mockedStripe.createPaymentIntentForOrder).toHaveBeenCalledWith(
      mockUser.id,
      mockCardOrder.id,
      expect.any(Number),
      "pm_test_123",
      undefined
    );
  });

  it("returns 404 when retry order is not found", async () => {
    mockedOrders.findOrderById.mockResolvedValue(null);

    const response = await createIntentRoute(
      jsonRequest("http://localhost/api/checkout/create-intent", {
        orderId: "missing-order",
      })
    );
    const body = await parseJson<{ success: boolean; error: string }>(response);

    expect(response.status).toBe(404);
    expect(body.error).toBe("Order not found");
  });

  it("returns 400 when retry order is already paid", async () => {
    mockedOrders.findOrderById.mockResolvedValue({
      ...mockCardOrder,
      paymentStatus: "SUCCEEDED",
    });

    const response = await createIntentRoute(
      jsonRequest("http://localhost/api/checkout/create-intent", {
        orderId: mockCardOrder.id,
      })
    );
    const body = await parseJson<{ success: boolean; error: string }>(response);

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/already been paid/i);
  });

  it("returns 400 when retry order is cancelled", async () => {
    mockedOrders.findOrderById.mockResolvedValue({
      ...mockCardOrder,
      status: "cancelled",
    });

    const response = await createIntentRoute(
      jsonRequest("http://localhost/api/checkout/create-intent", {
        orderId: mockCardOrder.id,
      })
    );
    const body = await parseJson<{ success: boolean; error: string }>(response);

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/cancelled/i);
  });

  it("maps OrderError to HTTP status and cancels pending order on failure", async () => {
    mockedOrders.createOrder.mockResolvedValue(mockOrder);
    mockedStripe.createPaymentIntentForCart.mockRejectedValue(
      new orderService.OrderError("Not enough stock", 409)
    );

    const response = await createIntentRoute(
      jsonRequest("http://localhost/api/checkout/create-intent", {
        items: validPlaceOrderPayload.items,
      })
    );
    const body = await parseJson<{ success: boolean; error: string }>(response);

    expect(response.status).toBe(409);
    expect(body.error).toBe("Not enough stock");
    expect(mockedOrders.updateOrderStatus).toHaveBeenCalledWith(mockOrder.id, "CANCELLED");
  });
});
