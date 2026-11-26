import { describe, it, expect, vi } from "vitest";
import { renderProTrialEmail, runProTrialCron, sendPreview, daysLeft, PREVIEW_ALLOWED, type ProTrialConfig } from "./proTrialEmailLogic.ts";
import { PRO_TRIAL_TEMPLATES, PRO_TRIAL_STEPS } from "./proTrialTemplates.ts";
import { EMAIL_LOGO_URL } from "../_shared/emailLayout.ts";

const CFG: ProTrialConfig = { supabaseUrl: "https://p.supabase.co", serviceRole: "sr", resendApiKey: "re", fromEmail: "moyiq <hola@moyiq.app>", cronSecret: "s" };
const NOW = Date.parse("2026-12-06T12:00:00Z");
const ROW = (step: string, extra: Record<string, unknown> = {}) => ({ user_id: "u-" + step, email: step + "@x.com", lang: "es", step, started_at: "2026-11-26T12:00:00Z", ends_at: "2026-12-10T12:00:00Z", ...extra }) as any;

function fakeFetch(rows: unknown[], { resendOk = true, claim = true } = {}) {
  const calls: { url: string; body: any }[] = [];
  const fn = vi.fn(async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push({ url, body });
    if (url.endsWith("/rpc/pro_trial_emails_due")) return { ok: true, status: 200, text: async () => JSON.stringify(rows) };
    if (url.endsWith("/rpc/pro_trial_email_claim")) return { ok: true, status: 200, text: async () => JSON.stringify(claim) };
    if (url.endsWith("/rpc/pro_trial_email_release")) return { ok: true, status: 200, text: async () => "" };
    if (url.includes("api.resend.com")) return { ok: resendOk, status: resendOk ? 200 : 500, text: async () => "" };
    return { ok: false, status: 404, text: async () => "" };
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

describe("send-pro-trial-email: copy (D3)", () => {
  it("los 4 idiomas, los 3 pasos; sin cobros, sin voseo, sin exclamaciones; alemán de Sie", () => {
    for (const lang of ["es", "en", "pt", "de"]) {
      for (const step of PRO_TRIAL_STEPS) {
        const r = renderProTrialEmail(step, { lang, ends_at: "2026-12-10T12:00:00Z" }, NOW);
        const text = r.subject + " " + r.text;
        expect(r.html).toContain(EMAIL_LOGO_URL);
        expect(r.html).not.toContain("MOY" + " IQ");
        expect(text).not.toMatch(/[¡!]/);
        expect(text).not.toMatch(/US\$|tarjeta de crédito|se cobra el plan|portal de facturación|billing portal/i);
        if (lang === "es") expect(text).not.toMatch(/\b(podés|tenés|querés|vos|elegí|abrí)\b/i);
        if (lang === "de") expect(text).not.toMatch(/\b(du|dein|deine|dich|dir)\b/i);
      }
    }
  });
  it("día 10: quedan 4 días y dice que no se cobra nada", () => {
    const r = renderProTrialEmail("day10", { lang: "es", ends_at: "2026-12-10T12:00:00Z" }, NOW);
    expect(r.subject).toBe("Te quedan 4 días de moyiq Pro");
    expect(r.text).toMatch(/no se cobra nada/);
    expect(daysLeft("2026-12-10T12:00:00Z", NOW)).toBe(4);
  });
  it("fin: vuelta a Starter con los datos y cómo pasar a Pro en la web", () => {
    const r = renderProTrialEmail("ended", { lang: "en", ends_at: "2026-12-05T12:00:00Z" }, NOW);
    expect(r.subject).toBe(PRO_TRIAL_TEMPLATES.en.ended.subject);
    expect(r.text).toMatch(/web version of the app/);
    expect(r.html).toContain("https://app.moyiq.app/app/?open=plan&ref=pro-trial-ended");
  });
  it("un solo botón por paso, que dice adónde lleva y abre ese destino (26-nov-2026)", () => {
    const want = {
      welcome: ["upgrade", "Abrir Modo Asesor"],
      day10: ["plan", "Elegir mi plan"],
      ended: ["plan", "Ver los planes de Pro"],
    } as const;
    for (const step of PRO_TRIAL_STEPS) {
      const r = renderProTrialEmail(step, { lang: "es", ends_at: "2026-12-10T12:00:00Z" }, NOW);
      expect((r.html.match(/<td class="mq-btn"/g) ?? []).length).toBe(1);
      expect(r.html).toContain(`?open=${want[step][0]}&ref=pro-trial-${step}`);
      expect(r.html).toContain(`>${want[step][1]}</a>`);
      expect(r.text).toContain(`${want[step][1]} (https://app.moyiq.app/app/?open=${want[step][0]}&ref=pro-trial-${step})`);
    }
  });
  it("preheader en los 4 idiomas, con la fecha, fuera del texto plano", () => {
    for (const lang of ["es", "en", "pt", "de"] as const) {
      for (const step of PRO_TRIAL_STEPS) {
        const r = renderProTrialEmail(step, { lang, ends_at: "2026-12-10T12:00:00Z" }, NOW);
        const pre = r.html.match(/<div style="display:none;[^"]*">([^&<]+)/)?.[1] ?? "";
        expect(pre.length, `${lang}/${step}`).toBeGreaterThan(20);
        expect(pre).not.toMatch(/[¡!]/);
        if (step !== "ended") expect(pre, `${lang}/${step}`).toMatch(/2026/);
        expect(r.text).not.toContain(pre.trim());
      }
    }
  });
  it("idioma desconocido cae a español", () => {
    expect(renderProTrialEmail("welcome", { lang: "fr", ends_at: "2026-12-10T12:00:00Z" }, NOW).subject).toBe("Tu prueba de moyiq Pro está activa");
  });
});

describe("send-pro-trial-email: cron idempotente", () => {
  it("reclama, manda y no suelta lo enviado", async () => {
    const { fn, calls } = fakeFetch([ROW("welcome"), ROW("day10"), ROW("ended")]);
    const r = await runProTrialCron(CFG, { now: NOW, fetchImpl: fn });
    expect(r).toMatchObject({ candidates: 3, sent: 3, failed: 0, skipped: 0, due: { welcome: 1, day10: 1, ended: 1 } });
    expect(calls.filter((c) => c.url.endsWith("pro_trial_email_claim"))).toHaveLength(3);
    expect(calls.filter((c) => c.url.endsWith("pro_trial_email_release"))).toHaveLength(0);
    const sent = calls.filter((c) => c.url.includes("resend"));
    expect(sent[0].body.from).toBe("moyiq <hola@moyiq.app>");
    expect(sent.map((c) => c.body.to)).toEqual(["welcome@x.com", "day10@x.com", "ended@x.com"]);
  });
  it("lo que otro proceso ya reclamó no se manda", async () => {
    const { fn, calls } = fakeFetch([ROW("welcome")], { claim: false });
    const r = await runProTrialCron(CFG, { now: NOW, fetchImpl: fn });
    expect(r).toMatchObject({ sent: 0, skipped: 1 });
    expect(calls.some((c) => c.url.includes("resend"))).toBe(false);
  });
  it("si Resend falla, suelta el reclamo para el próximo intento", async () => {
    const { fn, calls } = fakeFetch([ROW("day10")], { resendOk: false });
    const r = await runProTrialCron(CFG, { now: NOW, fetchImpl: fn });
    expect(r).toMatchObject({ sent: 0, failed: 1 });
    expect(calls.filter((c) => c.url.endsWith("pro_trial_email_release"))[0].body).toEqual({ p_user_id: "u-day10", p_step: "day10" });
  });
  it("dry_run no reclama ni manda", async () => {
    const { fn, calls } = fakeFetch([ROW("welcome")]);
    const r = await runProTrialCron(CFG, { now: NOW, fetchImpl: fn, dryRun: true });
    expect(r).toMatchObject({ dryRun: true, sent: 0, due: { welcome: 1 } });
    expect(calls).toHaveLength(1);
  });
});

describe("send-pro-trial-email: vista previa", () => {
  it("solo a la cuenta de empresa y con un paso válido", async () => {
    const { fn } = fakeFetch([]);
    expect(await sendPreview("otra@x.com", "welcome", "es", CFG, fn)).toEqual({ ok: false, error: "recipient_not_allowed" });
    expect(await sendPreview(PREVIEW_ALLOWED[0], "day3", "es", CFG, fn)).toEqual({ ok: false, error: "invalid_step" });
    expect(await sendPreview(PREVIEW_ALLOWED[0], "ended", "de", CFG, fn)).toEqual({ ok: true });
  });
});
