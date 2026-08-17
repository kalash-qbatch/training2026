import { z } from "zod";

export const productVariantSchema = z.object({
  color: z.string().min(1),
  size: z.string().min(1),
  qty: z.coerce.number().int().min(0),
});

export const productImageSchema = z.object({
  url: z.string().min(1),
  color: z.string().optional(),
});

export const adminProductSchema = z.object({
  title: z.string().min(2, "Product name is required"),
  description: z.string().optional(),
  price: z.coerce.number().positive("Price must be greater than 0"),
  stock: z.coerce.number().int().min(0, "Quantity must be 0 or more"),
  image: z.string().optional(),
  images: z.array(productImageSchema).optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  variants: z.array(productVariantSchema).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  categoryName: z.string().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const adminCategorySchema = z.object({
  name: z.string().min(2, "Category name is required").max(60),
});

export type AdminProductInput = z.infer<typeof adminProductSchema>;
