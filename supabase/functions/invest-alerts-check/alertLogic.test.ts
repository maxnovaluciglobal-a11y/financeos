import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  COOLDOWN_MS, buildAlertPayload, claimPath, conditionMet, dueAlerts, guardAlertsRequest, inCooldown,
  quotePaths, readQuotes, runAlertsCheck, symbolsToQuote, type AlertRow,
} from './alertLogic.ts';
import { conditionMet as appConditionMet } from '../../../src/utils/investAlerts.js';

const NOW = Date.parse('2026-11-20T15:00:00Z');
const row = (over: Partial<AlertRow> = {}): AlertRow => ({ id: 'a1', user_id: 'u1', symbol: 'AAPL', condition: 'above', threshold: 250, last_triggered_at: null, ...over });

describe('guardAlertsRequest', () => {
  it('OPTIONS no corre nada; solo POST con el secreto del cron', () => {
    expect(guardAlertsRequest('OPTIONS', null, 's')).toEqual({ status: 204, error: '' });
    expect(guardAlertsRequest('GET', 's', 's')?.status).toBe(405);
    expect(guardAlertsRequest('POST', null, 's')?.status).toBe(401);
    expect(guardAlertsRequest('POST', 'x', 's')?.status).toBe(401);
    expect(guardAlertsRequest('POST', 's', undefined)?.status).toBe(401);
    expect(guardAlertsRequest('POST', 's', 's')).toBeNull();
  });
  it('index.ts aplica la guarda antes de leer alertas y no abre CORS', () => {
    const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    expect(src.indexOf('guardAlertsRequest(')).toBeGreaterThan(0);
    expect(src.indexOf('guardAlertsRequest(')).toBeLessThan(src.indexOf('runAlertsCheck({'));
    expect(src).not.toMatch(/Access-Control-Allow-Origin/);
    expect(src).toMatch(/withErrorReporting\("invest-alerts-check"/);
  });
});

describe('cuándo suena una alerta', () => {
  it('sube a / baja a / movimiento del día', () => {
    expect(conditionMet('above', 250, { price: 250 })).toBe(true);
    expect(conditionMet('above', 250, { price: 249.99 })).toBe(false);
    expect(conditionMet('below', 100, { price: 99 })).toBe(true);
    expect(conditionMet('below', 100, { price: 101 })).toBe(false);
    expect(conditionMet('pct_move', 5, { price: 10, changePct: -0.051 })).toBe(true);
    expect(conditionMet('pct_move', 5, { price: 10, changePct: 0.049 })).toBe(false);
  });
  it('nunca sin precio ni con un nivel inválido', () => {
    expect(conditionMet('below', 100, { price: 0 })).toBe(false);
    expect(conditionMet('below', 100, null)).toBe(false);
    expect(conditionMet('pct_move', 5, { price: 10, changePct: null })).toBe(false);
    expect(conditionMet('above', 0, { price: 10 })).toBe(false);
  });
  it('la app decide igual que la función (misma tabla de casos)', () => {
    const cases: [string, number, unknown][] = [
      ['above', 250, { price: 250 }], ['above', 250, { price: 10 }], ['below', 5, { price: 4 }], ['below', 5, null],
      ['pct_move', 3, { price: 1, changePct: 0.03 }], ['pct_move', 3, { price: 1, changePct: -0.02 }], ['other', 1, { price: 2 }],
    ];
    for (const [c, t, q] of cases) expect([c, t, appConditionMet(c, t, q)]).toEqual([c, t, conditionMet(c, t, q as never)]);
  });
  it('no repite antes de 24 h; un movimiento del día avisa una vez por sesión', () => {
    expect(inCooldown(row({ last_triggered_at: new Date(NOW - COOLDOWN_MS + 60000).toISOString() }), NOW)).toBe(true);
    expect(inCooldown(row({ last_triggered_at: new Date(NOW - COOLDOWN_MS - 60000).toISOString() }), NOW)).toBe(false);
    const pct = row({ condition: 'pct_move', threshold: 5, last_triggered_at: new Date(NOW - 30 * 3600 * 1000).toISOString() });
    // La cotización es de antes del último aviso (mercado cerrado desde entonces): no repite.
    expect(inCooldown(pct, NOW, { price: 1, marketTime: (NOW - 40 * 3600 * 1000) / 1000 })).toBe(true);
    expect(inCooldown(pct, NOW, { price: 1, marketTime: (NOW - 3600 * 1000) / 1000 })).toBe(false);
  });
  it('dueAlerts junta alerta y cotización', () => {
    const a = [row(), row({ id: 'a2', symbol: 'MSFT', condition: 'below', threshold: 300 }), row({ id: 'a3', symbol: 'NOPE' })];
    const due = dueAlerts(a, { AAPL: { price: 260 }, MSFT: { price: 310 } }, NOW);
    expect(due.map(d => d.alert.id)).toEqual(['a1']);
  });
});

describe('pedidos a la API de Invest', () => {
  it('símbolos sin repetir, sin los que están en espera, en lotes de 10', () => {
    const a = [row(), row({ id: 'b' }), row({ id: 'c', symbol: 'SPY', last_triggered_at: new Date(NOW - 1000).toISOString() }), row({ id: 'd', symbol: 'bad;' })];
    expect(symbolsToQuote(a, NOW)).toEqual(['AAPL']);
    const many = Array.from({ length: 23 }, (_, i) => `T${i}`);
    const paths = quotePaths(many);
    expect(paths).toHaveLength(3);
    expect(paths[0]).toBe(`/api/quote?ticker=${many.slice(0, 10).join(',')}`);
    expect(quotePaths(['^GSPC'])[0]).toBe('/api/quote?ticker=%5EGSPC');
  });
  it('lee solo precios válidos e ignora _errors', () => {
    expect(readQuotes({ aapl: { price: 1, changePct: 0.01, currency: 'USD', marketTime: 5 }, X: { price: 0 }, _errors: { Y: 'x' } }))
      .toEqual({ AAPL: { price: 1, changePct: 0.01, currency: 'USD', marketTime: 5 } });
    expect(readQuotes(null)).toEqual({});
  });
  it('el PATCH reclama solo lo que nadie avisó en 24 h', () => {
    const p = claimPath(['x', 'y'], NOW);
    expect(p).toContain('id=in.(x,y)');
    expect(p).toContain('active=eq.true');
    expect(p).toContain(`last_triggered_at.lt."${new Date(NOW - COOLDOWN_MS).toISOString()}"`);
  });
});

describe('aviso push', () => {
  it('texto de respaldo en español y datos para el service worker; sin datos de la posición', () => {
    const p = buildAlertPayload(row(), { price: 251.236, changePct: 0.012, currency: 'USD' });
    expect(p.title).toBe('moyiq');
    expect(p.body).toBe('AAPL subió a 251,24. Tu nivel: 250.');
    expect(p.i18n).toEqual({ key: 'priceAlert', t: 'AAPL', cond: 'above', level: 250, price: 251.236, pct: 1.2, ccy: 'USD' });
    expect(p.url).toBe('/app/?open=invest-siguiendo');
    expect(p.tag).toBe('invest-alert-a1');
    expect(JSON.stringify(p)).not.toMatch(/user|u1|shares|cost/);
    expect(buildAlertPayload(row({ condition: 'below', threshold: 5000, symbol: 'SQM-B.SN' }), { price: 4990, currency: 'CLP' }).body).toBe('SQM-B.SN bajó a 4990 CLP. Tu nivel: 5000 CLP.');
    expect(buildAlertPayload(row({ condition: 'pct_move', threshold: 5 }), { price: 1, changePct: -0.0612 }).body).toBe('AAPL se movió -6,12 % hoy. Tu aviso: 5 % o más.');
  });
});

describe('runAlertsCheck (fetch simulado)', () => {
  function deps(over: Record<string, unknown> = {}) {
    const calls: { url: string; init?: RequestInit }[] = [];
    const alerts = [row(), row({ id: 'a2', user_id: 'u2', symbol: 'MSFT', condition: 'below', threshold: 300 }), row({ id: 'a3', symbol: 'SPY', threshold: 999 })];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes('/rest/v1/invest_alerts?select=')) return new Response(JSON.stringify(alerts), { status: 200 });
      if (url.startsWith('https://invest.test/api/quote')) return new Response(JSON.stringify({ AAPL: { price: 255, changePct: 0.01 }, MSFT: { price: 299 }, SPY: { price: 600 } }), { status: 200 });
      if (url.includes('/rest/v1/invest_alerts?id=in.')) return new Response(JSON.stringify([{ id: 'a1' }, { id: 'a2' }]), { status: 200 });
      if (url.endsWith('/rest/v1/rpc/invest_alert_push_targets')) return new Response(JSON.stringify([
        { user_id: 'u1', sub_id: 's1', endpoint: 'https://push/1', p256dh: 'p', auth: 'k' },
        { user_id: 'u1', sub_id: 's2', endpoint: 'https://push/2', p256dh: 'p', auth: 'k' },
      ]), { status: 200 });
      if (url.includes('/rest/v1/push_subscriptions?id=eq.')) return new Response(null, { status: 204 });
      return new Response('?', { status: 500 });
    });
    const sendPush = vi.fn(async (sub: { endpoint: string }) => new Response(null, { status: sub.endpoint.endsWith('/2') ? 410 : 201 }));
    return { calls, sendPush, d: { supabaseUrl: 'https://sb.test', serviceRole: 'sr', investApiUrl: 'https://invest.test', fetchImpl: fetchImpl as unknown as typeof fetch, sendPush, ...over } };
  }

  it('cotiza en lote, reclama, avisa a cada dispositivo y limpia suscripciones muertas', async () => {
    const { calls, sendPush, d } = deps();
    const r = await runAlertsCheck(d, NOW);
    expect(r).toMatchObject({ alerts: 3, symbols: 3, quoted: 3, due: 2, claimed: 2, sent: 1, noDevice: 1, removedSubs: 1, errors: 0 });
    const quoteCalls = calls.filter(c => c.url.startsWith('https://invest.test'));
    expect(quoteCalls).toHaveLength(1);
    expect(quoteCalls[0].url).toBe('https://invest.test/api/quote?ticker=AAPL,MSFT,SPY');
    const claim = calls.find(c => c.url.includes('invest_alerts?id=in.'))!;
    expect(claim.init?.method).toBe('PATCH');
    expect(JSON.parse(String(claim.init?.body))).toEqual({ last_triggered_at: new Date(NOW).toISOString() });
    expect(sendPush).toHaveBeenCalledTimes(2);
    expect(calls.some(c => c.url.endsWith('push_subscriptions?id=eq.s2') && c.init?.method === 'DELETE')).toBe(true);
    for (const c of calls.filter(c => c.url.startsWith('https://sb.test'))) expect((c.init?.headers as Record<string, string>).Authorization).toBe('Bearer sr');
  });

  it('en modo check solo cuenta: no marca ni avisa', async () => {
    const { calls, sendPush, d } = deps({ dryRun: true });
    const r = await runAlertsCheck(d, NOW);
    expect(r.due).toBe(2);
    expect(calls.some(c => c.init?.method === 'PATCH')).toBe(false);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('si la lista de alertas falla, lanza (el wrapper de errores la registra)', async () => {
    const d = { ...deps().d, fetchImpl: (async () => new Response('x', { status: 500 })) as unknown as typeof fetch };
    await expect(runAlertsCheck(d, NOW)).rejects.toThrow('invest_alerts 500');
  });
});
