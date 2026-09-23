import "dotenv/config";

import { createEmbeddingsBatch, EMBEDDING_MODEL_NAME } from "../lib/ai/embeddings";
import { prisma } from "../lib/db";

const BATCH_SIZE = 20;

export function buildProductSearchText(product: {
  id: string;
  title: string;
  price: unknown;
  color?: string | null;
  size?: string | null;
  stock: number;
  isActive: boolean;
  category?: { name: string } | null;
  specifications?: { color: string; size: string; qty: number; sku?: string | null }[];
}): string {
  const specColors = Array.from(
    new Set(product.specifications?.map((s) => s.color).filter(Boolean) || [])
  );
  const specSizes = Array.from(
    new Set(product.specifications?.map((s) => s.size).filter(Boolean) || [])
  );
  const skus = product.specifications?.map((s) => s.sku).filter(Boolean) || [];

  const lines: string[] = [
    `Product Title: ${product.title}`,
    product.category?.name ? `Category: ${product.category.name}` : null,
    `Price: $${Number(product.price).toFixed(2)}`,
    product.color ? `Default Color: ${product.color}` : null,
    specColors.length > 0 ? `Available Colors: ${specColors.join(", ")}` : null,
    product.size ? `Default Size: ${product.size}` : null,
    specSizes.length > 0 ? `Available Sizes: ${specSizes.join(", ")}` : null,
    product.stock > 0
      ? `Stock Status: In Stock (${product.stock} units)`
      : "Stock Status: Out of Stock",
    skus.length > 0 ? `SKUs: ${skus.join(", ")}` : null,
    `Status: ${product.isActive ? "Active" : "Archived"}`,
  ].filter(Boolean) as string[];

  return lines.join("\n");
}

async function main() {
  const force = process.argv.includes("--force");
  console.log(`Starting product embeddings backfill... [force=${force}, batchSize=${BATCH_SIZE}]`);

  // Find products to embed
  // If force, all products; otherwise only products with null embedding!
  let targetProductIds: string[] = [];

  if (force) {
    const all = await prisma.product.findMany({
      select: { id: true },
    });
    targetProductIds = all.map((p) => p.id);
  } else {
    const rows = await (
      prisma as unknown as { $queryRawUnsafe: (query: string) => Promise<{ id: string }[]> }
    ).$queryRawUnsafe(
      `SELECT id FROM "Product" WHERE "embedding" IS NULL ORDER BY "createdAt" DESC;`
    );
    targetProductIds = rows.map((r) => r.id);
  }

  console.log(`Found ${targetProductIds.length} product(s) to process.`);
  if (targetProductIds.length === 0) {
    console.log(
      "All products already have embeddings! Nothing to do. (Use --force to re-embed all)"
    );
    process.exit(0);
  }

  let processedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < targetProductIds.length; i += BATCH_SIZE) {
    const batchIds = targetProductIds.slice(i, i + BATCH_SIZE);
    const products = await prisma.product.findMany({
      where: { id: { in: batchIds } },
      include: {
        category: true,
        specifications: true,
      },
    });

    const texts = products.map((p) => buildProductSearchText(p));

    console.log(
      `Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(targetProductIds.length / BATCH_SIZE)} (${products.length} products)...`
    );

    try {
      const embeddings = await createEmbeddingsBatch(texts);

      for (let j = 0; j < products.length; j++) {
        const prod = products[j];
        const emb = embeddings[j];
        const vecStr = `[${emb.join(",")}]`;

        await (
          prisma as unknown as {
            $executeRawUnsafe: (query: string, ...params: unknown[]) => Promise<unknown>;
          }
        ).$executeRawUnsafe(
          `UPDATE "Product" SET "embedding" = $1::vector WHERE "id" = $2`,
          vecStr,
          prod.id
        );
        processedCount++;
      }

      console.log(`Successfully embedded and saved batch of ${products.length} products.`);
    } catch (err) {
      console.error(`Error processing batch:`, err);
      failedCount += products.length;
    }

    // Brief pause between batches to be gentle on rate limits
    if (i + BATCH_SIZE < targetProductIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  console.log("\n================ Backfill Summary ================");
  console.log(`Model: ${EMBEDDING_MODEL_NAME}`);
  console.log(`Successfully embedded: ${processedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log("=================================================");

  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal backfill error:", err);
  process.exit(1);
});
