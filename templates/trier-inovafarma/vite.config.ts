import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const backgroundEntry = path.resolve(__dirname, "./src/background.ts");
const indexEntry = path.resolve(__dirname, "./index.html");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "https://api-sgf-gateway.triersistemas.com.br",
        changeOrigin: true,
        secure: false, // Se o servidor usa HTTPS com certificado inválido, mantenha false
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        index: indexEntry,
        background: backgroundEntry,
      },
      output: {
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === "background"
            ? "background.js"
            : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
});
