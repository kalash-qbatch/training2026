import {
  mockCardOrder,
  mockPaymentIntent,
  mockShippingInfo,
} from "@/__tests__/mocks/data/checkout";
import { mockOrder, validPlaceOrderPayload } from "@/__tests__/mocks/data/orders";
import { mockUser } from "@/__tests__/mocks/data/users";
import { jsonRequest, mockAuthSession, parseJson } from "@/__tests__/mocks/helpers";
import { POST as confirmCheckoutRoute } from "@/app/api/checkout/confirm/route";
import { auth } from "@/auth";
import * as orderService from "@/lib/services/orders";
import { getStripe } from "@/lib/stripe";

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
    confirmExistingOrderPayment: jest.fn(),
    handlePaymentFailure: jest.fn(),
    switchOrderToCod: jest.fn(),
  };
});
jest.mock("../../lib/stripe", () => ({
  getStripe: jest.fn(),
}));

const mockedAuth = auth as jest.MockedFunction<typeof auth>;
const mockedOrders = orderService as jest.Mocked<typeof orderService>;
const mockedGetStripe = getStripe as jest.MockedFunction<typeof getStripe>;

const mockRetrieve = jest.fn();

describe("Checkout — POST /api/checkout/confirm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuth.mockResolvedValue(mockAuthSession(mockUser) as never);
    mockedOrders.createOrder.mockResolvedValue(mockOrder);
    mockedOrders.confirmExistingOrderPayment.mockResolvedValue(mockCardOrder);
    mockedOrders.switchOrderToCod.mockResolvedValue({ ...mockCardOrder, paymentMethod: "COD" });
    mockedGetStripe.mockReturnValue({
      paymentIntents: { retrieve: mockRetrieve },
    } as never);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const response = await confirmCheckoutRoute(
      jsonRequest("http://localhost/api/checkout/confirm", {
        paymentMethod: "COD",
        items: validPlaceOrderPayload.items,
      })
    );
    const body = await parseJson<{ success: boolean; error: string }>(response);

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("places a new COD order", async () => {
    const response = await confirmCheckoutRoute(
      jsonRequest("http://localhost/api/checkout/confirm", {
        paymentMethod: "COD",
        items: validPlaceOrderPayload.items,
        shipping: mockShippingInfo,
      })
    );
    const body = await parseJson<{ success: boolean; order: typeof mockOrder }>(response);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.order.id).toBe(mockOrder.id);
    expect(mockedOrders.createOrder).toHaveBeenCalledWith(
      mockUser.id,
      validPlaceOrderPayload.items,
      expect.objectContaining({ paymentMethod: "COD" })
    );
  });

  it("returns 400 for COD with empty cart", async () => {
    const response = await confirmCheckoutRoute(
      jsonRequest("http://localhost/api/checkout/confirm", {
        paymentMethod: "COD",
        items: [],
      })
    );
    const body = await parseJson<{ success: boolean; error: string }>(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe("Cart is empty");
  });

  it("switches existing order to COD on retry", async () => {
    const response = await confirmCheckoutRoute(
      jsonRequest("http://localhost/api/checkout/confirm", {
        paymentMethod: "COD",
        orderId: mockCardOrder.id,
      })
    );
    const body = await parseJson<{ success: boolean; order: { paymentMethod: string } }>(response);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.order.paymentMethod).toBe("COD");
    expect(mockedOrders.switchOrderToCod).toHaveBeenCalledWith(mockCardOrder.id, mockUser.id);
    expect(mockedOrders.createOrder).not.toHaveBeenCalled();
  });

  it("confirms card payment when PaymentIntent succeeded", async () => {
    mockRetrieve.mockResolvedValue({ ...mockPaymentIntent, status: "succeeded" });

    const response = await confirmCheckoutRoute(
      jsonRequest("http://localhost/api/checkout/confirm", {
        paymentMethod: "CARD",
        paymentIntentId: "pi_test_123",
        orderId: mockCardOrder.id,
      })
    );
    const body = await parseJson<{ success: boolean; order: typeof mockCardOrder }>(response);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockedOrders.confirmExistingOrderPayment).toHaveBeenCalledWith(
      mockCardOrder.id,
      mockUser.id,
      "SUCCEEDED",
      "pi_test_123",
      "pi_test_123_secret"
    );
  });

  it("returns processing flag when PaymentIntent is processing", async () => {
    mockRetrieve.mockResolvedValue({ ...mockPaymentIntent, status: "processing" });

    const response = await confirmCheckoutRoute(
      jsonRequest("http://localhost/api/checkout/confirm", {
        paymentMethod: "CARD",
        paymentIntentId: "pi_test_123",
        orderId: mockCardOrder.id,
      })
    );
    const body = await parseJson<{ success: boolean; processing: boolean }>(response);

    expect(response.status).toBe(200);
    expect(body.processing).toBe(true);
    expect(mockedOrders.confirmExistingOrderPayment).toHaveBeenCalledWith(
      mockCardOrder.id,
      mockUser.id,
      "PROCESSING",
      "pi_test_123",
      "pi_test_123_secret"
    );
  });

  it("returns 402 and handles failure when PaymentIntent did not succeed", async () => {
    mockRetrieve.mockResolvedValue({
      ...mockPaymentIntent,
      status: "requires_payment_method",
      last_payment_error: { decline_code: "insufficient_funds", code: "card_declined" },
    });
    mockedOrders.handlePaymentFailure.mockResolvedValue(undefined);

    const response = await confirmCheckoutRoute(
      jsonRequest("http://localhost/api/checkout/confirm", {
        paymentMethod: "CARD",
        paymentIntentId: "pi_test_123",
        orderId: mockCardOrder.id,
      })
    );
    const body = await parseJson<{
      success: boolean;
      error: string;
      orderId: string;
      errorInfo: { recoverable: boolean };
    }>(response);

    expect(response.status).toBe(402);
    expect(body.success).toBe(false);
    expect(body.orderId).toBe(mockCardOrder.id);
    expect(body.errorInfo.recoverable).toBe(true);
    expect(mockedOrders.handlePaymentFailure).toHaveBeenCalledWith(mockCardOrder.id, "pi_test_123");
  });

  it("returns 400 when card payment is missing paymentIntentId", async () => {
    const response = await confirmCheckoutRoute(
      jsonRequest("http://localhost/api/checkout/confirm", {
        paymentMethod: "CARD",
        orderId: mockCardOrder.id,
      })
    );
    const body = await parseJson<{ success: boolean; error: string }>(response);

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/payment intent id is required/i);
  });

  it("returns 403 when PaymentIntent belongs to another user", async () => {
    mockRetrieve.mockResolvedValue({
      ...mockPaymentIntent,
      metadata: { userId: "other-user-id" },
    });

    const response = await confirmCheckoutRoute(
      jsonRequest("http://localhost/api/checkout/confirm", {
        paymentMethod: "CARD",
        paymentIntentId: "pi_test_123",
        orderId: mockCardOrder.id,
      })
    );
    const body = await parseJson<{ success: boolean; error: string }>(response);

    expect(response.status).toBe(403);
    expect(body.error).toBe("Unauthorized");
  });
});
