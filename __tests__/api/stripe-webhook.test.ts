import { headers } from "next/headers";

import { mockCardOrder } from "@/__tests__/mocks/data/checkout";
import { parseJson } from "@/__tests__/mocks/helpers";
import { POST as stripeWebhookRoute } from "@/app/api/stripe/webhook/route";
import * as orderService from "@/lib/services/orders";
import { getStripe } from "@/lib/stripe";

jest.mock("next/headers", () => ({
  headers: jest.fn(),
}));
jest.mock("../../lib/services/orders", () => ({
  confirmExistingOrderPayment: jest.fn(),
  findOrderByPaymentIntentId: jest.fn(),
  handlePaymentFailure: jest.fn(),
  updateOrderPaymentStatus: jest.fn(),
  updateOrderStatus: jest.fn(),
}));
jest.mock("../../lib/stripe", () => ({
  getStripe: jest.fn(),
}));

const mockedHeaders = headers as jest.MockedFunction<typeof headers>;
const mockedOrders = orderService as jest.Mocked<typeof orderService>;
const mockedGetStripe = getStripe as jest.MockedFunction<typeof getStripe>;

const mockConstructEvent = jest.fn();

function webhookRequest(body = '{"type":"test"}'): Request {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Stripe — POST /api/stripe/webhook", () => {
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    mockedHeaders.mockResolvedValue({
      get: (key: string) => (key === "stripe-signature" ? "sig_test" : null),
    } as never);
    mockedGetStripe.mockReturnValue({
      webhooks: { constructEvent: mockConstructEvent },
    } as never);
    mockedOrders.findOrderByPaymentIntentId.mockResolvedValue(mockCardOrder);
  });

  afterAll(() => {
    process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
  });

  it("returns 400 when stripe signature is missing", async () => {
    mockedHeaders.mockResolvedValue({ get: () => null } as never);

    const response = await stripeWebhookRoute(webhookRequest());
    const body = await parseJson<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe("Webhook signature missing");
  });

  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const response = await stripeWebhookRoute(webhookRequest());
    const body = await parseJson<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid webhook signature");
  });

  it("confirms order on payment_intent.succeeded", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_test_123",
          client_secret: "pi_test_123_secret",
        },
      },
    });

    const response = await stripeWebhookRoute(webhookRequest());
    const body = await parseJson<{ received: boolean }>(response);

    expect(response.status).toBe(200);
    expect(body.received).toBe(true);
    expect(mockedOrders.confirmExistingOrderPayment).toHaveBeenCalledWith(
      mockCardOrder.id,
      mockCardOrder.userId,
      "SUCCEEDED",
      "pi_test_123",
      "pi_test_123_secret"
    );
  });

  it("handles payment_intent.payment_failed", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.payment_failed",
      data: { object: { id: "pi_test_123" } },
    });
    mockedOrders.handlePaymentFailure.mockResolvedValue(undefined);

    const response = await stripeWebhookRoute(webhookRequest());

    expect(response.status).toBe(200);
    expect(mockedOrders.handlePaymentFailure).toHaveBeenCalledWith(mockCardOrder.id, "pi_test_123");
  });

  it("updates order to processing on payment_intent.processing", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.processing",
      data: { object: { id: "pi_test_123" } },
    });
    mockedOrders.updateOrderPaymentStatus.mockResolvedValue(undefined);

    await stripeWebhookRoute(webhookRequest());

    expect(mockedOrders.updateOrderPaymentStatus).toHaveBeenCalledWith(
      mockCardOrder.id,
      "PROCESSING"
    );
  });

  it("cancels order on payment_intent.canceled", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.canceled",
      data: { object: { id: "pi_test_123" } },
    });
    mockedOrders.updateOrderStatus.mockResolvedValue(undefined);

    await stripeWebhookRoute(webhookRequest());

    expect(mockedOrders.updateOrderStatus).toHaveBeenCalledWith(mockCardOrder.id, "CANCELLED");
  });

  it("ignores unknown event types and returns received", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.created",
      data: { object: {} },
    });

    const response = await stripeWebhookRoute(webhookRequest());
    const body = await parseJson<{ received: boolean }>(response);

    expect(response.status).toBe(200);
    expect(body.received).toBe(true);
    expect(mockedOrders.confirmExistingOrderPayment).not.toHaveBeenCalled();
  });
});
