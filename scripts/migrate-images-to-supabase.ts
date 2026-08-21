/**
 * Uploads local public/products images to Supabase Storage
 * and updates Product.image URLs in Postgres.
 *
 * Usage: npx tsx scripts/migrate-images-to-supabase.ts
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { readdir, readFile } from "fs/promises";
import path from "path";

import { uploadProductImage } from "../lib/supabase";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

async function main() {
  const dir = path.join(process.cwd(), "public", "products");
  const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f));

  console.log(`Found ${files.length} local product images`);

  const uploaded = new Map<string, string>();

  for (const file of files) {
    const bytes = await readFile(path.join(dir, file));
    const ext = path.extname(file).toLowerCase();
    const url = await uploadProductImage({
      bytes,
      filename: file,
      contentType: MIME[ext] || "image/jpeg",
    });
    uploaded.set(`/products/${file}`, url);
    console.log(`  ✓ ${file} → ${url}`);
  }

  const products = await prisma.product.findMany();
  let updated = 0;

  for (const product of products) {
    const nextUrl = uploaded.get(product.image);
    if (!nextUrl) continue;
    await prisma.product.update({
      where: { id: product.id },
      data: { image: nextUrl },
    });
    updated += 1;
    console.log(`  DB: ${product.title.slice(0, 40)}…`);
  }

  console.log(`\nDone. Uploaded ${uploaded.size} files, updated ${updated} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
