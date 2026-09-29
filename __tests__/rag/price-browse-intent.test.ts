import {
  hasSpecificSearchIntent,
  isGlobalPriceBrowse,
  parseProductSearchIntent,
} from "@/lib/services/rag";

describe("parseProductSearchIntent — store catalog questions", () => {
  it("treats lowest-price store questions as price browse (even with typos)", () => {
    const intent = parseProductSearchIntent("show me tghe lowest price product in this store");
    expect(intent.sortBy).toBe("price_asc");
    expect(intent.catalogBrowse).toBe(true);
    expect(intent.productTerms).toEqual([]);
    expect(hasSpecificSearchIntent(intent)).toBe(true);
    expect(isGlobalPriceBrowse(intent)).toBe(true);
  });

  it("handles which product has the lowest price", () => {
    const intent = parseProductSearchIntent("which product have the lowest price in this store");
    expect(intent.sortBy).toBe("price_asc");
    expect(isGlobalPriceBrowse(intent)).toBe(true);
  });

  it("keeps category when asking cheapest watch", () => {
    const intent = parseProductSearchIntent("cheapest watch");
    expect(intent.sortBy).toBe("price_asc");
    expect(intent.productTerms).toContain("watch");
    expect(isGlobalPriceBrowse(intent)).toBe(false);
  });

  it("detects most expensive browse", () => {
    const intent = parseProductSearchIntent("what is the most expensive product");
    expect(intent.sortBy).toBe("price_desc");
    expect(isGlobalPriceBrowse(intent)).toBe(true);
  });

  it("maps high range / high-end to expensive browse", () => {
    for (const q of [
      "i want to know the high range of products",
      "show high-end products",
      "premium products please",
      "luxury items in the store",
    ]) {
      const intent = parseProductSearchIntent(q);
      expect(intent.sortBy).toBe("price_desc");
      expect(isGlobalPriceBrowse(intent)).toBe(true);
    }
  });

  it("maps low range / low-end to cheap browse", () => {
    for (const q of ["low range products", "low-end items", "budget products"]) {
      const intent = parseProductSearchIntent(q);
      expect(intent.sortBy).toBe("price_asc");
      expect(isGlobalPriceBrowse(intent)).toBe(true);
    }
  });

  it("still ignores vague greetings", () => {
    const intent = parseProductSearchIntent("hi");
    expect(hasSpecificSearchIntent(intent)).toBe(false);
  });
});
