export type UserRole = "USER" | "ADMIN";

export type User = {
  id: string;
  fullName: string;
  email: string;
  mobile?: string;
  image?: string;
  role?: UserRole;
};

export type ProductVariant = {
  color: string;
  size: string;
  qty: number;
};

export type Category = {
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
  stock?: number;
  color?: string;
  colors?: string[];
  sizes?: string[];
  variants?: ProductVariant[];
  categoryId?: string;
  category?: Category;
};

export type AdminOrderStats = {
  totalOrders: number;
  totalUnits: number;
  totalAmount: number;
};

export type CartItem = {
  productId: string;
  name: string;
  imageUrl: string;
  color?: string;
  size?: string;
  price: number;
  qty: number;
  stock?: number;
};

export type OrderStatus = "processing" | "shipped" | "delivered" | "cancelled";

export type OrderItem = {
  productId: string;
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

export type ToastType = "success" | "error" | "info";

export type ToastMessage = {
  id: string;
  type: ToastType;
  message: string;
};
