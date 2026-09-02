import {
  mockOrder,
  mockPaginatedOrders,
  validPlaceOrderPayload,
} from "@/__tests__/mocks/data/orders";
import { mockAdmin, mockUser } from "@/__tests__/mocks/data/users";
import { apiBody, getRequest, jsonRequest, parseJson } from "@/__tests__/mocks/helpers";
import { GET as getOrderRoute } from "@/app/api/orders/[id]/route";
import { GET as listOrdersRoute, POST as placeOrderRoute } from "@/app/api/orders/route";
import { requireUser } from "@/lib/controllers/http";
import { getOrder, listOrders, placeOrder } from "@/lib/controllers/orders";
import * as orderService from "@/lib/services/orders";

jest.mock("../../lib/controllers/http", () => ({
  requireUser: jest.fn(),
  requireAdminUser: jest.fn(),
}));
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
    findOrders: jest.fn(),
    createOrder: jest.fn(),
    findOrderById: jest.fn(),
  };
});

const mockedRequireUser = requireUser as jest.MockedFunction<typeof requireUser>;
const mockedOrders = orderService as jest.Mocked<typeof orderService>;

function mockAuthenticatedUser(userId: string) {
  mockedRequireUser.mockResolvedValue({ userId, error: null });
}

function mockUnauthenticated() {
  mockedRequireUser.mockResolvedValue({
    userId: null,
    error: { status: 401, body: { success: false, error: "Unauthorized" } },
  });
}

describe("Orders — list controller with pagination", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedUser(mockUser.id);
    mockedOrders.findOrders.mockResolvedValue(mockPaginatedOrders);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockUnauthenticated();

    const result = await listOrders(getRequest("http://localhost/api/orders"));

    expect(result.status).toBe(401);
    expect(apiBody<{ error: string }>(result.body).error).toBe("Unauthorized");
    expect(mockedOrders.findOrders).not.toHaveBeenCalled();
  });

  it("returns paginated orders for authenticated user", async () => {
    const result = await listOrders(getRequest("http://localhost/api/orders?page=1&pageSize=5"));

    expect(result.status).toBe(200);
    expect(apiBody<{ orders: unknown[] }>(result.body).orders).toHaveLength(1);
    expect(mockedOrders.findOrders).toHaveBeenCalledWith(1, 5, mockUser.id);
  });
});

describe("Orders — place order controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedUser(mockUser.id);
  });

  it("returns 401 when placing order without auth", async () => {
    mockUnauthenticated();

    const result = await placeOrder(validPlaceOrderPayload);

    expect(result.status).toBe(401);
    expect(mockedOrders.createOrder).not.toHaveBeenCalled();
  });

  it("returns 400 when cart is empty", async () => {
    const result = await placeOrder({ items: [] });

    expect(result.status).toBe(400);
    expect(apiBody<{ error: string }>(result.body).error).toBe("Cart is empty");
  });

  it("places order successfully with mock data", async () => {
    mockedOrders.createOrder.mockResolvedValue(mockOrder);

    const result = await placeOrder(validPlaceOrderPayload);

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(apiBody<{ order: typeof mockOrder }>(result.body).order).toEqual(mockOrder);
    expect(mockedOrders.createOrder).toHaveBeenCalledWith(
      mockUser.id,
      validPlaceOrderPayload.items,
      expect.objectContaining({ paymentMethod: "CARD", paymentStatus: "PENDING" })
    );
  });

  it("maps OrderError to HTTP status", async () => {
    mockedOrders.createOrder.mockRejectedValue(
      new orderService.OrderError("Not enough stock", 409)
    );

    const result = await placeOrder(validPlaceOrderPayload);

    expect(result.status).toBe(409);
    expect(apiBody<{ error: string }>(result.body).error).toBe("Not enough stock");
  });
});

describe("Orders — API routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedUser(mockUser.id);
    mockedOrders.findOrders.mockResolvedValue(mockPaginatedOrders);
    mockedOrders.createOrder.mockResolvedValue(mockOrder);
  });

  it("GET /api/orders returns user orders", async () => {
    const response = await listOrdersRoute(getRequest("http://localhost/api/orders?page=1"));
    const body = await parseJson<{ success: boolean; orders: unknown[] }>(response);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.orders).toHaveLength(1);
  });

  it("POST /api/orders places an order", async () => {
    const response = await placeOrderRoute(
      jsonRequest("http://localhost/api/orders", validPlaceOrderPayload)
    );
    const body = await parseJson<{ success: boolean; message: string }>(response);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe("Order placed successfully");
  });

  it("POST /api/orders returns 500 on unexpected error", async () => {
    mockedOrders.createOrder.mockRejectedValue(new Error("DB down"));

    const response = await placeOrderRoute(
      jsonRequest("http://localhost/api/orders", validPlaceOrderPayload)
    );
    const body = await parseJson<{ success: boolean; error: string }>(response);

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe("DB down");
  });

  it("POST /api/orders returns 400 for empty items array", async () => {
    const response = await placeOrderRoute(
      jsonRequest("http://localhost/api/orders", { items: [] })
    );
    const body = await parseJson<{ success: boolean; error: string }>(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe("Cart is empty");
  });

  it("POST /api/orders returns 401 without session", async () => {
    mockUnauthenticated();

    const response = await placeOrderRoute(
      jsonRequest("http://localhost/api/orders", validPlaceOrderPayload)
    );
    const body = await parseJson<{ success: boolean; error: string }>(response);

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });
});

describe("Orders — get order controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedUser(mockUser.id);
  });

  it("returns 404 when order is not found", async () => {
    mockedOrders.findOrderById.mockResolvedValue(null);

    const result = await getOrder("missing-order");

    expect(result.status).toBe(404);
    expect(apiBody<{ error: string }>(result.body).error).toBe("Order not found");
  });

  it("returns order for authenticated user", async () => {
    mockedOrders.findOrderById.mockResolvedValue(mockOrder);

    const result = await getOrder(mockOrder.id);

    expect(result.status).toBe(200);
    expect(apiBody<{ order: typeof mockOrder }>(result.body).order).toEqual(mockOrder);
    expect(mockedOrders.findOrderById).toHaveBeenCalledWith(mockOrder.id, mockUser.id);
  });
});

describe("Orders — GET /api/orders/[id] route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedUser(mockUser.id);
    mockedOrders.findOrderById.mockResolvedValue(mockOrder);
  });

  it("returns order detail", async () => {
    const response = await getOrderRoute(getRequest("http://localhost/api/orders/order-001"), {
      params: Promise.resolve({ id: "order-001" }),
    });
    const body = await parseJson<{ success: boolean; order: typeof mockOrder }>(response);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.order.id).toBe(mockOrder.id);
  });
});

describe("Orders — admin cannot bypass user scoping via listOrders", () => {
  it("still scopes orders to the authenticated user id", async () => {
    mockAuthenticatedUser(mockAdmin.id);
    mockedOrders.findOrders.mockResolvedValue({ ...mockPaginatedOrders, orders: [] });

    await listOrders(getRequest("http://localhost/api/orders"));

    expect(mockedOrders.findOrders).toHaveBeenCalledWith(1, 5, mockAdmin.id);
  });
});
