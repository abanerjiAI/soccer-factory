// Test-only build: the whole app as ONE classic script (jsdom cannot run ES modules). Used by tools/ui-check.mjs.
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default {
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "web") } },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: ".build-ui",
    emptyOutDir: true,
    lib: { entry: path.resolve(import.meta.dirname, "web/main.tsx"), name: "SoccerLab", formats: ["iife"], fileName: () => "app.js" },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
};
