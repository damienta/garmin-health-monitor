import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        // Never reach the real Workers AI from tests (it needs a Cloudflare login).
        // Tests replace env.AI.run with a fake.
        remoteBindings: false,
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations, INGEST_TOKEN: "test-ingest", READ_TOKEN: "test-read" },
        },
      }),
    ],
    test: { setupFiles: ["./test/apply-migrations.ts"] },
  };
});
