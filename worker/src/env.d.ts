interface Env {
  DB: D1Database;
  INGEST_TOKEN: string;
  READ_TOKEN: string;
}

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    INGEST_TOKEN: string;
    READ_TOKEN: string;
  }
}
