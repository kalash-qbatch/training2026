import ExcelJS from "exceljs";

import { prisma } from "@/lib/db";
import { PRODUCT_COLOR_OPTIONS, PRODUCT_SIZE_OPTIONS } from "@/lib/product-options";
import { listCategories } from "@/lib/services/categories";

const COLOR_HEX: Record<string, string> = {
  Beige: "#FCE5C0",
  Black: "#18181B",
  Blue: "#0b00d9",
  Brown: "#8B5A2B",
  Cyan: "#00fbff",
  "Gray/Silver": "#ADADAD",
  Gray: "#9CA3AF",
  Green: "#31a835",
  Navy: "#1E3A8A",
  Olive: "#3F6212",
  Orange: "#ff8400",
  Pink: "#fb00ff",
  Purple: "#7C3AED",
  Red: "#DC2626",
  Silver: "#C0C0C0",
  White: "#FFFFFF",
  Yellow: "#ffc800",
  Gold: "#D4AF37",
  Bronze: "#CD7F32",
  Copper: "#B87333",
  Brass: "#B5A642",
  Steel: "#71797E",
  Iron: "#434B4D",
};

const PRODUCT_HEADERS = [
  "title",
  "price",
  "categoryName",
  "colorName",
  "sizeName",
  "stock",
  "imagePath",
] as const;

const DATA_ROWS = 1000;

type TemplateRow = {
  title: string;
  price: number;
  categoryName: string;
  colorName: string;
  sizeName: string;
  stock: number;
  imagePath: string;
};

async function existingProductNames(): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { title: "asc" },
    take: 40,
    select: { title: true },
  });
  return products.map((p) => p.title);
}

/** Example rows only — never reuse live titles (avoids duplicate upload errors). */
async function sampleProductRows(): Promise<TemplateRow[]> {
  const categories = await listCategories();
  const cat = (i: number) => categories[i % Math.max(categories.length, 1)]?.name || "General";

  return [
    {
      title: "Classic Denim Jacket",
      price: 49.99,
      categoryName: cat(0),
      colorName: "Blue",
      sizeName: "M",
      stock: 15,
      imagePath: "jacket_blue.jpeg",
    },
    {
      title: "Classic Denim Jacket",
      price: 49.99,
      categoryName: cat(0),
      colorName: "Black",
      sizeName: "L",
      stock: 16,
      imagePath: "jacket_black.jpeg",
    },
    {
      title: "Wireless Headphones",
      price: 129.99,
      categoryName: cat(1),
      colorName: "Black",
      sizeName: "One Size",
      stock: 22,
      imagePath: "headphones_black.jpeg",
    },
    {
      title: "Wireless Headphones",
      price: 129.99,
      categoryName: cat(1),
      colorName: "White",
      sizeName: "One Size",
      stock: 18,
      imagePath: "headphones_white.jpeg",
    },
  ];
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" },
  };
  row.alignment = { vertical: "middle" };
  row.height = 20;
}

function addListValidation(
  sheet: ExcelJS.Worksheet,
  range: string,
  formula: string,
  prompt: string
) {
  // ExcelJS runtime supports worksheet.dataValidations; typings omit it.
  const validations = (
    sheet as ExcelJS.Worksheet & {
      dataValidations: {
        add: (address: string, validation: ExcelJS.DataValidation) => void;
      };
    }
  ).dataValidations;

  validations.add(range, {
    type: "list",
    allowBlank: true,
    showInputMessage: true,
    showErrorMessage: true,
    prompt,
    formulae: [formula],
  });
}

/** Build a bulk-upload XLSX template with dropdowns for category/color/size. */
export async function buildBulkProductsTemplateBuffer(): Promise<Buffer> {
  const [categories, sampleRows, existingNames] = await Promise.all([
    listCategories(),
    sampleProductRows(),
    existingProductNames(),
  ]);

  const categoryNames = categories.map((c) => c.name);
  const colorNames = [...PRODUCT_COLOR_OPTIONS];
  const sizeNames = [...PRODUCT_SIZE_OPTIONS];

  const wb = new ExcelJS.Workbook();
  wb.creator = "Bhai ka Store";
  wb.created = new Date();

  const products = wb.addWorksheet("Products", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  products.columns = [
    { header: PRODUCT_HEADERS[0], key: "title", width: 28 },
    { header: PRODUCT_HEADERS[1], key: "price", width: 10 },
    { header: PRODUCT_HEADERS[2], key: "categoryName", width: 18 },
    { header: PRODUCT_HEADERS[3], key: "colorName", width: 14 },
    { header: PRODUCT_HEADERS[4], key: "sizeName", width: 12 },
    { header: PRODUCT_HEADERS[5], key: "stock", width: 10 },
    { header: PRODUCT_HEADERS[6], key: "imagePath", width: 28 },
  ];
  styleHeaderRow(products.getRow(1));

  for (const row of sampleRows) {
    products.addRow({
      title: row.title,
      price: row.price,
      categoryName: row.categoryName,
      colorName: row.colorName,
      sizeName: row.sizeName,
      stock: row.stock,
      imagePath: row.imagePath,
    });
  }

  const categoriesSheet = wb.addWorksheet("Categories");
  categoriesSheet.getColumn(1).width = 24;
  categoriesSheet.getCell("A1").value = "categoryName";
  styleHeaderRow(categoriesSheet.getRow(1));
  categoryNames.forEach((name, i) => {
    categoriesSheet.getCell(i + 2, 1).value = name;
  });

  const colorsSheet = wb.addWorksheet("Color Reference");
  colorsSheet.getColumn(1).width = 16;
  colorsSheet.getColumn(2).width = 12;
  colorsSheet.getCell("A1").value = "Color Name";
  colorsSheet.getCell("B1").value = "Hex Code";
  styleHeaderRow(colorsSheet.getRow(1));
  colorNames.forEach((name, i) => {
    colorsSheet.getCell(i + 2, 1).value = name;
    colorsSheet.getCell(i + 2, 2).value = COLOR_HEX[name] || "";
  });

  const sizesSheet = wb.addWorksheet("Size Reference");
  sizesSheet.getColumn(1).width = 14;
  sizesSheet.getCell("A1").value = "Size Name";
  styleHeaderRow(sizesSheet.getRow(1));
  sizeNames.forEach((name, i) => {
    sizesSheet.getCell(i + 2, 1).value = name;
  });

  const namesSheet = wb.addWorksheet("Existing Names");
  namesSheet.getColumn(1).width = 36;
  namesSheet.getCell("A1").value = "existingProductName";
  styleHeaderRow(namesSheet.getRow(1));
  if (existingNames.length) {
    existingNames.forEach((title, i) => {
      namesSheet.getCell(i + 2, 1).value = title;
    });
  } else {
    namesSheet.getCell(2, 1).value = "(no products in store yet)";
  }

  const instructions = wb.addWorksheet("Instructions");
  instructions.getColumn(1).width = 90;
  instructions.getCell("A1").value = "Instructions";
  styleHeaderRow(instructions.getRow(1));
  const tips = [
    "1. Fill the Products sheet — one row per color/size variant.",
    "2. categoryName, colorName, and sizeName have dropdowns — pick from the list.",
    "3. Dropdown values come from Categories / Color Reference / Size Reference sheets.",
    "4. stock = quantity for that color+size row (not total product stock).",
    "5. imagePath = image file name in your upload folder (e.g. jacket_blue.jpeg).",
    "6. Same title + price on multiple rows = one product with multiple variants.",
    "7. Replace sample rows with your new products — avoid titles in Existing Names.",
    "8. Save as .xlsx and upload in Admin → Upload Multiple Products.",
  ];
  tips.forEach((tip, i) => {
    instructions.getCell(i + 2, 1).value = tip;
  });

  // Sheet-range formulae (works with long lists / values that contain commas).
  const catEnd = Math.max(categoryNames.length, 1) + 1;
  const colorEnd = colorNames.length + 1;
  const sizeEnd = sizeNames.length + 1;

  addListValidation(
    products,
    `C2:C${DATA_ROWS}`,
    `Categories!$A$2:$A$${catEnd}`,
    "Select a category from the list"
  );
  addListValidation(
    products,
    `D2:D${DATA_ROWS}`,
    `'Color Reference'!$A$2:$A$${colorEnd}`,
    "Select a color from the list"
  );
  addListValidation(
    products,
    `E2:E${DATA_ROWS}`,
    `'Size Reference'!$A$2:$A$${sizeEnd}`,
    "Select a size from the list"
  );

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
