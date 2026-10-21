import { describe, it, expect, vi } from 'vitest';
import { edgeErrorEmail, runEdgeErrorAlert, EDGE_ALERT_MIN_GAP_MS } from './edgeErrorAlertLogic.ts';

const NOW = new Date('2026-10-21T12:00:00Z');
const row = (id: number, fn: string, status = 500, message = 'Error: x') => ({ id, fn, status, message, created_at: new Date(NOW.getTime() - (10 - id) * 60000).toISOString() });
const env = (n: string) => (n === 'NURTURE_RESEND_API_KEY' ? 're_test' : undefined);

function fakeDb(pending: any[], lastNotified: string | null, resendStatus = 200) {
  const calls: { url: string; init?: any }[] = [];
  const f = vi.fn(async (url: string, init?: any) => {
    calls.push({ url, init });
    if (url === 'https://api.resend.com/emails') return new Response('{}', { status: resendStatus });
    if (url.includes('notified_at=is.null&select=')) return new Response(JSON.stringify(pending));
    if (url.includes('notified_at=not.is.null')) return new Response(JSON.stringify(lastNotified ? [{ notified_at: lastNotified }] : []));
    if (init?.method === 'PATCH') return new Response(null, { status: 204 });
    throw new Error(url);
  });
  return { f, calls };
}
const config = (f: any) => ({ supabaseUrl: 'https://x.supabase.co', serviceRole: 'sr', getEnv: env, fetchImpl: f });

describe('aviso de errores de Edge Functions (C-11)', () => {
  it('sin errores pendientes no manda nada', async () => {
    const { f, calls } = fakeDb([], null);
    expect(await runEdgeErrorAlert(config(f), NOW)).toEqual({ pending: 0 });
    expect(calls.some((c) => c.url.includes('resend'))).toBe(false);
  });

  it('manda un solo correo a la empresa con el resumen y marca las filas', async () => {
    const { f, calls } = fakeDb([row(1, 'stripe-webhook'), row(2, 'send-optin-confirmation', 502), row(3, 'stripe-webhook', 500, 'HTTP 500: error issuing license')], null);
    expect(await runEdgeErrorAlert(config(f), NOW)).toEqual({ pending: 3, sent: true });
    const mail = calls.filter((c) => c.url.includes('resend'));
    expect(mail).toHaveLength(1);
    const body = JSON.parse(mail[0].init.body);
    expect(body.to).toEqual(['maxnovaluciglobal@gmail.com']);
    expect(body.from).toBe('MOY IQ <hola@moyiq.app>');
    expect(body.subject).toBe('[MOY IQ] errores en Edge Functions: 3 (stripe-webhook, send-optin-confirmation)');
    expect(body.text).toContain('stripe-webhook: 2 (HTTP 500)');
    expect(body.text).toContain('último: HTTP 500: error issuing license');
    const patch = calls.find((c) => c.init?.method === 'PATCH')!;
    expect(patch.url).toBe('https://x.supabase.co/rest/v1/edge_function_errors?id=lte.3&notified_at=is.null');
    expect(JSON.parse(patch.init.body)).toEqual({ notified_at: NOW.toISOString() });
  });

  it('como máximo un correo cada 30 min', async () => {
    const recent = new Date(NOW.getTime() - EDGE_ALERT_MIN_GAP_MS + 60000).toISOString();
    const { f, calls } = fakeDb([row(1, 'send-feedback')], recent);
    expect(await runEdgeErrorAlert(config(f), NOW)).toEqual({ pending: 1, skipped: 'throttled' });
    expect(calls.some((c) => c.url.includes('resend') || c.init?.method === 'PATCH')).toBe(false);
    const old = new Date(NOW.getTime() - EDGE_ALERT_MIN_GAP_MS - 60000).toISOString();
    const second = fakeDb([row(1, 'send-feedback')], old);
    expect((await runEdgeErrorAlert(config(second.f), NOW)).sent).toBe(true);
  });

  it('si Resend falla no marca nada (se reintenta en la próxima corrida)', async () => {
    const { f, calls } = fakeDb([row(1, 'delete-account')], null, 500);
    expect(await runEdgeErrorAlert(config(f), NOW)).toMatchObject({ pending: 1, sent: false });
    expect(calls.some((c) => c.init?.method === 'PATCH')).toBe(false);
  });

  it('modo check: solo cuenta', async () => {
    const { f, calls } = fakeDb([row(1, 'a'), row(2, 'b')], null);
    expect(await runEdgeErrorAlert(config(f), NOW, { dryRun: true })).toEqual({ pending: 2, skipped: 'dry_run' });
    expect(calls).toHaveLength(1);
  });

  it('el asunto corta en 3 funciones', () => {
    const m = edgeErrorEmail([row(1, 'a'), row(2, 'b'), row(3, 'c'), row(4, 'd')]);
    expect(m.subject).toBe('[MOY IQ] errores en Edge Functions: 4 (a, b, c…)');
  });
});
