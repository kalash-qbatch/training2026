import {
  baseSku,
  extractTitlePrefix,
  formatProductCode,
  generateVariantSku,
  parseSku,
  resolveColorCode,
  resolveSizeCode,
} from "@/lib/sku";

describe("SKU utilities (TITLE-CODE-SIZE-COLOR)", () => {
  it("extracts 4-char title prefix", () => {
    expect(extractTitlePrefix("Shirt")).toBe("SHIR");
    expect(extractTitlePrefix("Denim Jacket")).toBe("DENI");
    expect(extractTitlePrefix("T-Shirt")).toBe("TSHI");
  });

  it("pads short titles with underscore", () => {
    expect(extractTitlePrefix("Cap")).toBe("CAP_");
    expect(extractTitlePrefix("Tee")).toBe("TEE_");
  });

  it("formats product codes", () => {
    expect(formatProductCode(1)).toBe("001");
    expect(formatProductCode(12)).toBe("012");
  });

  it("builds variant SKU", () => {
    expect(generateVariantSku("SHIR", "001", "S", "BLK")).toBe("SHIR-001-S-BLK");
    expect(generateVariantSku("SHIR", "002", "One Size", "WHT")).toBe("SHIR-002-OneSize-WHT");
  });

  it("resolves color codes from list and defaults", () => {
    const list = [{ name: "Black", code: "BLK" }];
    expect(resolveColorCode("Black", list)).toBe("BLK");
    expect(resolveColorCode("BLK", list)).toBe("BLK");
    expect(resolveColorCode("Navy", [])).toBe("NVY");
  });

  it("resolves size from DB list", () => {
    expect(resolveSizeCode("s", [{ name: "S" }])).toBe("S");
    expect(resolveSizeCode("Fixed", [{ name: "Fixed" }])).toBe("Fixed");
  });

  it("parses full and base SKUs", () => {
    expect(parseSku("SHIR-001-S-BLK")).toEqual({
      titlePrefix: "SHIR",
      code: "001",
      size: "S",
      color: "BLK",
    });
    expect(parseSku("SHIR-001")).toEqual({
      titlePrefix: "SHIR",
      code: "001",
      size: "",
      color: "",
    });
    expect(baseSku("SHIR", "001")).toBe("SHIR-001");
  });
});
