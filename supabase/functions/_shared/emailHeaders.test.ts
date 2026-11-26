// Reglas del sobre de los correos (26-nov-2026), comprobadas en el payload que
// llega a Resend:
//   - Toda persona usuaria puede responder: reply_to support@moyiq.app en los
//     correos de servicio y de marketing (no en el reporte del Modo Asesor, que
//     responde a quien lo manda).
//   - Baja con un clic (List-Unsubscribe + List-Unsubscribe-Post, RFC 8058) solo
//     en marketing (nurtures y activación de la prueba con tarjeta). Nunca en un
//     correo de servicio (prueba de Pro sin tarjeta, cobros, acceso).
//   - Remitente con el nombre "moyiq" (o "moyiq Inversiones") y siempre @moyiq.app.
//   - Siempre parte de texto plano.
import { describe, it, expect, vi, afterEach } from "vitest";
import { SUPPORT_REPLY_TO } from "./emailSender.ts";
import { renderProTrialEmail, sendViaResend as sendProTrial } from "../send-pro-trial-email/proTrialEmailLogic.ts";
import { renderTrialEmail, sendViaResend as sendTrial } from "../send-trial-activation-email/trialActivationLogic.ts";
import { renderEmail as renderStarter, sendViaResend as sendStarter } from "../send-nurture-starter-email/nurtureEmailLogic.ts";
import { renderEmail as renderDiag, sendViaResend as sendDiag } from "../send-nurture-diagnostico-email/nurtureEmailLogic.ts";
import { renderEmail as renderInvest, sendViaResend as sendInvest } from "../send-nurture-invest-email/nurtureEmailLogic.ts";
import { renderEmail as renderAuth, sendViaResend as sendAuth } from "../auth-email-hook/emailHookLogic.ts";
import { sendKeyEmail, sendTrialEndingEmail } from "../stripe-webhook/webhookLogic.ts";

afterEach(() => { vi.unstubAllGlobals(); });

const NURTURE = { supabaseUrl: "https://p.supabase.co", serviceRole: "sr", resendApiKey: "re", fromEmail: "moyiq <hola@moyiq.app>", cronSecret: "s", landingUrl: "https://moyiq.app" } as any;
const INVEST = { ...NURTURE, fromEmail: "moyiq Inversiones <invest@moyiq.app>" };
const STRIPE = { supabaseUrl: "https://p.supabase.co", serviceRole: "sr", resendApiKey: "re", fromEmail: "moyiq <licencias@moyiq.app>", alertEmail: "admin@x.com", portalUrl: "https://billing.example/p" } as any;
const BILLING = { endsAt: "2026-12-10T12:00:00Z", amountCents: 499, currency: "usd", interval: "month" as const };
const TRIAL_ROW = { id: "22222222-2222-4222-8222-222222222222", email: "t@x.com", lang: "es", trial_started_at: "2026-11-20T00:00:00Z", trial_ends_at: "2026-12-04T00:00:00Z" } as any;
const LEAD = { id: "33333333-3333-4333-8333-333333333333", email: "l@x.com", lang: "es" } as any;

function capture() {
  const f = vi.fn(async (_url: string, _init: any) => ({ ok: true, status: 200, json: async () => ({}), text: async () => "" }));
  return { f, body: (i = 0) => JSON.parse((f.mock.calls[i] as any[])[1].body) };
}

async function payloads() {
  const out: [string, "service" | "marketing", any][] = [];
  const add = async (name: string, kind: "service" | "marketing", run: (f: any) => Promise<unknown>) => {
    const c = capture();
    vi.stubGlobal("fetch", c.f);
    await run(c.f);
    out.push([name, kind, c.body()]);
    vi.unstubAllGlobals();
  };
  await add("pro-trial", "service", (f) => sendProTrial("u@x.com", renderProTrialEmail("welcome", { lang: "es", ends_at: "2026-12-10T12:00:00Z" }), { ...NURTURE }, f));
  await add("auth", "service", () => sendAuth("u@x.com", renderAuth("moyiq", "recovery", "https://x/verify", "es"), "re"));
  await add("licencia", "service", () => sendKeyEmail("u@x.com", "FNOS-AB12-CD34-EF56", "pro", "cs_1", STRIPE));
  await add("fin de prueba con tarjeta", "service", () => sendTrialEndingEmail("u@x.com", BILLING, STRIPE, "es"));
  await add("activación de la prueba", "marketing", (f) => sendTrial("u@x.com", renderTrialEmail("day1", TRIAL_ROW, NURTURE), NURTURE, f));
  await add("nurture starter", "marketing", () => sendStarter("u@x.com", renderStarter("welcome", LEAD, NURTURE), NURTURE));
  await add("nurture diagnóstico", "marketing", () => sendDiag("u@x.com", renderDiag("welcome", { ...LEAD, score: 42, label: "Regular" }, NURTURE), NURTURE));
  await add("nurture inversiones", "marketing", () => sendInvest("u@x.com", renderInvest("welcome", { ...LEAD, perfil: "moderado" }, INVEST), INVEST));
  return out;
}

describe("sobre de los correos a usuarios (Resend payload)", () => {
  it("reply_to soporte, remitente moyiq @moyiq.app y texto plano en todos", async () => {
    for (const [name, , body] of await payloads()) {
      expect(body.reply_to, name).toBe(SUPPORT_REPLY_TO);
      expect(body.from, name).toMatch(/^moyiq( Inversiones)? <[a-z]+@moyiq\.app>$/);
      expect(typeof body.text, name).toBe("string");
      expect(body.text.length, name).toBeGreaterThan(60);
    }
  });

  it("baja con un clic solo en marketing; nunca en un correo de servicio", async () => {
    for (const [name, kind, body] of await payloads()) {
      const h = body.headers ?? {};
      if (kind === "marketing") {
        expect(h["List-Unsubscribe"], name).toMatch(/^<https:\/\/p\.supabase\.co\/functions\/v1\/lead-unsubscribe\?t=[a-z]+&id=[0-9a-f-]+>, <mailto:support@moyiq\.app\?subject=unsubscribe>$/);
        expect(h["List-Unsubscribe-Post"], name).toBe("List-Unsubscribe=One-Click");
      } else {
        expect(h["List-Unsubscribe"], name).toBeUndefined();
        expect(body.html, name).not.toMatch(/unsubscribe|darme de baja/i);
      }
    }
  });

  it("los asuntos de servicio no usan palabras de promoción", async () => {
    for (const [name, kind, body] of await payloads()) {
      if (kind !== "service") continue;
      expect(body.subject, name).not.toMatch(/gratis|free|oferta|descuento|%|última oportunidad|urgente/i);
    }
  });
});
