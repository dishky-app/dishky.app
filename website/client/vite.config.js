import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The project requires every source file to use the plain .js extension
// (no .jsx/.ts/.tsx anywhere, including React components). Vite's esbuild
// transform needs to be told explicitly to treat .js files as JSX, and to
// pre-bundle dependencies the same way.
export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: "jsx",
    include: /src\/.*\.js$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { ".js": "jsx" },
    },
  },
  server: {
    port: 5173,
    // Dev: forward /api/* to the Dishky backend (strip the /api prefix) so the
    // owner session cookie stays same-origin. In production set VITE_API_ORIGIN.
    proxy: {
      "/api": {
        target: process.env.DEV_API_TARGET || "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
