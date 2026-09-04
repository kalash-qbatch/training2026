import { ProductListing } from "@/components/features/products/ProductListing";
import { CARD_INITIAL_PAGE, CARD_PAGE_SIZE } from "@/lib/constants";
import { listCategories } from "@/lib/services/categories";
import { findProducts } from "@/lib/services/products";

export default async function ProductsPage() {
  const [productsResult, categories] = await Promise.all([
    findProducts({
      sort: "name-asc",
      page: CARD_INITIAL_PAGE,
      pageSize: CARD_PAGE_SIZE,
    }),
    listCategories().catch(() => []),
  ]);

  return (
    <ProductListing
      initialProducts={productsResult.products}
      initialTotalPages={productsResult.totalPages}
      initialCategories={categories}
      hydrateFromServer
    />
  );
}
