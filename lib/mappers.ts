import type {
  Product as DbProduct,
  Category as DbCategory,
  Order as DbOrder,
  OrderItem as DbOrderItem,
  OrderStatus as DbOrderStatus,
} from "@prisma/client";
import type {
  Category,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  ProductVariant,
} from "@/types";

type DbSpecification = {
  color: string;
  size: string;
  qty: number;
};

type DbProductRow = DbProduct & {
  specifications?: DbSpecification[];
  category?: Pick<DbCategory, "id" | "name" | "slug"> | null;
};
type DbOrderWithRelations = DbOrder & {
  user: { fullName: string; name?: string | null; email?: string | null };
  items: (DbOrderItem & { product: DbProduct })[];
};

function mapVariants(row: DbProductRow): ProductVariant[] {
  const specs = row.specifications ?? [];
  if (!specs.length) return [];
  return specs.map((s) => ({
    color: s.color,
    size: s.size,
    qty: s.qty,
  }));
}

export function mapCategory(
  row: Pick<DbCategory, "id" | "name" | "slug">
): Category {
  return { id: row.id, name: row.name, slug: row.slug };
}

export function mapProduct(row: DbProductRow): Product {
  const variants = mapVariants(row);
  // When variants exist, only expose those color/size combos (avoid ghost
  // options like product.size "M" mixed with variant size "Medium").
  const colors = variants.length
    ? [...new Set(variants.map((v) => v.color).filter(Boolean))]
    : row.color
      ? [row.color]
      : [];
  const sizes = variants.length
    ? [...new Set(variants.map((v) => v.size).filter(Boolean))]
    : row.size
      ? [row.size]
      : [];

  const stock = variants.length
    ? variants.reduce((sum, v) => sum + v.qty, 0)
    : row.stock;

  return {
    id: row.id,
    name: row.title,
    description: row.description,
    price: Number(row.price),
    imageUrl: row.image,
    stock,
    color: colors[0] ?? row.color ?? undefined,
    colors: colors.length ? colors : undefined,
    sizes: sizes.length ? sizes : undefined,
    variants: variants.length ? variants : undefined,
    categoryId: row.categoryId ?? undefined,
    category: row.category ? mapCategory(row.category) : undefined,
  };
}

function mapStatus(status: DbOrderStatus): OrderStatus {
  const map: Record<DbOrderStatus, OrderStatus> = {
    PENDING: "processing",
    PROCESSING: "processing",
    SHIPPED: "shipped",
    DELIVERED: "delivered",
    CANCELLED: "cancelled",
    REJECTED: "cancelled",
  };
  return map[status];
}

export function mapOrder(row: DbOrderWithRelations): Order {
  const subTotal = Number(row.subTotal);
  const tax = Number(row.tax);
  return {
    id: row.id,
    date: row.createdAt.toISOString(),
    userId: row.userId,
    userName: row.user.fullName || row.user.name || "Customer",
    userEmail: row.user.email ?? undefined,
    amount: Number(row.total),
    subTotal,
    tax,
    status: mapStatus(row.status),
    paymentMethod: "Card",
    items: row.items.map(
      (item): OrderItem => ({
        productId: item.productId,
        title: item.product.title,
        description: item.product.description,
        imageUrl: item.product.image,
        price: Number(item.price),
        qty: item.quantity,
        color: item.color ?? item.product.color ?? undefined,
        size: item.size ?? item.product.size ?? undefined,
        stock: item.product.stock,
      })
    ),
  };
}
