// _shared/webPush.ts: el cifrado aes128gcm se descifra del lado del navegador
// (aquí, con la clave privada de una suscripción de prueba) y la firma VAPID
// valida con la clave pública. Corre en Node con Web Crypto.
import { describe, it, expect, vi } from 'vitest';
import { b64url, buildVapidJWT, encryptPayload, fromB64url, sendWebPush } from './webPush.ts';

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();

async function hmac(key: Uint8Array, data: Uint8Array) {
  const k = await subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await subtle.sign('HMAC', k, data));
}
const cat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((s, x) => s + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const expand = async (prk: Uint8Array, info: Uint8Array, n: number) => (await hmac(prk, cat(info, new Uint8Array([1])))).slice(0, n);

// Suscripción de prueba: lo que guarda el navegador (p256dh, auth) y su clave privada.
async function fakeSubscription() {
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
  const auth = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return { kp, p256dh: b64url(pub), auth: b64url(auth), pub, authBytes: auth };
}

// Descifrado RFC 8291 del lado del agente de usuario.
async function decrypt(body: Uint8Array, sub: Awaited<ReturnType<typeof fakeSubscription>>) {
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0, false);
  const idLen = body[20];
  const asPub = body.slice(21, 21 + idLen);
  const ct = body.slice(21 + idLen);
  const asKey = await subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey } as EcdhKeyDeriveParams, sub.kp.privateKey, 256));
  const prkKey = await hmac(sub.authBytes, secret);
  const ikm = await expand(prkKey, cat(enc.encode('WebPush: info'), new Uint8Array([0]), sub.pub, asPub), 32);
  const prk = await hmac(salt, ikm);
  const cek = await expand(prk, cat(enc.encode('Content-Encoding: aes128gcm'), new Uint8Array([0])), 16);
  const nonce = await expand(prk, cat(enc.encode('Content-Encoding: nonce'), new Uint8Array([0])), 12);
  const k = await subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt']);
  const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, k, ct));
  expect(plain[plain.length - 1]).toBe(2); // delimitador del último registro
  return { rs, idLen, json: JSON.parse(new TextDecoder().decode(plain.slice(0, -1))) };
}

async function vapidKeys() {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await subtle.exportKey('jwk', kp.privateKey) as JsonWebKey;
  const pub = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
  return { publicKey: b64url(pub), privateKey: jwk.d as string, subject: 'mailto:support@moyiq.app', verifyKey: kp.publicKey };
}

describe('webPush (compartido por send-push e invest-alerts-check)', () => {
  it('el cuerpo cifrado se descifra con la clave de la suscripción', async () => {
    const sub = await fakeSubscription();
    const payload = { title: 'moyiq', i18n: { key: 'priceAlert', t: 'AAPL' }, tag: 'invest-alert-1' };
    const body = await encryptPayload(payload, sub.p256dh, sub.auth);
    const out = await decrypt(body, sub);
    expect(out.rs).toBe(4096);
    expect(out.idLen).toBe(65);
    expect(out.json).toEqual(payload);
  });

  it('la firma VAPID (ES256) valida con la clave pública y lleva aud, exp y sub', async () => {
    const v = await vapidKeys();
    const jwt = await buildVapidJWT('https://fcm.googleapis.com', v, 1_700_000_000);
    const [h, p, sig] = jwt.split('.');
    const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, v.verifyKey, fromB64url(sig), enc.encode(`${h}.${p}`));
    expect(ok).toBe(true);
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(p)));
    expect(claims).toEqual({ aud: 'https://fcm.googleapis.com', exp: 1_700_000_000 + 12 * 3600, sub: 'mailto:support@moyiq.app' });
  });

  it('sendWebPush manda POST al endpoint con los encabezados de Web Push', async () => {
    const v = await vapidKeys();
    const sub = await fakeSubscription();
    const f = vi.fn(async () => new Response(null, { status: 201 }));
    const res = await sendWebPush({ endpoint: 'https://push.example/abc', p256dh: sub.p256dh, auth: sub.auth }, { a: 1 }, v, f as unknown as typeof fetch);
    expect(res.status).toBe(201);
    const [url, init] = (f.mock.calls[0] as unknown as [string, RequestInit]);
    expect(url).toBe('https://push.example/abc');
    const hd = init.headers as Record<string, string>;
    expect(init.method).toBe('POST');
    expect(hd['Content-Encoding']).toBe('aes128gcm');
    expect(hd.Authorization).toMatch(new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${v.publicKey}$`));
  });

  it('send-push usa el módulo compartido (sin una segunda copia del cifrado)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../send-push/index.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/from "\.\.\/_shared\/webPush\.ts"/);
    expect(src).not.toMatch(/function encryptPayload|aes128gcm"\), new Uint8Array/);
  });
});
