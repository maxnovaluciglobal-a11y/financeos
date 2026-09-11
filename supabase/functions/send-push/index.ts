// FinanceOS — send-push
// Edge Function (Deno) que manda recordatorios de SISTEMA por Web Push.
// NUNCA envía datos financieros — solo metadatos de licencia (fechas de vencimiento,
// última actividad de sync). El contenido de los avisos es texto fijo.
//
// Implementa Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) con Web Crypto puro —
// sin SDK externo (evita el problema que tuvimos con el SDK de Stripe vía esm.sh).
// La lógica de cifrado fue verificada byte a byte contra la librería de referencia
// http_ece (la misma que usa el paquete oficial "web-push") antes de portarla acá.
//
// Secrets requeridos (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ej. "mailto:support@moyiq.app")
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ← los inyecta Supabase solo
//
// Se invoca por cron (ver supabase-push.sql, sección CRON) — corre 1 vez al día.

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC    = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE   = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT    = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@moyiq.app";

const subtle = crypto.subtle;
const enc = new TextEncoder();

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buf as ArrayBuffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array {
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

async function buildVapidJWT(audience: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT };
  const unsigned = b64url(enc.encode(JSON.stringify(header))) + "." + b64url(enc.encode(JSON.stringify(payload)));
  const key = await importVapidPrivateKey(VAPID_PRIVATE, VAPID_PUBLIC);
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

async function encryptPayload(payloadObj: unknown, p256dhB64url: string, authB64url: string): Promise<Uint8Array> {
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

async function sendWebPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: unknown) {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await buildVapidJWT(audience);
  const body = await encryptPayload(payload, sub.p256dh, sub.auth);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
      Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC}`,
    },
    body,
  });
  return res;
}

async function sbFetch(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
}

Deno.serve(async () => {
  const results = { trial_reminders: 0, errors: 0 };

  // Licencias de prueba que vencen en las próximas 72h y no recibieron aviso en las últimas 20h
  const cutoff = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
  const licRes = await sbFetch(
    `licenses?select=key_hash,expires_at&status=eq.active&expires_at=not.is.null&expires_at=lte.${cutoff}&expires_at=gt.${new Date().toISOString()}`,
  );
  const expiring: { key_hash: string; expires_at: string }[] = licRes.ok ? await licRes.json() : [];

  for (const lic of expiring) {
    const subsRes = await sbFetch(`push_subscriptions?key_hash=eq.${lic.key_hash}&select=*`);
    if (!subsRes.ok) continue;
    const subs: { id: string; endpoint: string; p256dh: string; auth: string; last_sent_at: string | null }[] = await subsRes.json();

    for (const s of subs) {
      const sentRecently = s.last_sent_at && Date.now() - new Date(s.last_sent_at).getTime() < 20 * 3600 * 1000;
      if (sentRecently) continue;

      const daysLeft = Math.max(1, Math.ceil((new Date(lic.expires_at).getTime() - Date.now()) / 86400000));
      const payload = {
        title: "FinanceOS",
        body: `Tu prueba vence en ${daysLeft} día${daysLeft === 1 ? "" : "s"}. Tus datos se quedan si decidís continuar.`,
        url: "/app/",
        tag: "trial-expiring",
      };

      try {
        const res = await sendWebPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload);
        if (res.status === 404 || res.status === 410) {
          // Suscripción muerta (usuario desinstaló/revocó permiso) → limpiar
          await sbFetch(`push_subscriptions?id=eq.${s.id}`, { method: "DELETE" });
        } else if (res.ok) {
          await sbFetch(`push_subscriptions?id=eq.${s.id}`, {
            method: "PATCH",
            body: JSON.stringify({ last_sent_at: new Date().toISOString() }),
          });
          results.trial_reminders++;
        } else {
          results.errors++;
        }
      } catch {
        results.errors++;
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, ...results }), {
    headers: { "Content-Type": "application/json" },
  });
});
