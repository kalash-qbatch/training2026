export const PRODUCT_ERROR = {
  DUPLICATE: "PRODUCT_DUPLICATE",
  NOT_FOUND: "PRODUCT_NOT_FOUND",
} as const;

export type ProductErrorCode =
  (typeof PRODUCT_ERROR)[keyof typeof PRODUCT_ERROR];

export type ProductServiceError = Error & { code: ProductErrorCode };

export function duplicateProductError(title: string): ProductServiceError {
  const err = new Error(
    `A product named "${title}" already exists`
  ) as ProductServiceError;
  err.code = PRODUCT_ERROR.DUPLICATE;
  return err;
}

export function productNotFoundError(): ProductServiceError {
  const err = new Error("Product not found") as ProductServiceError;
  err.code = PRODUCT_ERROR.NOT_FOUND;
  return err;
}

export function getProductError(err: unknown): ProductServiceError | null {
  if (!(err instanceof Error)) return null;
  const code = (err as ProductServiceError).code;
  if (
    code === PRODUCT_ERROR.DUPLICATE ||
    code === PRODUCT_ERROR.NOT_FOUND ||
    code === "PRODUCT_IN_ORDERS"
  ) {
    return err as ProductServiceError;
  }
  return null;
}

export function productErrorStatus(code: ProductErrorCode | string): number {
  switch (code) {
    case PRODUCT_ERROR.DUPLICATE:
      return 409;
    case PRODUCT_ERROR.NOT_FOUND:
      return 404;
    case "PRODUCT_IN_ORDERS":
      return 409;
    default:
      return 500;
  }
}
