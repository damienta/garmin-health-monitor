import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, createLocalJWKSet } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { handleApi, normaliseTeam, type Env } from "../worker/index";

const TEAM = "https://me.cloudflareaccess.com";
const AUD = "test-aud";

let privateKey: CryptoKey;
let otherKey: CryptoKey;
let keyFor: () => ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  otherKey = (await generateKeyPair("RS256")).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), alg: "RS256" };
  keyFor = () => createLocalJWKSet({ keys: [jwk] });
});

const sign = (opts: { aud?: string; iss?: string; key?: CryptoKey } = {}) =>
  new SignJWT({ email: "me@example.com" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(opts.iss ?? TEAM)
    .setAudience(opts.aud ?? AUD)
    .setExpirationTime("5m")
    .sign(opts.key ?? privateKey);

/** Fake API Worker that records what it was asked for. */
function fakeEnv(overrides: Partial<Env> = {}) {
  const calls: Request[] = [];
  const api = {
    fetch: async (input: RequestInfo, init?: RequestInit) => {
      calls.push(new Request(input, init));
      return Response.json([{ ok: true }]);
    },
  } as unknown as Fetcher;
  const env: Env = {
    API: api,
    ASSETS: api,
    READ_TOKEN: "secret-read",
    TEAM_DOMAIN: "me.cloudflareaccess.com",
    POLICY_AUD: AUD,
    ...overrides,
  };
  return { env, calls };
}

const request = (jwt?: string, init: RequestInit = {}, path = "/api/trends?days=30") =>
  new Request(`https://web.example${path}`, {
    ...init,
    headers: { ...(jwt ? { "Cf-Access-Jwt-Assertion": jwt } : {}), Authorization: "Bearer from-browser" },
  });

describe("api proxy", () => {
  it("refuses everything until Access and the token are configured", async () => {
    const { env, calls } = fakeEnv({ POLICY_AUD: undefined });
    const res = await handleApi(request(await sign()), env, keyFor);
    expect(res.status).toBe(503);
    expect(calls).toHaveLength(0);
  });

  it("rejects requests without an Access token", async () => {
    const { env, calls } = fakeEnv();
    expect((await handleApi(request(), env, keyFor)).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it.each([
    ["wrong audience", () => sign({ aud: "someone-else" })],
    ["wrong issuer", () => sign({ iss: "https://evil.cloudflareaccess.com" })],
    ["wrong signing key", () => sign({ key: otherKey })],
  ])("rejects a token with the %s", async (_name, makeJwt) => {
    const { env, calls } = fakeEnv();
    expect((await handleApi(request(await makeJwt()), env, keyFor)).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("rejects writes even with a valid token", async () => {
    const { env, calls } = fakeEnv();
    const res = await handleApi(request(await sign(), { method: "POST" }, "/api/ingest"), env, keyFor);
    expect(res.status).toBe(405);
    expect(calls).toHaveLength(0);
  });

  it("forwards reads with READ_TOKEN, keeping path and query", async () => {
    const { env, calls } = fakeEnv();
    const res = await handleApi(request(await sign()), env, keyFor);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ ok: true }]);
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0].url);
    expect(url.pathname + url.search).toBe("/api/trends?days=30");
    // The browser's own Authorization header is replaced, never passed through.
    expect(calls[0].headers.get("Authorization")).toBe("Bearer secret-read");
  });

  it("accepts the team domain with or without https://", () => {
    expect(normaliseTeam("me.cloudflareaccess.com")).toBe(TEAM);
    expect(normaliseTeam(" https://me.cloudflareaccess.com/ ")).toBe(TEAM);
  });
});
