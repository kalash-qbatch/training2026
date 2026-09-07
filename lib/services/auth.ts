import { prisma } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

/** Persist OAuth provider linkage (JWT sessions do not write Account rows by default). */
export async function upsertOAuthAccount(params: {
  userId: string;
  account: {
    type: string;
    provider: string;
    providerAccountId: string;
    refresh_token?: string | null;
    access_token?: string | null;
    expires_at?: number | null;
    token_type?: string | null;
    scope?: string | null;
    id_token?: string | null;
    session_state?: string | null;
  };
}) {
  const { userId, account } = params;
  const tokens = {
    refresh_token: account.refresh_token ?? null,
    access_token: account.access_token ?? null,
    expires_at: account.expires_at ?? null,
    token_type: account.token_type ?? null,
    scope: account.scope ?? null,
    id_token: account.id_token ?? null,
    session_state: account.session_state ?? null,
  };

  return prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      },
    },
    create: {
      userId,
      type: account.type,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      ...tokens,
    },
    update: {
      userId,
      ...tokens,
    },
  });
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
