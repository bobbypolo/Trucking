import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
      allowedHosts: true as const,
      proxy: {
        "/api": {
          target: "http://localhost:5000",
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
          manualChunks: {
            vendor: ["react", "react-dom"],
            maps: ["@react-google-maps/api"],
            pdf: ["jspdf", "jspdf-autotable"],
            charts: ["recharts"],
            capture: ["html2canvas"],
          },
        },
      },
    },
  };
});
