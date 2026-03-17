import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/__tests__/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
    exclude: ["node_modules", "server", ".claude"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "node_modules/**",
        "src/__tests__/**",
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/vite-env.d.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 75,
        lines: 80,
      },
    },
  },
});
