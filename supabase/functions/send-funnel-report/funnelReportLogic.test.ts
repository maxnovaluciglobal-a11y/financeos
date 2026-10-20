import { describe, it, expect, vi } from "vitest";
import { reportWeekStart, hourIn, variation, renderReport, runReport, REPORT_TO, type ReportData } from "./funnelReportLogic.ts";

const DATA: ReportData = {
  week_start: "2026-10-12",
  current: { visitas: null, altas: 3, activas: 5, pruebas: 1, pagos: 0, bajas: 1 },
  previous: { visitas: null, altas: 2, activas: 5, pruebas: 0, pagos: 0, bajas: 0 },
  previous_is_snapshot: true,
  already_sent: false,
  leads: [{ etapa: "starter", emails: 2, confirmados: 1 }],
  leads_previous: [{ etapa: "starter", emails: 1, confirmados: 1 }],
};
const config = { supabaseUrl: "https://x.supabase.co", serviceRole: "srv", resendApiKey: "re", fromEmail: "MOY IQ <hola@moyiq.app>" };

function fakeFetch(data: ReportData) {
  const calls: { url: string; body: any }[] = [];
  const impl = vi.fn(async (url: string, init: any) => {
    calls.push({ url, body: JSON.parse(init.body) });
    if (url.includes("funnel_report_data")) return new Response(JSON.stringify(data), { status: 200 });
    if (url.includes("funnel_report_mark_sent")) return new Response("true", { status: 200 });
    return new Response("{}", { status: 200 });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

describe("send-funnel-report (EST-9)", () => {
  it("reports the week that ended: Monday to Sunday before the run", () => {
    expect(reportWeekStart(new Date("2026-10-19T15:02:00Z"))).toBe("2026-10-12");
    expect(reportWeekStart(new Date("2026-10-25T23:00:00Z"))).toBe("2026-10-12");
    expect(reportWeekStart(new Date("2026-10-26T00:30:00Z"))).toBe("2026-10-19");
  });

  it("12:00 in Chile is 15 UTC in summer and 16 UTC in winter", () => {
    expect(hourIn("America/Santiago", new Date("2026-10-19T15:02:00Z"))).toBe(12);
    expect(hourIn("America/Santiago", new Date("2026-10-19T16:02:00Z"))).toBe(13);
    expect(hourIn("America/Santiago", new Date("2026-06-15T16:02:00Z"))).toBe(12);
  });

  it("variation with sign, percent and missing data", () => {
    expect(variation(3, 2)).toBe("+1 (+50 %)");
    expect(variation(1, 2)).toBe("−1 (−50 %)");
    expect(variation(2, 0)).toBe("+2");
    expect(variation(5, 5)).toBe("sin cambio");
    expect(variation(null, 1)).toBe("s/d");
  });

  it("renders the 6 numbers, the variation and an empty goal row, on the brand layout", () => {
    const { subject, html } = renderReport(DATA);
    expect(subject).toContain("embudo semanal");
    for (const l of ["Visitas a la landing", "Altas", "Activas", "Pruebas Pro iniciadas", "Pagos", "Bajas", "Meta", "definir"]) expect(html).toContain(l);
    expect(html).toContain("+1 (+50 %)");
    expect(html).toContain("s/d");
    expect(html).toContain("background:#14213D");
    expect(html).not.toMatch(/\bvos\b|tenés|podés|querés/);
    expect(renderReport(DATA, { preview: true }).subject.startsWith("[Vista previa]")).toBe(true);
  });

  it("cron: skips outside 12:00 Chile and when the week was already sent", async () => {
    const f = fakeFetch(DATA);
    expect(await runReport("cron", config, { now: new Date("2026-10-19T16:02:00Z"), fetchImpl: f.impl })).toMatchObject({ status: "skipped", reason: "not_send_hour" });
    expect(f.calls).toHaveLength(0);
    const g = fakeFetch({ ...DATA, already_sent: true });
    expect(await runReport("cron", config, { now: new Date("2026-10-19T15:02:00Z"), fetchImpl: g.impl })).toMatchObject({ status: "skipped", reason: "already_sent" });
    expect(g.calls.some((c) => c.url.includes("resend"))).toBe(false);
  });

  it("cron at 12:00 Chile: sends only to the company inbox and records the week", async () => {
    const f = fakeFetch(DATA);
    const r = await runReport("cron", config, { now: new Date("2026-10-19T15:02:00Z"), fetchImpl: f.impl });
    expect(r).toMatchObject({ status: "sent", preview: false, week_start: "2026-10-12" });
    const send = f.calls.find((c) => c.url.includes("api.resend.com"))!;
    expect(send.body.to).toBe(REPORT_TO);
    expect(REPORT_TO).toBe("maxnovaluciglobal@gmail.com");
    expect(f.calls.find((c) => c.url.includes("funnel_report_mark_sent"))!.body).toEqual({ p_week_start: "2026-10-12", p_metrics: DATA.current });
  });

  it("preview sends without recording; dry_run sends nothing", async () => {
    const f = fakeFetch(DATA);
    expect(await runReport("preview", config, { now: new Date("2026-10-20T04:00:00Z"), fetchImpl: f.impl })).toMatchObject({ status: "sent", preview: true });
    expect(f.calls.some((c) => c.url.includes("mark_sent"))).toBe(false);
    const g = fakeFetch(DATA);
    const d = await runReport("dry_run", config, { now: new Date("2026-10-20T04:00:00Z"), fetchImpl: g.impl });
    expect(d.status).toBe("dry_run");
    expect(g.calls.some((c) => c.url.includes("resend"))).toBe(false);
  });
});
