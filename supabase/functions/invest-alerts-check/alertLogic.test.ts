import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  COOLDOWN_MS, activeAlertsPath, buildAlertPayload, checkedIds, chunks, conditionMet, dueAlerts, guardAlertsRequest, inCooldown,
  pushOutcome, quotePaths, readIdList, readQuotes, runAlertsCheck, runFailed, symbolsToQuote, type AlertRow,
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
  it('las RPC van en tandas y leen la lista de ids que devuelve PostgREST', () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunks([], 2)).toEqual([]);
    expect(readIdList(['a', 'b'])).toEqual(['a', 'b']);
    expect(readIdList([{ invest_alerts_claim: 'a' }])).toEqual(['a']);
    expect(readIdList(null)).toEqual([]);
  });
});

describe('rotación entre cuentas', () => {
  it('la lista sale sin las que están en espera y empieza por las menos revisadas', () => {
    const p = activeAlertsPath(NOW);
    expect(p).toContain('active=eq.true');
    expect(p).toContain(`last_triggered_at.lt."${new Date(NOW - COOLDOWN_MS).toISOString()}"`);
    expect(p).toContain('order=last_checked_at.asc.nullsfirst,created_at.asc');
  });
  it('reparte los símbolos por cuenta antes del tope', () => {
    const heavy = Array.from({ length: 50 }, (_, i) => row({ id: `h${i}`, user_id: 'old', symbol: `ZZZZ${i}` }));
    const others = [row({ id: 'n1', user_id: 'new1', symbol: 'AAPL' }), row({ id: 'n2', user_id: 'new2', symbol: 'MSFT' })];
    const out = symbolsToQuote([...heavy, ...others], NOW, 4);
    expect(out).toEqual(['ZZZZ0', 'AAPL', 'MSFT', 'ZZZZ1']);
    expect(symbolsToQuote([...heavy, ...others], NOW)).toHaveLength(52);
  });
  it('revisadas = las de los símbolos pedidos, tengan precio o no', () => {
    expect(checkedIds([row(), row({ id: 'b', symbol: 'ZZZZ1' }), row({ id: 'c', symbol: 'SPY' })], ['AAPL', 'ZZZZ1'])).toEqual(['a1', 'b']);
  });
});

describe('aviso push', () => {
  it('texto de respaldo en español y datos para el service worker; sin datos de la posición', () => {
    const p = buildAlertPayload(row(), { price: 251.236, changePct: 0.012, currency: 'USD' });
    expect(p.title).toBe('moyiq');
    expect(p.body).toBe('AAPL subió a 251,24. Tu nivel: 250.');
    expect(p.i18n).toEqual({ key: 'priceAlert', t: 'AAPL', cond: 'above', level: 250, price: 251.236, pct: 1.2, ccy: 'USD' });
    expect(p.url).toBe('/app/?open=invest-alertas');
    expect(p.tag).toBe('invest-alert-a1');
    expect(JSON.stringify(p)).not.toMatch(/user|u1|shares|cost/);
    expect(buildAlertPayload(row({ condition: 'below', threshold: 5000, symbol: 'SQM-B.SN' }), { price: 4990, currency: 'CLP' }).body).toBe('SQM-B.SN bajó a 4990 CLP. Tu nivel: 5000 CLP.');
    expect(buildAlertPayload(row({ condition: 'pct_move', threshold: 5 }), { price: 1, changePct: -0.0612 }).body).toBe('AAPL se movió -6,12 % hoy. Tu aviso: 5 % o más.');
  });
});

describe('qué hacer con cada respuesta push', () => {
  it('ok / borrar ya / borrar al final / reintentar / fallo', () => {
    expect(pushOutcome(201)).toBe('ok');
    expect(pushOutcome(404)).toBe('gone');
    expect(pushOutcome(410)).toBe('gone');
    expect(pushOutcome(400)).toBe('invalid');
    expect(pushOutcome(403)).toBe('invalid');
    expect(pushOutcome(429)).toBe('retry');
    expect(pushOutcome(503)).toBe('retry');
    expect(pushOutcome(413)).toBe('fail');
  });
  it('la corrida falla por errores del sistema o por mayoría de envíos fallidos, no por un dispositivo', () => {
    expect(runFailed({ errors: 0, pushAttempts: 1, pushFailed: 1 })).toBe(false);
    expect(runFailed({ errors: 0, pushAttempts: 20, pushFailed: 3 })).toBe(false);
    expect(runFailed({ errors: 0, pushAttempts: 20, pushFailed: 11 })).toBe(true);
    expect(runFailed({ errors: 1, pushAttempts: 0, pushFailed: 0 })).toBe(true);
  });
});

describe('runAlertsCheck (fetch simulado)', () => {
  type Over = Record<string, unknown> & { alerts?: AlertRow[] };
  function deps(over: Over = {}, route: (url: string, init?: RequestInit) => Response | null = () => null) {
    const calls: { url: string; init?: RequestInit }[] = [];
    const alerts = over.alerts ?? [row(), row({ id: 'a2', user_id: 'u2', symbol: 'MSFT', condition: 'below', threshold: 300 }), row({ id: 'a3', symbol: 'SPY', threshold: 999 })];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const custom = route(url, init);
      if (custom) return custom;
      if (url.includes('/rest/v1/invest_alerts?select=')) return new Response(JSON.stringify(alerts), { status: 200 });
      if (url.startsWith('https://invest.test/api/quote')) return new Response(JSON.stringify({ AAPL: { price: 255, changePct: 0.01 }, MSFT: { price: 299 }, SPY: { price: 600 } }), { status: 200 });
      if (url.endsWith('/rest/v1/rpc/invest_alerts_claim')) return new Response(JSON.stringify(JSON.parse(String(init?.body)).p_ids), { status: 200 });
      if (url.endsWith('/rest/v1/rpc/invest_alerts_release')) return new Response('1', { status: 200 });
      if (url.endsWith('/rest/v1/rpc/invest_alerts_mark_checked')) return new Response('3', { status: 200 });
      if (url.endsWith('/rest/v1/rpc/invest_alert_push_targets')) return new Response(JSON.stringify([
        { user_id: 'u1', sub_id: 's1', endpoint: 'https://push/1', p256dh: 'p', auth: 'k' },
        { user_id: 'u1', sub_id: 's2', endpoint: 'https://push/2', p256dh: 'p', auth: 'k' },
      ]), { status: 200 });
      if (url.includes('/rest/v1/push_subscriptions?id=')) return new Response(null, { status: 204 });
      return new Response('?', { status: 500 });
    });
    const sendPush = vi.fn(async (sub: { endpoint: string }) => new Response(null, { status: sub.endpoint.endsWith('/2') ? 410 : 201 }));
    const { alerts: _a, ...rest } = over;
    return { calls, sendPush, d: { supabaseUrl: 'https://sb.test', serviceRole: 'sr', investApiUrl: 'https://invest.test', fetchImpl: fetchImpl as unknown as typeof fetch, sendPush, ...rest } };
  }
  const body = (c: { init?: RequestInit }) => JSON.parse(String(c.init?.body));
  const rpcCalls = (calls: { url: string }[], name: string) => calls.filter(c => c.url.endsWith(`/rpc/${name}`));

  it('cotiza en lote, reclama por RPC, avisa a cada dispositivo y limpia suscripciones muertas', async () => {
    const { calls, sendPush, d } = deps();
    const r = await runAlertsCheck(d, NOW);
    expect(r).toMatchObject({ alerts: 3, symbols: 3, quoted: 3, checked: 3, due: 2, claimed: 2, sent: 1, noDevice: 1, removedSubs: 1, released: 0, errors: 0 });
    expect(runFailed(r)).toBe(false);
    const quoteCalls = calls.filter(c => c.url.startsWith('https://invest.test'));
    expect(quoteCalls).toHaveLength(1);
    expect(quoteCalls[0].url).toBe('https://invest.test/api/quote?ticker=AAPL,MSFT,SPY');
    const [claim] = rpcCalls(calls, 'invest_alerts_claim');
    expect(claim.init?.method).toBe('POST');
    expect(body(claim)).toEqual({ p_ids: ['a1', 'a2'], p_at: new Date(NOW).toISOString() });
    expect(calls.some(c => c.init?.method === 'PATCH')).toBe(false); // ningún id en la URL
    expect(sendPush).toHaveBeenCalledTimes(2);
    expect(calls.some(c => c.url.endsWith('push_subscriptions?id=eq.s2') && c.init?.method === 'DELETE')).toBe(true);
    for (const c of calls.filter(c => c.url.startsWith('https://sb.test'))) expect((c.init?.headers as Record<string, string>).Authorization).toBe('Bearer sr');
  });

  it('cientos de alertas: reclamo y rotación en tandas por el cuerpo, nunca en la URL', async () => {
    const alerts = Array.from({ length: 1200 }, (_, i) => row({ id: `id-${i}`, user_id: `u${i % 30}`, symbol: 'AAPL', threshold: 1 }));
    const { calls, d } = deps({ alerts });
    const r = await runAlertsCheck(d, NOW);
    expect(r).toMatchObject({ due: 1200, claimed: 1200, checked: 1200 });
    expect(rpcCalls(calls, 'invest_alerts_claim').map(c => body(c).p_ids.length)).toEqual([500, 500, 200]);
    expect(rpcCalls(calls, 'invest_alerts_mark_checked')).toHaveLength(3);
    for (const c of calls) expect(c.url.length).toBeLessThan(600);
  });

  it('una tanda de reclamo que falla no corta las demás', async () => {
    let n = 0;
    const alerts = Array.from({ length: 600 }, (_, i) => row({ id: `id-${i}`, user_id: 'u1', symbol: 'AAPL', threshold: 1 }));
    const { d } = deps({ alerts, sendPush: vi.fn(async () => new Response(null, { status: 201 })) }, (url) => (url.endsWith('/rpc/invest_alerts_claim') && n++ === 0 ? new Response('x', { status: 500 }) : null));
    const r = await runAlertsCheck(d, NOW);
    expect(r.claimed).toBe(100);
    expect(r.errors).toBe(1);
  });

  it('en modo check solo cuenta: no marca ni avisa', async () => {
    const { calls, sendPush, d } = deps({ dryRun: true });
    const r = await runAlertsCheck(d, NOW);
    expect(r.due).toBe(2);
    expect(calls.some(c => c.url.includes('/rpc/'))).toBe(false);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('pide los destinos ANTES de reclamar; si fallan, lanza y no marca nada', async () => {
    const { calls, sendPush, d } = deps({}, (url) => (url.endsWith('/rpc/invest_alert_push_targets') ? new Response('x', { status: 503 }) : null));
    await expect(runAlertsCheck(d, NOW)).rejects.toThrow('invest_alert_push_targets 503');
    expect(rpcCalls(calls, 'invest_alerts_claim')).toHaveLength(0);
    expect(sendPush).not.toHaveBeenCalled();
    const ok = deps();
    await runAlertsCheck(ok.d, NOW);
    const iT = ok.calls.findIndex(c => c.url.endsWith('/rpc/invest_alert_push_targets'));
    const iC = ok.calls.findIndex(c => c.url.endsWith('/rpc/invest_alerts_claim'));
    expect(iT).toBeGreaterThan(-1);
    expect(iT).toBeLessThan(iC);
  });

  it('un aviso que no llegó por la red o un 5xx se devuelve; uno sin dispositivo, no', async () => {
    const { calls, d } = deps({ sendPush: vi.fn(async () => { throw new Error('net') }) });
    const r = await runAlertsCheck(d, NOW);
    expect(r).toMatchObject({ claimed: 2, sent: 0, noDevice: 1, released: 1 });
    const [rel] = rpcCalls(calls, 'invest_alerts_release');
    expect(body(rel)).toEqual({ p_ids: ['a1'], p_prev: [null], p_at: new Date(NOW).toISOString() });
  });

  it('un 5xx del servicio push devuelve el reclamo a su valor anterior; un 201 en otro dispositivo, no', async () => {
    const prev = new Date(NOW - 2 * COOLDOWN_MS).toISOString();
    const alerts = [row({ last_triggered_at: prev })];
    const five = deps({ alerts, sendPush: vi.fn(async () => new Response(null, { status: 503 })) });
    const r = await runAlertsCheck(five.d, NOW);
    expect(r.released).toBe(1);
    expect(body(rpcCalls(five.calls, 'invest_alerts_release')[0]).p_prev).toEqual([prev]);
    const mixed = deps({ alerts, sendPush: vi.fn(async (sub: { endpoint: string }) => new Response(null, { status: sub.endpoint.endsWith('/1') ? 201 : 503 })) });
    const r2 = await runAlertsCheck(mixed.d, NOW);
    expect(r2).toMatchObject({ sent: 1, released: 0 });
    expect(runFailed(r2)).toBe(false);
  });

  it('un 400/403 de un dispositivo borra la suscripción sin alarma', async () => {
    const { calls, d } = deps({ sendPush: vi.fn(async (sub: { endpoint: string }) => new Response(null, { status: sub.endpoint.endsWith('/2') ? 403 : 201 })) });
    const r = await runAlertsCheck(d, NOW);
    expect(r).toMatchObject({ sent: 1, invalidSubs: 1, removedSubs: 1, errors: 0, pushSystemic: false });
    expect(runFailed(r)).toBe(false);
    expect(calls.some(c => c.url.endsWith('push_subscriptions?id=in.(s2)') && c.init?.method === 'DELETE')).toBe(true);
  });

  it('si TODOS los envíos dan 403 (clave VAPID del servidor), no borra nada, devuelve los avisos y avisa', async () => {
    const alerts = ['u1', 'u2', 'u3'].map((u, i) => row({ id: `v${i}`, user_id: u }));
    const targets = ['u1', 'u2', 'u3'].map((u, i) => ({ user_id: u, sub_id: `s${i}`, endpoint: `https://push/${i}`, p256dh: 'p', auth: 'k' }));
    const { calls, d } = deps({ alerts, sendPush: vi.fn(async () => new Response(null, { status: 403 })) },
      (url) => (url.endsWith('/rpc/invest_alert_push_targets') ? new Response(JSON.stringify(targets), { status: 200 }) : null));
    const r = await runAlertsCheck(d, NOW);
    expect(r).toMatchObject({ sent: 0, invalidSubs: 3, removedSubs: 0, pushSystemic: true, released: 3 });
    expect(runFailed(r)).toBe(true);
    expect(calls.some(c => c.init?.method === 'DELETE')).toBe(false);
  });

  it('precios y envíos tienen presupuestos separados: lo reclamado se manda aunque los precios hayan tardado', async () => {
    let t = 0;
    const slow = deps({ clock: () => t, quoteBudgetMs: 35000, sendBudgetMs: 40000 }, (url) => {
      if (url.startsWith('https://invest.test')) t += 34000; // precios lentos, casi todo su tramo
      return null;
    });
    const r = await runAlertsCheck(slow.d, NOW);
    expect(r).toMatchObject({ claimed: 2, sent: 1, released: 0, outOfTime: false, errors: 0 });
  });

  it('sin tiempo para precios no se empiezan más lotes: esos símbolos no cuentan como revisados y queda registrado', async () => {
    let t = 0;
    const alerts = Array.from({ length: 30 }, (_, i) => row({ id: `q${i}`, user_id: `u${i}`, symbol: `T${i}` }));
    const { calls, d } = deps({ alerts, clock: () => t, quoteBudgetMs: 1000 }, (url) => {
      if (url.startsWith('https://invest.test')) { queueMicrotask(() => { t += 5000; }); return new Response('{}', { status: 200 }); }
      return null;
    });
    const r = await runAlertsCheck(d, NOW);
    // 30 símbolos = 3 lotes: entran todos en la primera vuelta (4 a la vez).
    expect(calls.filter(c => c.url.startsWith('https://invest.test'))).toHaveLength(3);
    expect(r.quoteSkipped).toBe(0);
    const many = Array.from({ length: 80 }, (_, i) => row({ id: `m${i}`, user_id: `u${i}`, symbol: `M${i}` }));
    t = 0;
    const big = deps({ alerts: many, clock: () => t, quoteBudgetMs: 1000 }, (url) => {
      if (url.startsWith('https://invest.test')) { queueMicrotask(() => { t += 5000; }); return new Response('{}', { status: 200 }); }
      return null;
    });
    const r2 = await runAlertsCheck(big.d, NOW);
    expect(big.calls.filter(c => c.url.startsWith('https://invest.test'))).toHaveLength(4);
    expect(r2).toMatchObject({ quoteSkipped: 40, outOfTime: true, checked: 40 });
    expect(runFailed(r2)).toBe(true);
  });

  it('sin tiempo para enviar, devuelve lo pendiente y queda registrado', async () => {
    let t = 0;
    const { sendPush, d } = deps({ clock: () => (t += 1000), sendBudgetMs: 500 });
    const r = await runAlertsCheck(d, NOW);
    expect(r.outOfTime).toBe(true);
    expect(sendPush).not.toHaveBeenCalled();
    expect(r.released).toBe(1);
    expect(runFailed(r)).toBe(true);
  });

  it('marca como revisadas las alertas de los símbolos pedidos (rotación)', async () => {
    const { calls, d } = deps();
    await runAlertsCheck(d, NOW);
    const [mark] = rpcCalls(calls, 'invest_alerts_mark_checked');
    expect(body(mark)).toEqual({ p_ids: ['a1', 'a2', 'a3'], p_at: new Date(NOW).toISOString() });
    expect(calls[0].url).toContain('order=last_checked_at.asc.nullsfirst');
  });

  it('index.ts responde 5xx según runFailed y corta los envíos push con timeout', () => {
    const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/const failed = runFailed\(result\)/);
    expect(src).toMatch(/failed \? 502 : 200/);
    expect(src).toMatch(/sendWebPush\(sub, payload, vapid, fetch, FETCH_TIMEOUT_MS\)/);
  });

  it('si la lista de alertas falla, lanza (el wrapper de errores la registra)', async () => {
    const d = { ...deps().d, fetchImpl: (async () => new Response('x', { status: 500 })) as unknown as typeof fetch };
    await expect(runAlertsCheck(d, NOW)).rejects.toThrow('invest_alerts 500');
  });
});
