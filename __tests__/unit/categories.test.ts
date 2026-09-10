import { capitalizeCategoryName, slugifyCategory } from "@/lib/services/categories";

describe("slugifyCategory", () => {
  it("creates a slug from mixed-case category names", () => {
    expect(slugifyCategory("Phone")).toBe("phone");
    expect(slugifyCategory("Mobile Phones & Accessories")).toBe("mobile-phones-accessories");
  });
});

describe("capitalizeCategoryName", () => {
  it("capitalizes only the first character", () => {
    expect(capitalizeCategoryName(" basket ")).toBe("Basket");
    expect(capitalizeCategoryName("Accessories")).toBe("Accessories");
    expect(capitalizeCategoryName("mobile phones")).toBe("Mobile phones");
  });
});
