import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// JSX lives in plain .js files, so esbuild is told to treat them as JSX.
// Dev server keeps CRA's port 3000 so ALLOWED_ORIGINS / CORS keep working.
export default defineConfig({
  plugins: [react()],
  esbuild: { loader: "jsx", include: /src\/.*\.js$/, exclude: [] },
  optimizeDeps: { esbuildOptions: { loader: { ".js": "jsx" } } },
  server: { port: 3000, strictPort: true },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 2500 },
});
