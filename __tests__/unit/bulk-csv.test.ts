import {
  assertImageBelongsToProduct,
  isImageMappedToProduct,
  matchProductImagesFromFolder,
  parseBulkProductsCsv,
  resolveBulkVariants,
} from "@/lib/bulk-csv";
import {
  assignFallbackStockToVariants,
  ensureVariantsFromImageNames,
  normalizeSize,
  selectSizeValue,
} from "@/lib/product-options";

describe("parseBulkProductsCsv — variant aggregation", () => {
  it("keeps per-variant qty and sizes (never dumps total onto first row)", () => {
    const csv = `title,price,category,color,size,qty,image
Classic Denim Jacket,49.99,jacket,Brown,S,10,brown.jpg
Classic Denim Jacket,49.99,jacket,Red,M,5,red.jpg
`;

    const products = parseBulkProductsCsv(csv);
    expect(products).toHaveLength(1);

    const jacket = products[0];
    expect(jacket.id).toMatch(/^csv-/);
    expect(jacket.variants).toEqual([
      { color: "Brown", size: "S", qty: 10 },
      { color: "Red", size: "M", qty: 5 },
    ]);
    expect(jacket.stock).toBe(15);
    expect(jacket.imageFileNames).toEqual(["brown.jpg", "red.jpg"]);
  });

  it("does not invent zero-qty variants or redistribute stock", () => {
    const csv = `title,price,category,color,size,qty,image
Classic jeans,49.99,Jeans,Black,L,20,jeans-black.jpg
`;

    const [jeans] = parseBulkProductsCsv(csv);
    expect(jeans.variants).toEqual([{ color: "Black", size: "L", qty: 20 }]);
    expect(jeans.stock).toBe(20);
  });

  it("normalizes size aliases so Select can pre-fill", () => {
    const csv = `title,price,category,color,size,qty,image
Cap,19.99,Accessories,Black,small,40,cap.jpg
`;
    const [cap] = parseBulkProductsCsv(csv);
    expect(cap.variants[0].size).toBe("S");
    expect(selectSizeValue(cap.variants[0].size, ["XS", "S", "M", "L"])).toBe("S");
    expect(normalizeSize("One Size")).toBe("One Size");
  });

  it("forward-fills blank Excel titles and keeps Blue/M/15 Black/L/16 Brown/XL/43", () => {
    const csv = `title,price,category,color,size,qty,image
Classic Denim Jacket,49.99,jacket,Blue,M,15,jacket_blue.jpeg
,,jacket,Black,L,16,jacket_red.jpeg
,,jacket,Brown,XL,43,jacket_brown.jpeg
Phone,49.99,Phones,Black,One Size,43,phone_black.jpeg
`;
    const products = parseBulkProductsCsv(csv);
    expect(products).toHaveLength(2);

    const jacket = products[0];
    expect(jacket.variants).toEqual([
      { color: "Blue", size: "M", qty: 15 },
      { color: "Black", size: "L", qty: 16 },
      { color: "Brown", size: "XL", qty: 43 },
    ]);
    expect(jacket.stock).toBe(74);

    const drafts = resolveBulkVariants(jacket, [
      "jacket_brown.jpeg",
      "jacket_red.jpeg",
      "jacket_blue.jpeg",
    ]);
    expect(drafts).toEqual([
      { color: "Blue", size: "M", qty: 15 },
      { color: "Black", size: "L", qty: 16 },
      { color: "Brown", size: "XL", qty: 43 },
    ]);

    const phone = products[1];
    expect(phone.variants).toEqual([{ color: "Black", size: "One Size", qty: 43 }]);
    expect(phone.categoryName).toBe("Phones");
  });
});

describe("auto variants from CSV + image filenames", () => {
  it("adds missing image colors without wiping CSV qtys", () => {
    const variants = ensureVariantsFromImageNames(
      [
        { color: "Brown", size: "S", qty: 10 },
        { color: "Red", size: "M", qty: 5 },
      ],
      ["brown.jpg", "red.jpg", "blue-jacket.jpg"]
    );

    expect(variants).toEqual([
      { color: "Brown", size: "S", qty: 10 },
      { color: "Red", size: "M", qty: 5 },
      { color: "Blue", size: "", qty: 0 },
    ]);
  });

  it("assigns product stock to a single image-derived variant", () => {
    let variants = ensureVariantsFromImageNames([], ["phone-black.jpg"]);
    variants = assignFallbackStockToVariants(variants, 43);
    expect(variants).toEqual([{ color: "Black", size: "", qty: 43 }]);
  });

  it("does not even-split stock across image-derived variants", () => {
    let variants = ensureVariantsFromImageNames([], ["brown.jpg", "red.jpg"]);
    variants = assignFallbackStockToVariants(variants, 11);
    expect(variants).toEqual([
      { color: "Brown", size: "", qty: 0 },
      { color: "Red", size: "", qty: 0 },
    ]);
  });
});

describe("matchProductImagesFromFolder — per-product image isolation", () => {
  function fakeFile(name: string): File {
    return new File([""], name, { type: "image/jpeg" });
  }

  it("assigns CSV-listed images and never leaks leftovers to the wrong product", () => {
    const products = parseBulkProductsCsv(`title,price,category,color,size,qty,image
Classic Denim Jacket,49.99,jacket,Brown,M,40,brown.jpg
Classic Denim Jacket,49.99,jacket,Red,L,34,red.jpg
Classic jeans,49.99,Jeans,Black,L,20,jeans-black.jpg
`);

    const folder = [
      fakeFile("brown.jpg"),
      fakeFile("red.jpg"),
      fakeFile("jeans-black.jpg"),
      fakeFile("unrelated-stock.jpg"),
    ];

    const result = matchProductImagesFromFolder(products, folder);
    const jacket = products[0];
    const jeans = products[1];

    const jacketFiles = (result.byProductId.get(jacket.id) ?? []).map((f) => f.name);
    const jeansFiles = (result.byProductId.get(jeans.id) ?? []).map((f) => f.name);

    expect(jacketFiles.sort()).toEqual(["brown.jpg", "red.jpg"]);
    expect(jeansFiles).toEqual(["jeans-black.jpg"]);
    expect(jeansFiles).not.toContain("unrelated-stock.jpg");
    expect(result.unmatchedFolderFiles).toContain("unrelated-stock.jpg");
    expect(result.assignedCount).toBe(3);
  });

  it("matches by title/color when CSV image column is empty", () => {
    const products = parseBulkProductsCsv(`title,price,category,color,size,qty
Classic Denim Jacket,49.99,jacket,Brown,M,40
Classic Denim Jacket,49.99,jacket,Red,L,34
Classic jeans,49.99,Jeans,Black,L,20
`);

    expect(products.every((p) => p.imageFileNames.length === 0)).toBe(true);

    const folder = [
      fakeFile("classic-denim-jacket-brown.jpg"),
      fakeFile("classic-denim-jacket-red.jpg"),
      fakeFile("classic-jeans-black.jpg"),
      fakeFile("random-photo.jpg"),
    ];

    const result = matchProductImagesFromFolder(products, folder);
    const jacket = products[0];
    const jeans = products[1];

    const jacketFiles = (result.byProductId.get(jacket.id) ?? []).map((f) => f.name);
    const jeansFiles = (result.byProductId.get(jeans.id) ?? []).map((f) => f.name);

    expect(jacketFiles.sort()).toEqual([
      "classic-denim-jacket-brown.jpg",
      "classic-denim-jacket-red.jpg",
    ]);
    expect(jeansFiles).toEqual(["classic-jeans-black.jpg"]);
    expect(result.unmatchedFolderFiles).toContain("random-photo.jpg");
    expect(result.assignedCount).toBe(3);
  });

  it("guards against attaching an image to the wrong product", () => {
    const [jeans] = parseBulkProductsCsv(`title,price,category,color,size,qty,image
Classic jeans,49.99,Jeans,Black,L,20,jeans-black.jpg
`);

    expect(isImageMappedToProduct(jeans, "jeans-black.jpg")).toBe(true);
    expect(isImageMappedToProduct(jeans, "blue-jacket.jpg")).toBe(false);
    expect(() => assertImageBelongsToProduct(jeans, "blue-jacket.jpg")).toThrow(
      /Refusing to attach image/
    );
  });
});
