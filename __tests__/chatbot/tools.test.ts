import { addToCart, getCartSummary, removeFromCart } from "@/lib/chatbot/tools/cart-service";
import { getProduct, searchProducts } from "@/lib/chatbot/tools/catalog-service";
import { executeTool } from "@/lib/chatbot/tools/executor";
import { getStorePolicies } from "@/lib/chatbot/tools/policy-service";

describe("Chatbot Tools Suite", () => {
  describe("search_products", () => {
    it("returns real products matching query", async () => {
      const result = await searchProducts({ query: "cotton tee" });
      expect(result.products.length).toBeGreaterThan(0);
      expect(result.products[0].name.toLowerCase()).toContain("cotton");
      expect(result.products[0].price).toBe(28.0);
    });

    it("filters accurately by category and price range", async () => {
      const result = await searchProducts({
        query: "",
        category: "Watches",
        max_price: 160,
      });

      expect(result.products.length).toBeGreaterThan(0);
      result.products.forEach((p) => {
        expect(p.category).toBe("Watches");
        expect(p.price).toBeLessThanOrEqual(160);
      });
    });

    it("returns 0 results and no fabricated items for nonexistent query", async () => {
      const result = await searchProducts({ query: "quantum flux teleporter x9000" });
      expect(result.products).toHaveLength(0);
      expect(result.totalMatches).toBe(0);
    });

    it("disables Add to Cart button on out-of-stock items and suggests in-stock alternatives", async () => {
      const result = await searchProducts({ query: "Velocity Carbon Trail Running Shoes" });
      expect(result.products.length).toBeGreaterThan(0);
      const outOfStockItem = result.products.find((p) => p.id === "prod-017");
      expect(outOfStockItem).toBeDefined();
      expect(outOfStockItem!.in_stock).toBe(false);

      const addAction = outOfStockItem!.actions.find((a) => a.action === "add_to_cart");
      expect(addAction).toBeDefined();
      expect(addAction!.disabled).toBe(true);
      expect(addAction!.label).toBe("Out of Stock");

      // Suggests in-stock alternative in same category
      expect(result.alternativeSuggestions).toBeDefined();
      expect(result.alternativeSuggestions!.length).toBeGreaterThan(0);
      expect(result.alternativeSuggestions![0].in_stock).toBe(true);
    });
  });

  describe("get_product", () => {
    it("returns exact price and stock matching catalog", async () => {
      const product = await getProduct("prod-008");
      expect(product).not.toBeNull();
      expect(product!.name).toBe("Minimalist Sapphire Stainless Watch");
      expect(product!.price).toBe(150.0);
      expect(product!.stock).toBe(15);
      expect(product!.in_stock).toBe(true);
    });

    it("returns null for nonexistent product ID", async () => {
      const product = await getProduct("prod-99999");
      expect(product).toBeNull();
    });
  });

  describe("cart operations", () => {
    const testSession = "test_sess_tools_123";

    it("adds item to cart and updates summary", async () => {
      const res = await addToCart(testSession, "prod-001", 2);
      expect(res.added.productId).toBe("prod-001");
      expect(res.added.quantity).toBe(2);
      expect(res.cart.totalQuantity).toBe(2);
      expect(res.cart.subtotal).toBe(56.0);
    });

    it("rejects adding out-of-stock items", async () => {
      await expect(addToCart(testSession, "prod-017", 1)).rejects.toThrow(/out of stock/i);
    });

    it("rejects quantity exceeding available inventory", async () => {
      // prod-016 has stock 8
      await expect(addToCart(testSession, "prod-016", 50)).rejects.toThrow(/available in stock/i);
    });

    it("removes item from cart", async () => {
      const res = await removeFromCart(testSession, "prod-001");
      expect(res.removed).toBe(true);
      const summary = getCartSummary(testSession);
      expect(summary.totalQuantity).toBe(0);
    });
  });

  describe("store policies", () => {
    it("returns shipping policy with free threshold over $50", () => {
      const res = getStorePolicies({ topic: "shipping" });
      expect(res.topic).toBe("shipping");
      const summary = (res.policy as { summary: string }).summary;
      expect(summary).toContain("50");
      expect(summary).toContain("3–5 business days");
    });

    it("returns 30-day return policy", () => {
      const res = getStorePolicies({ topic: "returns" });
      const summary = (res.policy as { summary: string }).summary;
      expect(summary).toContain("30-day");
    });
  });

  describe("executeTool dispatcher", () => {
    it("safely dispatches search_products", async () => {
      const res = await executeTool("search_products", { query: "beanie" });
      expect(res.tool).toBe("search_products");
      if (res.tool === "search_products") {
        expect(res.data.products.length).toBeGreaterThan(0);
      }
    });

    it("handles invalid tool gracefully", async () => {
      const res = await executeTool("hack_the_store", {});
      expect(res.tool).toBe("error");
    });
  });
});
