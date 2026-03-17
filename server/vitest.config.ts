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
      thresholds: { statements: 75, branches: 65, functions: 78, lines: 75 },
    },
  },
});
