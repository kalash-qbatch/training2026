import { z } from "zod";

export const productVariantSchema = z.object({
  color: z.string().min(1),
  size: z.string().min(1),
  qty: z.coerce.number().int().min(0),
});

export const adminProductSchema = z.object({
  title: z.string().min(2, "Product name is required"),
  description: z.string().optional(),
  price: z.coerce.number().positive("Price must be greater than 0"),
  stock: z.coerce.number().int().min(0, "Quantity must be 0 or more"),
  image: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  variants: z.array(productVariantSchema).optional(),
});

export type AdminProductInput = z.infer<typeof adminProductSchema>;
