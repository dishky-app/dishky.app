import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Source files use the plain .js extension (like the Dishky website), so tell
// esbuild to treat them as JSX.
export default defineConfig({
  plugins: [react()],
  esbuild: { loader: "jsx", include: /src\/.*\.js$/, exclude: [] },
  optimizeDeps: { esbuildOptions: { loader: { ".js": "jsx" } } },
  server: {
    port: 5175,
    // Dev: /api/* -> the Dishky API with the /api prefix removed.
    proxy: {
      "/api": {
        target: process.env.DEV_API_TARGET || "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
