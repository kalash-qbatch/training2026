import type { z } from "zod";

import type { adminCategorySchema, adminProductSchema } from "@/lib/validations/admin";
import type {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signUpSchema,
} from "@/lib/validations/auth";

/* ==========================================================================
   1. User & Authentication Types
   ========================================================================== */

export type UserRole = "USER" | "ADMIN";

export type User = {
  id: string;
  fullName: string;
  email: string;
  mobile?: string;
  image?: string;
  role?: UserRole;
};

export type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
};

export type LoginInput = z.infer<typeof loginSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/* ==========================================================================
   2. Product & Category Types
   ========================================================================== */

export type ProductVariant = {
  id?: string;
  color: string;
  size: string;
  qty: number;
};

export type ProductImage = {
  url: string;
  color?: string;
};

export type ProductImageDraft = {
  url: string;
  color: string;
  file?: File;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
};

export type CategoryDto = {
  id: string;
  name: string;
  slug: string;
};

export type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl: string;
  images?: ProductImage[];
  stock?: number;
  color?: string;
  colors?: string[];
  sizes?: string[];
  variants?: ProductVariant[];
  categoryId?: string;
  category?: Category;
  isActive: boolean;
};

export type ProductSort = "price-asc" | "price-desc" | "name-asc";

export type SizeFilter = "all" | "s" | "m" | "l" | "xl" | "xxl";

export type ColorFilter =
  | "all"
  | "red"
  | "blue"
  | "green"
  | "yellow"
  | "purple"
  | "orange"
  | "pink"
  | "brown"
  | "gray"
  | "black"
  | "white";

export type GetProductsOptions = {
  search?: string;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
  categoryId?: string;
  categorySlug?: string;
  sizeFilters?: SizeFilter[];
  colorFilters?: ColorFilter[];
  signal?: AbortSignal;
};

export type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Static text shown before the selected label (e.g. "Sort by:"). */
  prefix?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  labelClass?: string | null;
};

export type GetProductsResult = {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ProductErrorCode =
  "PRODUCT_NOT_FOUND" | "INSUFFICIENT_STOCK" | "DUPLICATE_SKU" | "INVALID_INPUT";

export type ProductServiceError = Error & { code: ProductErrorCode };

/* ==========================================================================
   3. Shopping Cart Types
   ========================================================================== */

export type CartItem = {
  id?: string;
  productId: string;
  specificationId?: string;
  name: string;
  imageUrl: string;
  images?: { url: string; color?: string }[];
  color?: string;
  size?: string;
  price: number;
  qty: number;
  stock?: number;
};

export type AddItemResult = { ok: true; qty: number } | { ok: false; error: string };

export type CartState = {
  items: CartItem[];
  loaded: boolean;
  setItems: (items: CartItem[]) => void;
  fetchCart: () => Promise<void>;
  clearLocal: () => void;
  addItem: (
    product: Product,
    qty: number,
    opts?: { specificationId?: string }
  ) => Promise<AddItemResult>;
  updateQty: (productId: string, qty: number, specificationId?: string) => Promise<void>;
  removeItem: (productId: string, specificationId?: string) => Promise<void>;
  removeItems: (items: Array<{ productId: string; specificationId?: string }>) => Promise<void>;
  getCartQty: (productId: string, specificationId?: string) => number;
  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
};

/* ==========================================================================
   4. Order & Checkout Types
   ========================================================================== */

export type OrderStatus =
  "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "rejected";

export type OrderItem = {
  productId: string;
  specificationId?: string;
  title: string;
  description?: string;
  imageUrl: string;
  price: number;
  qty: number;
  color?: string;
  size?: string;
  stock?: number;
};

export type Order = {
  id: string;
  date: string;
  userId: string;
  userName: string;
  userEmail?: string;
  amount: number;
  subTotal: number;
  tax: number;
  status: OrderStatus;
  paymentMethod: string;
  items: OrderItem[];
};

export type PlaceOrderItemInput = {
  productId: string;
  specificationId?: string;
  quantity: number;
  color?: string;
  size?: string;
};

/* ==========================================================================
   5. Notification Types
   ========================================================================== */

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  orderId?: string;
  read: boolean;
  createdAt: string;
};

/* ==========================================================================
   6. Admin Portal Types
   ========================================================================== */

export type AdminOrderStats = {
  totalOrders: number;
  totalUnits: number;
  totalAmount: number;
};

export type DbOrderStatus =
  "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REJECTED";

export type AdminOrderFilters = {
  search?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  status?: DbOrderStatus;
  page?: number;
  pageSize?: number;
};

export type AdminOrderStatusUpdate = "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export type AdminProductInput = z.infer<typeof adminProductSchema>;
export type AdminCategoryInput = z.infer<typeof adminCategorySchema>;

export type ProductSavePayload = {
  title: string;
  price: number;
  stock: number;
  image?: string;
  images?: ProductImageDraft[];
  color?: string;
  size?: string;
  variants: ProductVariant[];
  categoryId?: string | null;
  categoryName?: string | null;
  isActive: boolean;
};

/* ==========================================================================
   7. HTTP & API Controller Types
   ========================================================================== */

export type ControllerResult = {
  status: number;
  body: Record<string, unknown>;
};

/* ==========================================================================
   8. UI Component Types
   ========================================================================== */

export type ToastType = "success" | "error" | "warning" | "info";

export type ToastMessage = {
  id: string;
  type: ToastType;
  message: string;
};

export type SelectOption = {
  value: string;
  label: string;
  /** Render in brand color (e.g. "+ Create new category"). */
  accent?: boolean;
  /** Optional class names for specific option items (e.g. sticky bottom). */
  className?: string;
};
