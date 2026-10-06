import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    // Local dev: send /api to the API Worker under `wrangler dev` with the dev read token.
    // (In production the web Worker does this, after checking Cloudflare Access.)
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        headers: { Authorization: "Bearer dev-read-token" },
      },
    },
  },
  // Recharts makes one ~600 kB bundle (175 kB gzipped). Fine for a personal page.
  build: { chunkSizeWarningLimit: 700 },
  test: { include: ["test/**/*.test.ts"] },
});
