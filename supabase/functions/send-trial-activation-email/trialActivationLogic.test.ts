import { describe, it, expect, vi } from 'vitest';
import { dueStep, renderTrialEmail, runTrialCron, sendPreview, footerUnsubscribeUrl, type TrialRow } from './trialActivationLogic.ts';
import { TRIAL_TEMPLATES } from './trialTemplates.ts';

const DAY = 86400000;
const start = Date.parse('2026-10-01T12:00:00Z');
const row = (over: Partial<TrialRow> = {}): TrialRow => ({
  id: '11111111-1111-4111-8111-111111111111', email: 'maxnovaluciglobal@gmail.com', lang: 'es',
  trial_started_at: new Date(start).toISOString(), trial_ends_at: new Date(start + 14 * DAY).toISOString(), ...over,
});
const config = { supabaseUrl: 'https://x.supabase.co', serviceRole: 'sr', resendApiKey: 're', fromEmail: 'MOY IQ <hola@moyiq.app>', portalUrl: 'https://billing.example/p' };

describe('secuencia de activación de la prueba (C-35 / COM-10)', () => {
  it('días 1, 3 y 10, un solo correo por corrida y nunca hacia atrás', () => {
    expect(dueStep(row(), start + 0.5 * DAY)).toBe(null);
    expect(dueStep(row(), start + 1 * DAY)).toBe('day1');
    expect(dueStep(row({ day1_sent_at: 'x' }), start + 2 * DAY)).toBe(null);
    expect(dueStep(row({ day1_sent_at: 'x' }), start + 3 * DAY)).toBe('day3');
    expect(dueStep(row({ day1_sent_at: 'x', day3_sent_at: 'x' }), start + 9 * DAY)).toBe(null);
    expect(dueStep(row({ day1_sent_at: 'x', day3_sent_at: 'x' }), start + 10 * DAY)).toBe('day10');
    expect(dueStep(row({ day10_sent_at: 'x' }), start + 11 * DAY)).toBe(null);
  });
  it('si el cron se atrasó manda solo el que corresponde', () => {
    expect(dueStep(row(), start + 4 * DAY)).toBe('day3');
    expect(dueStep(row({ day3_sent_at: 'x' }), start + 5 * DAY)).toBe(null);
  });
  it('nada después del fin de la prueba', () => {
    expect(dueStep(row(), start + 14 * DAY)).toBe(null);
  });
  it('copy en los 4 idiomas: sin exclamaciones, sin emoji, sin voseo', () => {
    for (const [lang, T] of Object.entries(TRIAL_TEMPLATES)) {
      const all = [T.day1, T.day3, T.day10('1 de enero')].flatMap((c) => [c.subject, c.cta, ...c.paragraphs]).concat([T.cancelNoPortal, T.why, T.unsubscribe]).join(' ');
      expect(all, lang).not.toMatch(/[!¡]/);
      expect(all, lang).not.toMatch(/\p{Extended_Pictographic}/u);
      if (lang === 'es') expect(all).not.toMatch(/\b(tenés|podés|querés|sabés|escribí|cancelá|revisá|importá|elegiste vos)\b/i);
      if (lang === 'de') expect(all).not.toMatch(/\b(du|dein|deine|dich)\b/i);
    }
  });
  it('cada correo lleva baja con un clic, enlace de baja en la app y dirección postal', () => {
    for (const step of ['day1', 'day3', 'day10'] as const) {
      for (const lang of ['es', 'en', 'pt', 'de']) {
        const r = renderTrialEmail(step, row({ lang }), config);
        expect(r.headers['List-Unsubscribe']).toContain('/functions/v1/lead-unsubscribe?t=trial&id=11111111-1111-4111-8111-111111111111');
        expect(r.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
        expect(r.html).toContain(footerUnsubscribeUrl('https://app.moyiq.app/app/', '11111111-1111-4111-8111-111111111111'));
        expect(r.html).toContain('Doral, FL');
        expect(r.html).toContain('https://app.moyiq.app/app/?open=');
      }
    }
    expect(renderTrialEmail('day1', row(), config).html).toContain('?open=import&ref=trial-day1');
    const d10 = renderTrialEmail('day10', row(), config);
    expect(d10.html).toContain('15 de octubre de 2026');
    expect(d10.html).toContain('https://billing.example/p');
  });
  it('dry_run no manda ni marca nada', async () => {
    const f = vi.fn(async (url: string) => {
      if (url.endsWith('/rpc/trial_activation_due')) return new Response(JSON.stringify([row(), row({ id: '22222222-2222-4222-8222-222222222222', day1_sent_at: 'x' })]));
      throw new Error('no debería llamar ' + url);
    });
    const r = await runTrialCron(config, { dryRun: true, now: start + 3 * DAY, fetchImpl: f as any });
    expect(r).toMatchObject({ candidates: 2, due: { day1: 0, day3: 2, day10: 0 }, sent: 0, dryRun: true });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('cron manda y marca; un fallo de envío no marca', async () => {
    const calls: string[] = [];
    let resendCalls = 0;
    const f = vi.fn(async (url: string, init: any) => {
      calls.push(url);
      if (url.endsWith('/rpc/trial_activation_due')) return new Response(JSON.stringify([row(), row({ id: '33333333-3333-4333-8333-333333333333' })]));
      if (url === 'https://api.resend.com/emails') { resendCalls++; return new Response('{}', { status: resendCalls <= 1 ? 200 : 500 }); }
      if (url.endsWith('/rpc/mark_trial_activation_sent')) { expect(JSON.parse(init.body)).toEqual({ p_id: '11111111-1111-4111-8111-111111111111', p_step: 'day1' }); return new Response(''); }
      throw new Error(url);
    });
    const r = await runTrialCron(config, { now: start + 1 * DAY, fetchImpl: f as any });
    expect(r.sent).toBe(1);
    expect(r.failed).toBe(1);
    expect(calls.filter((c) => c.endsWith('/rpc/mark_trial_activation_sent'))).toHaveLength(1);
  });
  it('preview solo a la cuenta de empresa', async () => {
    const f = vi.fn(async () => new Response('{}'));
    expect(await sendPreview('alguien@gmail.com', 'day1', 'es', config, f as any)).toEqual({ ok: false, error: 'recipient_not_allowed' });
    expect(await sendPreview('maxnovaluciglobal@gmail.com', 'day7', 'es', config, f as any)).toEqual({ ok: false, error: 'invalid_step' });
    expect(f).not.toHaveBeenCalled();
    expect(await sendPreview('maxnovaluciglobal@gmail.com', 'day3', 'pt', config, f as any)).toEqual({ ok: true });
    const body = JSON.parse((f.mock.calls[0] as any)[1].body);
    expect(body.to).toBe('maxnovaluciglobal@gmail.com');
    expect(body.subject).toBe(TRIAL_TEMPLATES.pt.day3.subject);
  });
});
