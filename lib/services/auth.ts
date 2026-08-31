import { prisma } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function createUser(data: {
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
}) {
  const user = await prisma.user.create({
    data: {
      fullName: data.fullName,
      name: data.fullName,
      email: data.email,
      phone: data.phone,
      passwordHash: data.passwordHash,
    },
  });

  // Create Stripe customer when configured (optional in CI/local without Stripe)
  if (isStripeConfigured()) {
    try {
      const customer = await getStripe().customers.create({
        email: user.email,
        name: user.fullName || user.name || "Customer",
        metadata: { userId: user.id },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customer.id },
      });
    } catch (err) {
      console.error("Failed to create Stripe customer during signup:", err);
    }
  }

  return user;
}

export async function setUserResetToken(userId: string, resetToken: string, resetTokenExp: Date) {
  return prisma.user.update({
    where: { id: userId },
    data: { resetToken, resetTokenExp },
  });
}

export async function findUserByValidResetToken(token: string) {
  return prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExp: { gt: new Date() },
    },
  });
}

export async function clearResetToken(token: string) {
  await prisma.user.updateMany({
    where: { resetToken: token },
    data: { resetToken: null, resetTokenExp: null },
  });
}

export async function updatePasswordAndClearResetToken(userId: string, passwordHash: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExp: null,
    },
  });
}
