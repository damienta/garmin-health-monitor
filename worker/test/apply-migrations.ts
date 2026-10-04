import { applyD1Migrations, env } from "cloudflare:test";
import { beforeEach } from "vitest";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// Each test starts from empty tables.
beforeEach(async () => {
  await env.DB.batch(
    ["sleep_nights", "raw_payloads", "ingest_runs"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)),
  );
});
