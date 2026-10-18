import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// base "./" => the built site works from ANY sub-folder (e.g. /demo/abanerji/soccer-ie/) without rebuilding.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "web") } },
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8081" } },
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 900 },
});
