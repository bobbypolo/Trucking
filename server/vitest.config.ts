import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    setupFiles: ["__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["**/*.ts"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "__tests__/**",
        "vitest.config.ts",
        "types/**",
      ],
      // Thresholds to be enforced in CI once campaign targets are met
      // thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
