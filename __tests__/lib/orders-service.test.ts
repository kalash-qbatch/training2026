import { createOrder, findAdminOrders, updateOrderStatus } from "@/lib/services/orders";

const mockClaimCart = jest.fn();
const mockCheckoutProduct = jest.fn();
const mockCount = jest.fn();
const mockFindMany = jest.fn();
const mockAggregate = jest.fn();
const mockUnitsAggregate = jest.fn();

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockNotifyOrderStatusChange = jest.fn();

jest.mock("../../lib/db", () => ({
  prisma: {
    order: {
      count: (...args: unknown[]) => mockCount(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      aggregate: (...args: unknown[]) => mockAggregate(...args),
    },
    orderItem: { aggregate: (...args: unknown[]) => mockUnitsAggregate(...args) },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        cartItem: { deleteMany: mockClaimCart },
        product: { findUnique: mockCheckoutProduct },
        order: {
          findUnique: mockFindUnique,
          update: mockUpdate,
        },
      }),
  },
}));

jest.mock("../../lib/services/notifications", () => ({
  notifyOrderPlaced: jest.fn(),
  notifyOrderStatusChange: (...args: unknown[]) => mockNotifyOrderStatusChange(...args),
}));

jest.mock("../../lib/mappers", () => ({
  mapOrder: (row: { id: string; status: string; paymentStatus: string }) => ({
    id: row.id,
    status: row.status.toLowerCase(),
    paymentStatus: row.paymentStatus,
  }),
}));

describe("orders service — updateOrderStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotifyOrderStatusChange.mockResolvedValue(undefined);
  });

  it("marks payment as SUCCEEDED when order is delivered", async () => {
    mockFindUnique.mockResolvedValue({
      id: "order-001",
      userId: "user-001",
      status: "SHIPPED",
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      items: [],
    });
    mockUpdate.mockResolvedValue({
      id: "order-001",
      status: "DELIVERED",
      paymentStatus: "SUCCEEDED",
      user: { fullName: "Jane", name: "Jane", email: "jane@example.com" },
      items: [],
    });

    const result = await updateOrderStatus("order-001", "DELIVERED");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-001" },
        data: expect.objectContaining({
          status: "DELIVERED",
          paymentStatus: "SUCCEEDED",
          nextPaymentRetryAt: null,
        }),
      })
    );
    expect(result.paymentStatus).toBe("SUCCEEDED");
  });

  it("does not overwrite payment status when already succeeded", async () => {
    mockFindUnique.mockResolvedValue({
      id: "order-002",
      userId: "user-001",
      status: "SHIPPED",
      paymentMethod: "CARD",
      paymentStatus: "SUCCEEDED",
      items: [],
    });
    mockUpdate.mockResolvedValue({
      id: "order-002",
      status: "DELIVERED",
      paymentStatus: "SUCCEEDED",
      user: { fullName: "Jane", name: "Jane", email: "jane@example.com" },
      items: [],
    });

    await updateOrderStatus("order-002", "DELIVERED");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "DELIVERED" },
      })
    );
  });
});

describe("admin order search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);
    mockAggregate.mockResolvedValue({ _count: { _all: 0 }, _sum: { total: 0 } });
    mockUnitsAggregate.mockResolvedValue({ _sum: { quantity: 0 } });
  });

  it.each(["a1b2c3d4", "A1B2C3D4-1234", " #order-abc "])(
    "searches by order id contains for %s",
    async (search) => {
      await findAdminOrders({ search });
      const where = mockFindMany.mock.calls[0][0].where;
      const expectedRef = search.trim().replace(/^#/, "");
      expect(where.AND.at(-1)).toEqual({
        id: { contains: expectedRef, mode: "insensitive" },
      });
      expect(JSON.stringify(where)).not.toContain("fullName");
      expect(JSON.stringify(where)).not.toContain("orderNumber");
      expect(mockCount).toHaveBeenCalledWith({ where });
      expect(mockAggregate).toHaveBeenCalledWith(expect.objectContaining({ where }));
      expect(mockUnitsAggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { order: where } })
      );
    }
  );

  it("skips id filter when search is empty", async () => {
    await findAdminOrders({ search: "   " });
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.AND.at(-1)).toEqual({});
  });
});

describe("checkout cart expiration", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects expired or missing cart lines before reserving stock or creating an order", async () => {
    mockClaimCart.mockResolvedValue({ count: 0 });
    await expect(createOrder("user-1", [{ productId: "cap", quantity: 1 }])).rejects.toThrow(
      "Your cart has expired or changed"
    );
    expect(mockCheckoutProduct).not.toHaveBeenCalled();
    expect(mockClaimCart).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        productId: "cap",
        specificationId: null,
        quantity: { gte: 1 },
        createdAt: { gt: expect.any(Date) },
      },
    });
  });

  it("allows live cart lines to continue through checkout", async () => {
    mockClaimCart.mockResolvedValue({ count: 1 });
    mockCheckoutProduct.mockResolvedValue(null);
    await expect(createOrder("user-1", [{ productId: "cap", quantity: 1 }])).rejects.toThrow(
      "Product not found"
    );
    expect(mockCheckoutProduct).toHaveBeenCalled();
  });
});
