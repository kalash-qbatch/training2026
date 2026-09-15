import { prisma } from "@/lib/db";
import {
  baseSku,
  CATALOG_COLORS,
  DEFAULT_COLOR_CODES,
  DEFAULT_SIZE_NAMES,
  extractTitlePrefix,
  formatProductCode,
  generateVariantSku,
  resolveColorCode,
  resolveSizeCode,
} from "@/lib/sku";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function ensureColorAndSizeCatalog(tx: Tx = prisma as unknown as Tx) {
  for (const { name, code } of CATALOG_COLORS) {
    const byName = await tx.color.findUnique({ where: { name } });
    if (byName) {
      if (byName.code !== code) {
        const codeTaken = await tx.color.findUnique({ where: { code } });
        if (!codeTaken || codeTaken.id === byName.id) {
          await tx.color.update({ where: { id: byName.id }, data: { code } });
        }
      }
      continue;
    }
    const byCode = await tx.color.findUnique({ where: { code } });
    if (byCode) continue;
    await tx.color.create({ data: { name, code } });
  }
  for (const name of DEFAULT_SIZE_NAMES) {
    await tx.size.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }
}

export async function loadColorSizeLists(tx: Tx = prisma as unknown as Tx) {
  const [colors, sizes] = await Promise.all([
    tx.color.findMany({ select: { name: true, code: true } }),
    tx.size.findMany({ select: { name: true } }),
  ]);
  return { colors, sizes };
}

/** Peek next code without locking (preview only). */
export async function peekNextProductCode(title: string) {
  const titlePrefix = extractTitlePrefix(title);
  const rows = await prisma.$queryRaw<Array<{ max: number | null }>>`
    SELECT MAX(CAST("code" AS INTEGER)) AS max
    FROM "Product"
    WHERE "titlePrefix" = ${titlePrefix} AND "code" IS NOT NULL
  `;
  const max = Number(rows[0]?.max ?? 0);
  const nextCode = formatProductCode(max + 1);
  return {
    titlePrefix,
    nextCode,
    baseSku: baseSku(titlePrefix, nextCode),
  };
}

/** Allocate next product code under advisory lock (must run inside a transaction). */
export async function allocateProductCode(tx: Tx, title: string) {
  const titlePrefix = extractTitlePrefix(title);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${titlePrefix}))`;

  const rows = await tx.$queryRaw<Array<{ max: number | null }>>`
    SELECT MAX(CAST("code" AS INTEGER)) AS max
    FROM "Product"
    WHERE "titlePrefix" = ${titlePrefix} AND "code" IS NOT NULL
  `;
  const next = Number(rows[0]?.max ?? 0) + 1;
  return { titlePrefix, code: formatProductCode(next) };
}

export async function buildVariantSku(
  titlePrefix: string,
  productCode: string,
  color: string,
  size: string,
  lists?: { colors: Array<{ name: string; code: string }>; sizes: Array<{ name: string }> }
) {
  const catalog = lists ?? (await loadColorSizeLists());
  const colorCode = resolveColorCode(color, catalog.colors);
  const sizeName = resolveSizeCode(size, catalog.sizes);
  return generateVariantSku(titlePrefix, productCode, sizeName, colorCode);
}

export async function ensureColorExists(tx: Tx, colorName: string) {
  const name = colorName.trim();
  if (!name) return null;
  const existing = await tx.color.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return existing;
  const code = resolveColorCode(
    name,
    Object.entries(DEFAULT_COLOR_CODES).map(([n, c]) => ({ name: n, code: c }))
  );
  try {
    return await tx.color.create({ data: { name, code } });
  } catch {
    return tx.color.findFirst({ where: { OR: [{ code }, { name }] } });
  }
}

export async function ensureSizeExists(tx: Tx, sizeName: string) {
  const name = sizeName.trim();
  if (!name) return null;
  const existing = await tx.size.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return existing;
  try {
    return await tx.size.create({ data: { name } });
  } catch {
    return tx.size.findFirst({ where: { name } });
  }
}

export { baseSku, extractTitlePrefix, formatProductCode, generateVariantSku };
