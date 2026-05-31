import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT || 3000);

// Production preview/static server (Docker, Coolify, Hostinger VPS) runs `vite preview`.
// Harden it by setting PREVIEW_ALLOWED_HOSTS to a comma-separated domain allowlist
// (e.g. "erp.example.com,www.erp.example.com"). When unset, all hosts are allowed
// so first-time deployments work without extra config.
const previewAllowedHostsEnv = process.env.PREVIEW_ALLOWED_HOSTS?.trim();
const previewAllowedHosts = previewAllowedHostsEnv
  ? previewAllowedHostsEnv.split(",").map((h) => h.trim()).filter(Boolean)
  : true;

export default defineConfig({
  base: "/",

  // Build output must land in dist/public to match the artifact.toml `publicDir`
  // (Replit static deploy) and the FRONTEND_DIST the API server serves in
  // single-container Docker/Coolify deploys.
  build: {
    outDir: "dist/public",
    emptyOutDir: true,
  },

  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    host: "0.0.0.0",
    port,
    allowedHosts: true,
  },

  preview: {
    host: "0.0.0.0",
    port,
    allowedHosts: previewAllowedHosts,
  },
});