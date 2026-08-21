import { CARD_INITIAL_PAGE, CARD_PAGE_SIZE } from "@/lib/constants";
import { findProductById, findProducts } from "@/lib/services/products";
import type { ProductSort } from "@/types";

export async function listProducts(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;
  const sort = (searchParams.get("sort") as ProductSort | null) ?? "name-asc";
  const page = Number(searchParams.get("page") || CARD_INITIAL_PAGE);
  const pageSize = Number(
    searchParams.get("pageSize") || searchParams.get("limit") || CARD_PAGE_SIZE
  );
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const categorySlug = searchParams.get("category") ?? undefined;

  const result = await findProducts({
    search,
    sort,
    page,
    pageSize,
    categoryId,
    categorySlug,
  });

  return { status: 200, body: { success: true, ...result } };
}

export async function getProduct(id: string) {
  const product = await findProductById(id);
  if (!product) {
    return {
      status: 404,
      body: { success: false, error: "Product not found" },
    };
  }
  return { status: 200, body: { success: true, product } };
}
