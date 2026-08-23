import { listCategories } from "@/lib/services/categories";

export async function getCategories() {
  const categories = await listCategories();
  return { status: 200, body: { success: true, categories: categories.map((category) => ({ ...category, name: category.name.toUpperCase() })) } };
}
