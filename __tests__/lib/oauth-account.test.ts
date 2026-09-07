import { upsertOAuthAccount } from "@/lib/services/auth";

jest.mock("../../lib/db", () => ({
  prisma: {
    account: {
      upsert: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

const mockedUpsert = prisma.account.upsert as jest.MockedFunction<typeof prisma.account.upsert>;

describe("upsertOAuthAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("upserts facebook and google provider accounts for a user", async () => {
    mockedUpsert.mockResolvedValue({ id: "acc-1" } as never);

    await upsertOAuthAccount({
      userId: "user-1",
      account: {
        type: "oauth",
        provider: "facebook",
        providerAccountId: "fb-123",
        access_token: "token",
        expires_at: 123,
        token_type: "bearer",
        scope: "public_profile",
      },
    });

    expect(mockedUpsert).toHaveBeenCalledWith({
      where: {
        provider_providerAccountId: {
          provider: "facebook",
          providerAccountId: "fb-123",
        },
      },
      create: expect.objectContaining({
        userId: "user-1",
        provider: "facebook",
        providerAccountId: "fb-123",
        access_token: "token",
      }),
      update: expect.objectContaining({
        userId: "user-1",
        access_token: "token",
      }),
    });
  });
});
