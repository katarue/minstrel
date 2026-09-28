// Web Crypto API only — works in both Edge (middleware) and Node (Server Actions)
const COOKIE_NAME = "admin_session";
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 1 year

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(secret: string): Promise<string> {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(String(expires))
  );
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${expires}.${sigHex}`;
}

export async function verifySessionToken(
  token: string,
  secret: string
): Promise<boolean> {
  const dot = token.indexOf(".");
  if (dot === -1) return false;

  const expiresStr = token.slice(0, dot);
  const sigHex = token.slice(dot + 1);

  const expires = Number(expiresStr);
  if (!Number.isInteger(expires) || Date.now() > expires) return false;

  const pairs = sigHex.match(/.{2}/g);
  if (!pairs || pairs.length !== 32) return false; // SHA-256 = 32 bytes
  const sigBytes = new Uint8Array(pairs.map((h) => parseInt(h, 16)));

  const key = await importKey(secret);
  // crypto.subtle.verify is constant-time
  return crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    new TextEncoder().encode(expiresStr)
  );
}

export { COOKIE_NAME, MAX_AGE_SECONDS };
