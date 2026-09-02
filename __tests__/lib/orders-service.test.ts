import { updateOrderStatus } from "@/lib/services/orders";

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockNotifyOrderStatusChange = jest.fn();

jest.mock("../../lib/db", () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
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
  mapOrder: (row: { id: string; orderNumber: number; status: string; paymentStatus: string }) => ({
    id: row.id,
    orderNumber: row.orderNumber,
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
      orderNumber: 4353452,
      userId: "user-001",
      status: "SHIPPED",
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      items: [],
    });
    mockUpdate.mockResolvedValue({
      id: "order-001",
      orderNumber: 4353452,
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
