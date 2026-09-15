/**
 * Idempotent SKU backfill.
 *
 * Usage:
 *   npx tsx scripts/backfill-skus.ts --dry-run
 *   npx tsx scripts/backfill-skus.ts
 */
import "dotenv/config";

import { prisma } from "../lib/db";
import {
  CATALOG_COLORS,
  DEFAULT_SIZE_NAMES,
  extractTitlePrefix,
  formatProductCode,
  generateVariantSku,
  resolveColorCode,
  resolveSizeCode,
} from "../lib/sku";

const dryRun = process.argv.includes("--dry-run");

async function seedCatalog() {
  for (const { name, code } of CATALOG_COLORS) {
    if (dryRun) {
      console.log(`Color seed: ${name} → ${code}`);
      continue;
    }
    const byName = await prisma.color.findUnique({ where: { name } });
    if (byName) {
      if (byName.code !== code) {
        const codeTaken = await prisma.color.findUnique({ where: { code } });
        if (!codeTaken || codeTaken.id === byName.id) {
          await prisma.color.update({ where: { id: byName.id }, data: { code } });
        }
      }
      continue;
    }
    const byCode = await prisma.color.findUnique({ where: { code } });
    if (byCode) continue;
    await prisma.color.create({ data: { name, code } });
  }
  for (const name of DEFAULT_SIZE_NAMES) {
    if (dryRun) {
      console.log(`Size seed: ${name}`);
      continue;
    }
    await prisma.size.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }
}

async function main() {
  console.log(dryRun ? "DRY RUN — no writes" : "APPLYING backfill…");

  await seedCatalog();

  const colors = dryRun
    ? CATALOG_COLORS.map(({ name, code }) => ({ name, code }))
    : await prisma.color.findMany({ select: { name: true, code: true } });
  const sizes = dryRun
    ? DEFAULT_SIZE_NAMES.map((name) => ({ name }))
    : await prisma.size.findMany({ select: { name: true } });

  const products = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
    include: { specifications: true },
  });

  const counters = new Map<string, number>();

  for (const product of products) {
    const titlePrefix = product.titlePrefix || extractTitlePrefix(product.title);
    const next = (counters.get(titlePrefix) ?? 0) + 1;
    counters.set(titlePrefix, next);
    const code = product.code || formatProductCode(next);

    console.log(`Product ${product.id}: "${product.title}" → ${titlePrefix}-${code}`);

    if (!dryRun) {
      await prisma.product.update({
        where: { id: product.id },
        data: { titlePrefix, code },
      });
    }

    for (const spec of product.specifications) {
      const colorCode = resolveColorCode(spec.color, colors);
      const sizeName = resolveSizeCode(spec.size, sizes);
      const sku = generateVariantSku(titlePrefix, code, sizeName, colorCode);
      console.log(`  Spec ${spec.id}: ${spec.color}/${spec.size} → ${sku}`);
      if (!dryRun) {
        await prisma.specification.update({
          where: { id: spec.id },
          data: { sku },
        });
      }
    }
  }

  // Backfill OrderItem.sku from matching specification
  const orderItems = await prisma.orderItem.findMany({
    where: { OR: [{ sku: null }, { sku: "" }] },
    include: {
      product: { select: { titlePrefix: true, code: true } },
    },
  });

  for (const item of orderItems) {
    let sku: string | null = null;
    if (item.specificationId) {
      const spec = await prisma.specification.findUnique({
        where: { id: item.specificationId },
        select: { sku: true },
      });
      sku = spec?.sku ?? null;
    }
    if (!sku && item.color && item.size && item.productId) {
      const spec = await prisma.specification.findFirst({
        where: {
          productId: item.productId,
          color: { equals: item.color, mode: "insensitive" },
          size: { equals: item.size, mode: "insensitive" },
        },
        select: { sku: true },
      });
      sku = spec?.sku ?? null;
    }
    if (!sku && item.product.titlePrefix && item.product.code) {
      const colorCode = resolveColorCode(item.color || "", colors);
      const sizeName = resolveSizeCode(item.size || "", sizes);
      if (item.color || item.size) {
        sku = generateVariantSku(item.product.titlePrefix, item.product.code, sizeName, colorCode);
      } else {
        sku = `${item.product.titlePrefix}-${item.product.code}`;
      }
    }

    if (sku) {
      console.log(`OrderItem ${item.id} → ${sku}`);
      if (!dryRun) {
        await prisma.orderItem.update({
          where: { id: item.id },
          data: { sku },
        });
      }
    }
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
