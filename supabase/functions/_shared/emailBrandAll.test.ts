// Auditoría 360, BRD-5: todos los correos que mandan las Edge Functions usan
// el mismo layout de marca (_shared/emailLayout.ts). Renderiza al menos un
// correo de cada función migrada con sus funciones puras y comprueba la
// cabecera con el logo, la franja Latón y que no queda ningún wrapper viejo.
import { describe, it, expect, vi, afterEach } from "vitest";
import { EMAIL_LOGO_URL } from "./emailLayout.ts";
import {
  renderKeyEmail, renderTrialEndingEmail, renderPaymentFailedEmail, renderProEndedEmail, notifyNewProPurchase,
} from "../stripe-webhook/webhookLogic.ts";
import { renderOptinEmail } from "../send-optin-confirmation/optinLogic.ts";
import { renderEmail as renderStarter } from "../send-nurture-starter-email/nurtureEmailLogic.ts";
import { renderEmail as renderDiagnostico } from "../send-nurture-diagnostico-email/nurtureEmailLogic.ts";
import { renderEmail as renderInvest } from "../send-nurture-invest-email/nurtureEmailLogic.ts";
import { renderCustomerEmail, renderInternalEmail } from "../send-cancellation-confirmation/cancellationLogic.ts";
import { renderTrialEmail } from "../send-trial-activation-email/trialActivationLogic.ts";
import { renderReportEmail } from "../send-report-email/reportEmailLogic.ts";
import { renderEmail as renderAuth } from "../auth-email-hook/emailHookLogic.ts";
import { renderNotifyEmail } from "../notify-admin-signup/notifyLogic.ts";

const STRIPE = { supabaseUrl: "https://p.supabase.co", serviceRole: "sr", resendApiKey: "re", fromEmail: "a@b.com", alertEmail: "admin@x.com", portalUrl: "https://billing.example/p" } as any;
const NURTURE = { supabaseUrl: "https://p.supabase.co", serviceRole: "sr", resendApiKey: "re", fromEmail: "MOY IQ <hola@moyiq.app>", cronSecret: "s", landingUrl: "https://moyiq.app" } as any;
const BILLING = { endsAt: "2026-10-23T12:00:00Z", amountCents: 499, currency: "usd", interval: "month" as const };
const CANCEL_ROW = {
  id: "11111111-1111-4111-8111-111111111111", created_at: "2026-10-08T14:05:00Z", lang: "en", name: "Ana", email: "ana@example.com",
  plan: "pro_yearly", contract_ref: "FNOS-AAAA", kind: "ordinary", reason: null, requested_date: null, user_agent: "UA",
  customer_email_sent_at: null, internal_email_sent_at: null,
} as any;
const TRIAL_ROW = { id: "22222222-2222-4222-8222-222222222222", email: "t@x.com", lang: "pt", trial_started_at: "2026-10-01T00:00:00Z", trial_ends_at: "2026-10-15T00:00:00Z" } as any;

const SAMPLES: [string, string][] = [
  ["stripe-webhook · licencia", renderKeyEmail("FNOS-AAAA-BBBB", "pro", STRIPE, "year").html],
  ["stripe-webhook · inicio de prueba", renderKeyEmail("FNOS-AAAA-BBBB", "pro", STRIPE, "month", BILLING, "de").html],
  ["stripe-webhook · fin de prueba", renderTrialEndingEmail(BILLING, STRIPE, "en").html],
  ["stripe-webhook · pago fallido", renderPaymentFailedEmail(STRIPE, "pt").html],
  ["stripe-webhook · fin de Pro", renderProEndedEmail("es").html],
  ["send-optin-confirmation", renderOptinEmail({ id: "o1", email: "o@x.com", lang: "en", consent_token: "tok" }, { landingUrl: "https://moyiq.app" } as any).html],
  ["send-optin-confirmation · invest", renderOptinEmail({ id: "o1", email: "o@x.com", lang: "es", consent_token: "tok" }, { landingUrl: "https://moyiq.app" } as any, "invest").html],
  ["send-nurture-starter-email", renderStarter("day5", { id: "l1", email: "l@x.com", lang: "es" } as any, NURTURE).html],
  ["send-nurture-diagnostico-email", renderDiagnostico("welcome", { id: "l1", email: "l@x.com", score: 42, label: "Regular", lang: "en" } as any, NURTURE).html],
  ["send-nurture-invest-email", renderInvest("day2", { id: "l1", email: "l@x.com", perfil: "agresivo" } as any, NURTURE).html],
  ["send-cancellation-confirmation · cliente", renderCustomerEmail(CANCEL_ROW).html],
  ["send-cancellation-confirmation · interno", renderInternalEmail(CANCEL_ROW).html],
  ["send-trial-activation-email", renderTrialEmail("day10", TRIAL_ROW, { ...NURTURE, portalUrl: "https://billing.example/p" }).html],
  ["send-report-email", renderReportEmail({ to: "c@x.com", clientName: "Ana", month: "2026-09", pdfBase64: "", filename: "r.pdf", lang: "es", senderEmail: "asesor@x.com" }).html],
  ["auth-email-hook · moyiq", renderAuth("moyiq", "recovery", "https://x.test/verify", "es").html],
  ["auth-email-hook · invest", renderAuth("invest", "signup", "https://x.test/verify", "en").html],
  ["notify-admin-signup", renderNotifyEmail("starter_signup", { email: "n@x.com", fuente: "landing" }).html],
];

afterEach(() => { vi.unstubAllGlobals(); });

function expectBrand(html: string) {
  expect(html).toContain(EMAIL_LOGO_URL);
  expect(html).toContain("background:#B8863B");
  expect(html).not.toContain("font-family:system-ui");
  // Nunca texto blanco sobre un botón ni los grises sueltos de antes.
  expect(html).not.toMatch(/color:#fff\b|#999\b|#888\b|#666\b|#1a1a1a|#8B7A55/i);
}

describe("todos los correos de la app usan el layout de marca (BRD-5)", () => {
  for (const [name, html] of SAMPLES) {
    it(name, () => expectBrand(html));
  }

  it("stripe-webhook · aviso interno al admin (compra Pro)", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => "" }));
    vi.stubGlobal("fetch", fetchMock);
    await notifyNewProPurchase({ email: "c@x.com", plan: "pro", interval: "year" }, STRIPE);
    const body = JSON.parse((fetchMock.mock.calls[0] as any[])[1].body);
    expectBrand(body.html);
  });

  it("invest lleva la etiqueta Invest junto al logo", () => {
    for (const [name, html] of SAMPLES) {
      if (/invest/.test(name)) expect(html).toMatch(/>Invest</);
    }
  });
});
