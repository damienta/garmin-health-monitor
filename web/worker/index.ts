import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface Env {
  API: Fetcher;
  ASSETS: Fetcher;
  READ_TOKEN?: string;
  TEAM_DOMAIN?: string;
  POLICY_AUD?: string;
}

type KeyFor = (teamDomain: string) => JWTVerifyGetKey;

const json = (body: unknown, status: number) => Response.json(body, { status });

/** Accept "team.cloudflareaccess.com" or "https://team.cloudflareaccess.com/". */
export const normaliseTeam = (team: string) =>
  `https://${team.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

// Cloudflare's public keys for your Access team, fetched once and cached by jose.
const jwksByTeam = new Map<string, JWTVerifyGetKey>();
const remoteKeys: KeyFor = (team) => {
  let jwks = jwksByTeam.get(team);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${team}/cdn-cgi/access/certs`));
    jwksByTeam.set(team, jwks);
  }
  return jwks;
};

/**
 * /api/* from the browser: check Cloudflare Access let this request in, then forward it
 * to the API Worker with READ_TOKEN added. The token never reaches the browser.
 */
export async function handleApi(req: Request, env: Env, keyFor: KeyFor = remoteKeys): Promise<Response> {
  // Fail closed: until Access is set up, serve no data at all.
  if (!env.READ_TOKEN || !env.TEAM_DOMAIN || !env.POLICY_AUD) {
    return json({ error: "not configured" }, 503);
  }
  // Access signs every request it lets through. Checking the signature means the data
  // stays private even if Access is switched off by mistake.
  const jwt = req.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt) return json({ error: "forbidden" }, 403);
  const team = normaliseTeam(env.TEAM_DOMAIN);
  try {
    await jwtVerify(jwt, keyFor(team), { issuer: team, audience: env.POLICY_AUD });
  } catch {
    return json({ error: "forbidden" }, 403);
  }

  // Read-only: the browser can never write data.
  if (req.method !== "GET") return json({ error: "method not allowed" }, 405);

  const url = new URL(req.url);
  // The host is ignored by service bindings; only the path and query matter.
  return env.API.fetch(`https://api${url.pathname}${url.search}`, {
    headers: { Authorization: `Bearer ${env.READ_TOKEN}` },
  });
}

export default {
  fetch(req, env) {
    // Only /api/* reaches here (see run_worker_first in wrangler.jsonc).
    return handleApi(req, env);
  },
} satisfies ExportedHandler<Env>;
