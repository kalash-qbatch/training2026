import { prisma } from "@/lib/db";

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function createUser(data: {
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
}) {
  return prisma.user.create({
    data: {
      fullName: data.fullName,
      name: data.fullName,
      email: data.email,
      phone: data.phone,
      passwordHash: data.passwordHash,
    },
  });
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
