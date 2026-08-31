import { mockOrder } from "@/__tests__/mocks/data/orders";
import { getOrderById, getOrders, placeOrder } from "@/lib/api/orders";

function mockFetchResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

describe("lib/api/orders — getOrders", () => {
  it("returns paginated orders on success", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockFetchResponse(200, {
        success: true,
        orders: [mockOrder],
        total: 1,
        page: 1,
        pageSize: 5,
      })
    );

    const result = await getOrders(1, 5);

    expect(result.orders).toEqual([mockOrder]);
    expect(result.total).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/orders?page=1&pageSize=5"),
      { cache: "no-store" }
    );
  });

  it("throws when orders request fails", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockFetchResponse(401, { success: false, error: "Unauthorized" }));

    await expect(getOrders()).rejects.toThrow("Unauthorized");
  });
});

describe("lib/api/orders — getOrderById", () => {
  it("returns null for 404", async () => {
    global.fetch = jest.fn().mockResolvedValue(mockFetchResponse(404, { success: false }));

    await expect(getOrderById("missing")).resolves.toBeNull();
  });

  it("returns order when found", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockFetchResponse(200, { success: true, order: mockOrder }));

    await expect(getOrderById(mockOrder.id)).resolves.toEqual(mockOrder);
  });
});

describe("lib/api/orders — placeOrder", () => {
  const payload = [
    {
      productId: "prod-001",
      specificationId: "spec-001",
      quantity: 2,
      color: "black",
      size: "M",
    },
  ];

  it("posts items and returns created order", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(mockFetchResponse(200, { success: true, order: mockOrder }));
    global.fetch = fetchMock;

    const result = await placeOrder(payload);

    expect(result).toEqual(mockOrder);
    expect(fetchMock).toHaveBeenCalledWith("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payload }),
    });
  });

  it("throws when placement fails", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockFetchResponse(409, { success: false, error: "Not enough stock" }));

    await expect(placeOrder(payload)).rejects.toThrow("Not enough stock");
  });
});
