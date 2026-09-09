import { cartExpiryCutoff } from "@/lib/cart-expiration";
import { expireCartItems, getCart, updateCartItem } from "@/lib/services/cart";

const mockDeleteMany = jest.fn();
const mockFindMany = jest.fn();
const mockUpdateMany = jest.fn();
const mockProduct = jest.fn();

jest.mock("../../lib/db", () => ({
  prisma: {
    cartItem: {
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
    product: { findUnique: (...args: unknown[]) => mockProduct(...args) },
  },
}));

describe("backend cart expiration", () => {
  const now = new Date("2026-09-08T12:15:00Z");
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    jest.clearAllMocks();
    mockDeleteMany.mockResolvedValue({ count: 1 });
    mockFindMany.mockResolvedValue([]);
  });
  afterEach(() => jest.useRealTimers());

  it("expires items at the inclusive 15-minute boundary across all users", async () => {
    await expireCartItems();
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lte: new Date("2026-09-08T12:00:00Z") } },
    });
    expect(cartExpiryCutoff(now.getTime()).getTime()).toBe(now.getTime() - 15 * 60_000);
  });

  it("cleans and filters only the authenticated user's cart on reads", async () => {
    await getCart("user-1");
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", createdAt: { lte: cartExpiryCutoff() } },
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", createdAt: { gt: cartExpiryCutoff() } },
      })
    );
  });

  it("returns the original deadline to clients", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "line-1",
        productId: "cap",
        quantity: 1,
        specificationId: null,
        createdAt: new Date("2026-09-08T12:00:30Z"),
        specification: null,
        product: { id: "cap", title: "Cap", image: "/cap.jpg", price: 23, stock: 2, images: [] },
      },
    ]);
    expect((await getCart("user-1"))[0].expiresAt).toBe("2026-09-08T12:15:30.000Z");
  });

  it("cannot revive expired items with a quantity update", async () => {
    mockProduct.mockResolvedValue({ title: "Cap", stock: 5, isActive: true, specifications: [] });
    mockUpdateMany.mockResolvedValue({ count: 0 });
    await expect(updateCartItem("user-1", { productId: "cap", quantity: 2 })).rejects.toThrow(
      "Cart item not found"
    );
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          productId: "cap",
          specificationId: null,
          createdAt: { gt: cartExpiryCutoff() },
        },
        data: { quantity: 2 },
      })
    );
  });
});
