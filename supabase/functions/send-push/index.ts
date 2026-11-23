// FinanceOS — send-push
// Edge Function (Deno) que manda recordatorios de SISTEMA por Web Push.
// NUNCA envía datos financieros — solo metadatos de licencia (fechas de vencimiento,
// última actividad de sync). El contenido de los avisos es texto fijo.
//
// Implementa Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) con Web Crypto puro —
// sin SDK externo (evita el problema que tuvimos con el SDK de Stripe vía esm.sh).
// El cifrado vive en _shared/webPush.ts desde el 20-nov-2026 (lo comparte con
// invest-alerts-check); fue verificado byte a byte contra http_ece.
//
// Secrets requeridos (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ej. "mailto:support@moyiq.app")
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ← los inyecta Supabase solo
//
// Se invoca por cron (ver supabase-push.sql, sección CRON) — corre 1 vez al día.
// Solo POST con el header x-cron-secret (CRON_SECRET), ver requestGuard.ts (C-45).

import { guardPushRequest } from "./requestGuard.ts";
import { expiringTrialsPath, trialDaysLeft } from "./trialQuery.ts";
import { withErrorReporting } from "../_shared/errorReport.ts";
import { sendWebPush as sendPush } from "../_shared/webPush.ts";
import { licenseSubsPath, pickPushTargets } from "./pushTargets.ts";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC    = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE   = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT    = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@moyiq.app";

const VAPID = { publicKey: VAPID_PUBLIC, privateKey: VAPID_PRIVATE, subject: VAPID_SUBJECT };
const sendWebPush = (sub: { endpoint: string; p256dh: string; auth: string }, payload: unknown) => sendPush(sub, payload, VAPID);

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

Deno.serve(withErrorReporting("send-push", async (req) => {
  const denied = guardPushRequest(req.method, req.headers.get("x-cron-secret"), Deno.env.get("CRON_SECRET"));
  if (denied) {
    return new Response(denied.status === 204 ? null : JSON.stringify({ ok: false, error: denied.error }), {
      status: denied.status,
      headers: denied.status === 204 ? {} : { "Content-Type": "application/json" },
    });
  }

  const results = { trial_reminders: 0, errors: 0 };

  // Licencias EN PRUEBA cuya prueba termina en las próximas 72h (BIZ-N4: no las
  // pagas que renuevan) y no recibieron aviso en las últimas 20h.
  const licRes = await sbFetch(expiringTrialsPath(new Date()));
  const expiring: { key_hash: string; trial_ends_at: string }[] = licRes.ok ? await licRes.json() : [];

  for (const lic of expiring) {
    // Solo servicios Web Push y 5 por licencia, las más recientes (pushTargets.ts).
    const subsRes = await sbFetch(licenseSubsPath(lic.key_hash));
    if (!subsRes.ok) continue;
    const subs = pickPushTargets(await subsRes.json() as { id: string; endpoint: string; p256dh: string; auth: string; last_sent_at: string | null }[]);

    for (const s of subs) {
      const sentRecently = s.last_sent_at && Date.now() - new Date(s.last_sent_at).getTime() < 20 * 3600 * 1000;
      if (sentRecently) continue;

      const daysLeft = trialDaysLeft(lic.trial_ends_at, new Date());
      const payload = {
        title: "moyiq",
        // Respaldo en español; el service worker (public/push-sw.js) arma el
        // texto en el idioma del navegador a partir de `i18n`.
        body: `Tu prueba vence en ${daysLeft} día${daysLeft === 1 ? "" : "s"}. Tus datos se quedan si decides continuar.`,
        i18n: { key: "trialExpiring", days: daysLeft },
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
}));
