import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { type Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Password1!", 12);
  const adminPasswordHash = await bcrypt.hash("Admin/123", 12);

  const kalashUserData: Prisma.UserUncheckedCreateInput = {
    fullName: "Kalash Qbatch",
    email: "kalash@qbatch.com",
    phone: "+92 300 0000000",
    passwordHash,
    role: "USER",
  };

  const adminUserData: Prisma.UserUncheckedCreateInput = {
    fullName: "Admin User",
    email: "admin@gmail.com",
    phone: "+1 555 0199",
    passwordHash: adminPasswordHash,
    role: "ADMIN",
  };

  const user = await prisma.user.create({ data: kalashUserData });
  await prisma.user.create({
    data: {
      ...kalashUserData,
      fullName: "Alex Example",
      email: "alex@example.com",
    },
  });
  await prisma.user.create({ data: adminUserData });

  const categoryDefs = [
    { name: "T-Shirts", slug: "t-shirts" },
    { name: "Jackets", slug: "jackets" },
    { name: "Beanies", slug: "beanies" },
    { name: "Sneakers", slug: "sneakers" },
    { name: "Watches", slug: "watches" },
    { name: "Sunglasses", slug: "sunglasses" },
    { name: "Crossbody Bags", slug: "crossbody-bags" },
    { name: "Tote Bags", slug: "tote-bags" },
  ];
  const categoryRows = await Promise.all(
    categoryDefs.map((c) => prisma.category.create({ data: c }))
  );
  const bySlug = Object.fromEntries(categoryRows.map((c) => [c.slug, c.id]));

  const catalog = [
    {
      title: "Classic Cotton Tee — Soft Everyday Essential",
      description: "Soft everyday essential cotton tee",
      price: 28,
      image: "/products/tee.jpg",
      color: "White",
      size: "M",
      stock: 50,
      categoryId: bySlug["t-shirts"],
    },
    {
      title: "Denim Jacket Slim Fit Urban Style",
      description: "Urban style slim denim jacket",
      price: 89,
      image: "/products/jacket.jpg",
      color: "Blue",
      size: "L",
      stock: 30,
      categoryId: bySlug.jackets,
    },
    {
      title: "Leather Crossbody Bag Compact Travel",
      description: "Compact leather travel bag",
      price: 120,
      image: "/products/bag.jpg",
      color: "Brown",
      size: "One Size",
      stock: 20,
      categoryId: bySlug["crossbody-bags"],
    },
    {
      title: "Running Sneakers Lightweight Breathable",
      description: "Lightweight breathable sneakers",
      price: 95,
      image: "/products/sneakers.jpg",
      color: "Red",
      size: "10",
      stock: 40,
      categoryId: bySlug.sneakers,
    },
    {
      title: "Wool Beanie Winter Warm Soft Knit",
      description: "Warm soft knit beanie",
      price: 24,
      image: "/products/beanie.jpg",
      color: "Gray",
      size: "One Size",
      stock: 80,
      categoryId: bySlug.beanies,
    },
    {
      title: "Sunglasses UV400 Polarized Classic",
      description: "Polarized classic sunglasses",
      price: 55,
      image: "/products/sunglasses.jpg",
      color: "Black",
      size: "One Size",
      stock: 60,
      categoryId: bySlug.sunglasses,
    },
    {
      title: "Canvas Tote Everyday Carry All",
      description: "Everyday canvas tote bag",
      price: 35,
      image: "/products/tote.jpg",
      color: "Natural",
      size: "One Size",
      stock: 70,
      categoryId: bySlug["tote-bags"],
    },
    {
      title: "Minimalist Watch Stainless Steel",
      description: "Stainless steel everyday watch",
      price: 150,
      image: "/products/watch.jpg",
      color: "Silver",
      size: "One Size",
      stock: 25,
      categoryId: bySlug.watches,
    },
  ];

  const sizeLabel = (size: string) => (size === "M" ? "Medium" : size === "L" ? "Large" : size);

  const products = await Promise.all(
    catalog.map((item) => {
      const primarySize = sizeLabel(item.size);
      const specs =
        item.size === "M" || item.size === "L"
          ? [
              {
                color: item.color,
                size: primarySize,
                qty: Math.floor(item.stock / 2),
              },
              {
                color: item.color === "White" ? "Black" : "White",
                size: item.size === "M" ? "Large" : "Medium",
                qty: Math.ceil(item.stock / 2),
              },
            ]
          : [{ color: item.color, size: primarySize, qty: item.stock }];

      return prisma.product.create({
        data: {
          ...item,
          size: primarySize,
          specifications: { create: specs },
        },
      });
    })
  );

  const spec0 = await prisma.specification.findFirst({
    where: { productId: products[0].id },
  });
  const spec1 = await prisma.specification.findFirst({
    where: { productId: products[1].id },
  });

  await prisma.cartItem.create({
    data: {
      userId: user.id,
      productId: products[0].id,
      specificationId: spec0?.id,
      quantity: 2,
    },
  });

  await prisma.order.create({
    data: {
      userId: user.id,
      status: "DELIVERED",
      subTotal: 178,
      tax: 14.24,
      total: 192.24,
      items: {
        create: [
          {
            productId: products[1].id,
            specificationId: spec1?.id,
            quantity: 1,
            price: 89,
            color: "Blue",
            size: "Large",
          },
          {
            productId: products[0].id,
            specificationId: spec0?.id,
            quantity: 2,
            price: 28,
            color: "White",
            size: "Medium",
          },
        ],
      },
    },
  });

  // console.log("Seed complete:");
  // console.log("  USER:  alex@example.com / Password1!");
  // console.log("  USER:  kalash@qbatch.com / Password1!");
  // console.log("  ADMIN: admin@gmail.com / Admin/123  → /admin/products");
  // console.log(`  Categories: ${categoryRows.length}`);
  // console.log(`  Products: ${products.length}`);
  // console.log("  Orders: 1");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
