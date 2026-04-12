import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "react-native": path.resolve(__dirname, "__mocks__/react-native.ts"),
      "expo-router": path.resolve(__dirname, "__mocks__/expo-router.ts"),
      "@react-native-async-storage/async-storage": path.resolve(
        __dirname,
        "__mocks__/async-storage.ts",
      ),
      "@react-native-community/netinfo": path.resolve(
        __dirname,
        "__mocks__/netinfo.ts",
      ),
      "expo-file-system": path.resolve(
        __dirname,
        "__mocks__/expo-file-system.ts",
      ),
    },
  },
  esbuild: {
    tsconfigRaw: JSON.stringify({
      compilerOptions: {
        jsx: "react-jsx",
        esModuleInterop: true,
        strict: true,
      },
    }),
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["__tests__/**/*.test.ts", "__tests__/**/*.test.tsx"],
    exclude: ["node_modules"],
  },
});
