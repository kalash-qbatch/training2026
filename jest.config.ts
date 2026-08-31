import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  clearMocks: true,
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/__tests__/setup.ts"],
  collectCoverageFrom: [
    "app/api/**/*.ts",
    "lib/api/**/*.ts",
    "lib/controllers/**/*.ts",
    "components/features/auth/**/*.tsx",
    "components/features/cart/**/*.tsx",
    "!**/*.d.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "text-summary", "lcov", "html"],
};

export default async () => {
  const nextConfig = await createJestConfig(config)();
  return {
    ...nextConfig,
    moduleNameMapper: {
      ...nextConfig.moduleNameMapper,
      "^@/auth$": "<rootDir>/__tests__/mocks/auth.mock.ts",
      "^@/lib/controllers/http$": "<rootDir>/__tests__/mocks/http.mock.ts",
    },
  };
};
