import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import dotenv from "dotenv";

// Load .env so Vite proxy auto-discovers the same PORT the server uses
dotenv.config();

export default defineConfig(() => {
  const frontendPort = Number(process.env.VITE_PORT || 3101);
  // Backend port: check VITE_BACKEND_PORT, then fall back to the server's PORT env var, then 5000
  const backendPort = Number(
    process.env.VITE_BACKEND_PORT || process.env.PORT || 5000,
  );
  return {
    server: {
      port: frontendPort,
      host: "0.0.0.0",
      allowedHosts: true as const,
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${backendPort}`,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [tailwindcss(), react()],
    define: {
      // Gemini API key removed from client bundle — proxied via server /api/ai/*
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Third-party library chunks (exempt from 250KB route-chunk rule)
            if (
              id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/") ||
              id.includes("node_modules/scheduler/")
            )
              return "vendor";
            if (id.includes("node_modules/@react-google-maps/")) return "maps";
            if (
              id.includes("node_modules/jspdf") ||
              id.includes("node_modules/jspdf-autotable")
            )
              return "pdf";
            if (id.includes("node_modules/xlsx")) return "xlsx";
            if (id.includes("node_modules/recharts")) return "charts";
            if (id.includes("node_modules/html2canvas")) return "capture";
            // Firebase SDK — split into its own shared chunk
            if (
              id.includes("node_modules/firebase/") ||
              id.includes("node_modules/@firebase/")
            )
              return "firebase";
            // lucide-react icon tree-shaking: let rollup split per-icon
            // (no manualChunks override — allows fine-grained splitting)
          },
        },
      },
    },
  };
});
