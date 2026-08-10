import { prisma } from "@/lib/db";

export type CategoryDto = {
  id: string;
  name: string;
  slug: string;
};

export function slugifyCategory(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function listCategories(): Promise<CategoryDto[]> {
  const rows = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
  return rows;
}

export async function createCategory(name: string): Promise<CategoryDto> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Category name is required");
  }

  const slug = slugifyCategory(trimmed);
  if (!slug) {
    throw new Error("Category name is invalid");
  }

  const existing = await prisma.category.findFirst({
    where: {
      OR: [
        { name: { equals: trimmed, mode: "insensitive" } },
        { slug },
      ],
    },
    select: { id: true, name: true, slug: true },
  });
  if (existing) return existing;

  return prisma.category.create({
    data: { name: trimmed, slug },
    select: { id: true, name: true, slug: true },
  });
}

/** Resolve categoryId, or find/create from name. */
export async function resolveCategoryId(opts: {
  categoryId?: string | null;
  categoryName?: string | null;
}): Promise<string | null | undefined> {
  if (opts.categoryId) {
    const found = await prisma.category.findUnique({
      where: { id: opts.categoryId },
      select: { id: true },
    });
    if (!found) throw new Error("Category not found");
    return found.id;
  }
  if (opts.categoryName?.trim()) {
    const cat = await createCategory(opts.categoryName);
    return cat.id;
  }
  // undefined = leave unchanged on update; null = clear
  if (opts.categoryId === null) return null;
  return undefined;
}
