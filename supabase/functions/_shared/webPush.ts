// Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) con Web Crypto puro, sin SDK.
// Movido tal cual desde send-push/index.ts (20-nov-2026) para que lo usen
// send-push (recordatorios de sistema) e invest-alerts-check (alertas de precio
// de Inversiones). La lógica de cifrado fue verificada byte a byte contra la
// librería de referencia http_ece (la misma que usa el paquete "web-push")
// antes de portarla; webPush.test.ts revisa el formato y la firma VAPID.
//
// Las claves VAPID se pasan en cada llamada (no se leen de Deno.env aquí) para
// poder probar el módulo desde Node.

export type PushSubscriptionKeys = { endpoint: string; p256dh: string; auth: string };
export type VapidKeys = { publicKey: string; privateKey: string; subject: string };

const subtle = crypto.subtle;
const enc = new TextEncoder();

export function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buf as ArrayBuffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function fromB64url(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

async function importVapidPrivateKey(privB64url: string, pubB64url: string) {
  const pubBytes = fromB64url(pubB64url);
  const x = b64url(pubBytes.slice(1, 33));
  const y = b64url(pubBytes.slice(33, 65));
  return subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d: privB64url, ext: true } as JsonWebKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

export async function buildVapidJWT(audience: string, vapid: VapidKeys, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp: nowSec + 12 * 3600, sub: vapid.subject };
  const unsigned = b64url(enc.encode(JSON.stringify(header))) + "." + b64url(enc.encode(JSON.stringify(payload)));
  const key = await importVapidPrivateKey(vapid.privateKey, vapid.publicKey);
  const sig = await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned));
  return unsigned + "." + b64url(sig);
}

async function hmacSha256(keyBytes: Uint8Array, dataBytes: Uint8Array): Promise<Uint8Array> {
  const key = await subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await subtle.sign("HMAC", key, dataBytes));
}
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const out = await hmacSha256(prk, concatBytes(info, new Uint8Array([1])));
  return out.slice(0, len);
}

export async function encryptPayload(payloadObj: unknown, p256dhB64url: string, authB64url: string): Promise<Uint8Array> {
  const plaintext = enc.encode(JSON.stringify(payloadObj));
  const uaPublicBytes = fromB64url(p256dhB64url);
  const authSecret = fromB64url(authB64url);

  const asKeyPair = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublicRaw = new Uint8Array(await subtle.exportKey("raw", asKeyPair.publicKey));

  const uaPublicKey = await subtle.importKey("raw", uaPublicBytes, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: uaPublicKey } as EcdhKeyDeriveParams, asKeyPair.privateKey, 256));

  const prkKey = await hmacSha256(authSecret, ecdhSecret);
  const keyInfo = concatBytes(enc.encode("WebPush: info"), new Uint8Array([0]), uaPublicBytes, asPublicRaw);
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmacSha256(salt, ikm);
  const cek = await hkdfExpand(prk, concatBytes(enc.encode("Content-Encoding: aes128gcm"), new Uint8Array([0])), 16);
  const nonce = await hkdfExpand(prk, concatBytes(enc.encode("Content-Encoding: nonce"), new Uint8Array([0])), 12);

  const padded = concatBytes(plaintext, new Uint8Array([2]));
  const cekKey = await subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, cekKey, padded));

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  const idLen = new Uint8Array([asPublicRaw.length]);

  return concatBytes(salt, recordSize, idLen, asPublicRaw, ciphertext);
}

export async function sendWebPush(
  sub: PushSubscriptionKeys,
  payload: unknown,
  vapid: VapidKeys,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 0, // > 0: corta el pedido al servicio push (invest-alerts-check usa 8 s)
): Promise<Response> {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await buildVapidJWT(audience, vapid);
  const body = await encryptPayload(payload, sub.p256dh, sub.auth);

  return fetchImpl(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
    },
    body,
    ...(timeoutMs > 0 ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
  });
}
