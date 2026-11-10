interface Env {
  DB: D1Database;
  AI: Ai;
  INGEST_TOKEN: string;
  READ_TOKEN: string;
  GITHUB_REPO?: string;
  GITHUB_DISPATCH_TOKEN?: string;
}

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
  AI: Ai;
    INGEST_TOKEN: string;
    READ_TOKEN: string;
    GITHUB_REPO?: string;
    GITHUB_DISPATCH_TOKEN?: string;
  }
}

// Markdown files (the AI instructions in src/skills/) are bundled as plain text.
declare module "*.md" {
  const text: string;
  export default text;
}
