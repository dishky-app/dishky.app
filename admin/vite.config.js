import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Source files keep the plain .js extension (JSX inside), so esbuild is told to treat them as JSX.
// Dev server stays on port 3000 (the same port the CRA app used) so ALLOWED_ORIGINS / CORS keep working.
export default defineConfig({
  plugins: [react()],
  esbuild: { loader: "jsx", include: /src\/.*\.js$/, exclude: [] },
  optimizeDeps: { esbuildOptions: { loader: { ".js": "jsx" } } },
  server: { port: 3001, strictPort: true },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 2500 },
});
