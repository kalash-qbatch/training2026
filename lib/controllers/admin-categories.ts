import { requireAdminUser } from "@/lib/controllers/http";
import { createCategory, listCategories } from "@/lib/services/categories";
import { adminCategorySchema } from "@/lib/validations/admin";

export async function listAdminCategories() {
  const { error } = await requireAdminUser();
  if (error) return error;

  const categories = await listCategories();
  return { status: 200, body: { success: true, categories } };
}

export async function createAdminCategory(body: unknown) {
  const { error } = await requireAdminUser();
  if (error) return error;

  const parsed = adminCategorySchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid category",
      },
    };
  }

  const category = await createCategory(parsed.data.name);
  return {
    status: 200,
    body: {
      success: true,
      category,
      message: "Category saved",
    },
  };
}
