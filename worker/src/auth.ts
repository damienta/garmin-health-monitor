import type { MiddlewareHandler } from "hono";

const encoder = new TextEncoder();

/** Constant-time string compare. Hashing first makes both sides the same length. */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

/** Require `Authorization: Bearer <token>` matching one of the named secrets. */
export function bearer(...secretNames: (keyof Env)[]): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const header = c.req.header("Authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (token) {
      for (const name of secretNames) {
        const expected = c.env[name];
        if (typeof expected === "string" && expected && (await safeEqual(token, expected))) {
          return next();
        }
      }
    }
    return c.json({ error: "unauthorized" }, 401);
  };
}
