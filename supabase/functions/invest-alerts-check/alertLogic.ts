// Lógica pura de invest-alerts-check (Inversiones F4, 20-nov-2026): quién puede
// llamarla, qué alertas se revisan, cuándo una alerta "suena" y qué aviso push
// se manda. index.ts solo cablea (Deno.env, fetch). Probado en alertLogic.test.ts,
// que también comprueba que la app (src/utils/investAlerts.js) decide igual.
import { secretEquals } from "../_shared/secretEquals.ts";

export type Condition = "above" | "below" | "pct_move";
export type AlertRow = {
  id: string;
  user_id: string;
  symbol: string;
  condition: Condition;
  threshold: number | string;
  last_triggered_at: string | null;
};
export type Quote = { price: number; changePct?: number | null; currency?: string | null; marketTime?: number | null };

export const COOLDOWN_MS = 24 * 3600 * 1000;
export const QUOTE_BATCH = 10; // /api/quote acepta hasta 10 símbolos por pedido
export const MAX_SYMBOLS = 400; // tope por corrida (40 pedidos a la API de Invest)
export const MAX_ALERTS = 5000;
export const SYMBOL_RE = /^[\^A-Z0-9.=-]{1,15}$/;
export const APP_URL = "/app/?open=invest-alertas"; // Siguiendo › Alertas (src/utils/investNav.js)
export const FETCH_TIMEOUT_MS = 8000; // cada pedido a la API de Invest y a cada servicio push
export const RUN_BUDGET_MS = 60000; // presupuesto de la corrida: después no se piden más precios ni se mandan más avisos

// Solo POST y solo con el secreto del cron (x-cron-secret = CRON_SECRET). Sin
// CORS: nadie la llama desde un navegador. OPTIONS responde 204 sin hacer nada.
export function guardAlertsRequest(
  method: string,
  cronSecretHeader: string | null,
  cronSecret: string | undefined,
): { status: number; error: string } | null {
  if (method === "OPTIONS") return { status: 204, error: "" };
  if (method !== "POST") return { status: 405, error: "method_not_allowed" };
  if (!secretEquals(cronSecretHeader, cronSecret)) return { status: 401, error: "unauthorized" };
  return null;
}

// Activas y fuera de la espera de 24 h, empezando por las que hace más que no
// se revisan (last_checked_at, migración 20261123000000): así ninguna cuenta
// ocupa siempre los primeros lugares ni las que están en espera llenan la fila.
export const activeAlertsPath = (now = Date.now(), limit = MAX_ALERTS) => {
  const since = new Date(now - COOLDOWN_MS).toISOString();
  return `invest_alerts?select=id,user_id,symbol,condition,threshold,last_triggered_at&active=eq.true` +
    `&or=(last_triggered_at.is.null,last_triggered_at.lt."${since}")` +
    `&order=last_checked_at.asc.nullsfirst,created_at.asc&limit=${limit}`;
};

const ts = (iso: string | null | undefined) => {
  const n = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(n) ? n : null;
};

// ¿Ya avisó en las últimas 24 h? Un movimiento del día (pct_move) además avisa
// una sola vez por sesión: si ya avisó después de la hora de esa cotización, no
// repite (de noche el cambio del día sigue siendo el de la sesión que cerró).
export function inCooldown(alert: Pick<AlertRow, "condition" | "last_triggered_at">, now: number, quote?: Quote | null): boolean {
  const last = ts(alert.last_triggered_at);
  if (last == null) return false;
  if (now - last < COOLDOWN_MS) return true;
  const mt = quote && Number(quote.marketTime) > 0 ? Number(quote.marketTime) * 1000 : null;
  return alert.condition === "pct_move" && mt != null && last >= mt;
}

// ¿Se cumple la condición con esta cotización? Nunca con un precio que falta.
export function conditionMet(condition: string, threshold: number, quote: Quote | null | undefined): boolean {
  const price = Number(quote?.price);
  const lvl = Number(threshold);
  if (!(price > 0) || !(lvl > 0)) return false;
  if (condition === "above") return price >= lvl;
  if (condition === "below") return price <= lvl;
  if (condition === "pct_move") {
    const pct = Number(quote?.changePct);
    return Number.isFinite(pct) && Math.abs(pct) * 100 >= lvl;
  }
  return false;
}

// Símbolos a cotizar: los de alertas que no están en espera, sin repetir y
// repartidos por cuenta (uno de cada cuenta por vuelta, en el orden de la
// lista) antes del tope: una cuenta con 50 símbolos no deja sin lugar a otras.
export function symbolsToQuote(alerts: AlertRow[], now: number, max = MAX_SYMBOLS): string[] {
  const byUser = new Map<string, string[]>();
  for (const a of alerts) {
    const s = String(a.symbol || "").toUpperCase();
    if (!SYMBOL_RE.test(s) || inCooldown(a, now)) continue;
    const list = byUser.get(a.user_id) ?? [];
    if (!list.includes(s)) list.push(s);
    byUser.set(a.user_id, list);
  }
  const queues = [...byUser.values()];
  const out = new Set<string>();
  for (let i = 0; out.size < max && queues.some(q => i < q.length); i++) {
    for (const q of queues) {
      if (i < q.length) out.add(q[i]);
      if (out.size >= max) break;
    }
  }
  return [...out];
}

export function quotePaths(symbols: string[], size = QUOTE_BATCH): string[] {
  const out: string[] = [];
  for (let i = 0; i < symbols.length; i += size) {
    out.push(`/api/quote?ticker=${symbols.slice(i, i + size).map(encodeURIComponent).join(",")}`);
  }
  return out;
}

// Respuesta de /api/quote → { SÍMBOLO: Quote } solo con precio válido.
export function readQuotes(json: unknown): Record<string, Quote> {
  const out: Record<string, Quote> = {};
  if (!json || typeof json !== "object") return out;
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    if (k === "_errors" || !v || typeof v !== "object") continue;
    const q = v as Record<string, unknown>;
    const price = Number(q.price);
    if (!(price > 0)) continue;
    out[k.toUpperCase()] = {
      price,
      changePct: Number.isFinite(Number(q.changePct)) ? Number(q.changePct) : null,
      currency: typeof q.currency === "string" ? q.currency : null,
      marketTime: Number(q.marketTime) > 0 ? Number(q.marketTime) : null,
    };
  }
  return out;
}

// Alertas que suenan ahora.
export function dueAlerts(alerts: AlertRow[], quotes: Record<string, Quote>, now: number): { alert: AlertRow; quote: Quote }[] {
  const out: { alert: AlertRow; quote: Quote }[] = [];
  for (const a of alerts) {
    const q = quotes[String(a.symbol || "").toUpperCase()];
    if (!q || inCooldown(a, now, q)) continue;
    if (conditionMet(a.condition, Number(a.threshold), q)) out.push({ alert: a, quote: q });
  }
  return out;
}

// PATCH que marca el aviso SOLO si nadie lo marcó en las últimas 24 h: si dos
// corridas se cruzan, la segunda no reclama nada y no hay aviso doble.
export function claimPath(ids: string[], now: number): string {
  const since = new Date(now - COOLDOWN_MS).toISOString();
  return `invest_alerts?id=in.(${ids.join(",")})&active=eq.true&or=(last_triggered_at.is.null,last_triggered_at.lt."${since}")&select=id`;
}

// PATCH que devuelve un reclamo que no llegó a ningún dispositivo (red, 5xx o
// sin tiempo): solo si la marca sigue siendo la de esta corrida.
export function unclaimPath(ids: string[], now: number): string {
  return `invest_alerts?id=in.(${ids.join(",")})&last_triggered_at=eq."${new Date(now).toISOString()}"`;
}

// Alertas revisadas en esta corrida: las de los símbolos que se pidieron
// (tuvieran precio o no). Las demás siguen primeras en la fila.
export function checkedIds(alerts: AlertRow[], symbols: string[]): string[] {
  const set = new Set(symbols);
  return alerts.filter(a => set.has(String(a.symbol || "").toUpperCase())).map(a => a.id);
}

// Un envío que se puede reintentar (no llegó por la red o el servicio push
// falló): 429 y 5xx. Un 4xx distinto de 404/410 no se arregla reintentando.
export const retryableStatus = (status: number) => status === 429 || status >= 500;

const round = (n: number) => Math.round(n * 10000) / 10000;

// Aviso push. El texto lo arma el service worker en el idioma del navegador
// (public/push-sw.js, clave priceAlert); `body` es el respaldo en español.
// Lleva el símbolo y los precios (datos de mercado públicos), nunca posiciones.
export function buildAlertPayload(alert: AlertRow, quote: Quote) {
  const t = String(alert.symbol).toUpperCase();
  const level = round(Number(alert.threshold));
  const price = round(quote.price);
  const pct = Number.isFinite(Number(quote.changePct)) ? round(Number(quote.changePct) * 100) : null;
  const ccy = quote.currency && quote.currency !== "USD" ? ` ${quote.currency}` : "";
  const es = (n: number) => n.toLocaleString("es", { maximumFractionDigits: 2 });
  let body: string;
  if (alert.condition === "above") body = `${t} subió a ${es(price)}${ccy}. Tu nivel: ${es(level)}${ccy}.`;
  else if (alert.condition === "below") body = `${t} bajó a ${es(price)}${ccy}. Tu nivel: ${es(level)}${ccy}.`;
  else body = `${t} se movió ${es(pct ?? 0)} % hoy. Tu aviso: ${es(level)} % o más.`;
  return {
    title: "moyiq",
    body,
    i18n: { key: "priceAlert", t, cond: alert.condition, level, price, pct, ccy: quote.currency || "USD" },
    url: APP_URL,
    tag: `invest-alert-${alert.id}`,
  };
}

// ── Corrida completa (index.ts le pasa Deno.env y fetch) ─────────────
export type RunDeps = {
  supabaseUrl: string;
  serviceRole: string;
  investApiUrl: string; // https://invest.moyiq.app (los mismos endpoints que usa la app)
  fetchImpl: typeof fetch;
  sendPush: (sub: { endpoint: string; p256dh: string; auth: string }, payload: unknown) => Promise<Response>;
  dryRun?: boolean; // solo cuenta: no marca alertas ni manda avisos
  clock?: () => number; // para el presupuesto de la corrida (tests)
  budgetMs?: number;
  timeoutMs?: number;
};
type Target = { user_id: string; sub_id: string; endpoint: string; p256dh: string; auth: string };

const timeoutSignal = (ms: number) => (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(ms) : undefined);

export async function runAlertsCheck(d: RunDeps, now = Date.now()) {
  const clock = d.clock ?? Date.now;
  const started = clock();
  const budget = d.budgetMs ?? RUN_BUDGET_MS;
  const outOfTime = () => clock() - started > budget;
  const timeoutMs = d.timeoutMs ?? FETCH_TIMEOUT_MS;
  const sb = (path: string, init: RequestInit = {}) => d.fetchImpl(`${d.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: d.serviceRole,
      Authorization: `Bearer ${d.serviceRole}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  const res = {
    alerts: 0, symbols: 0, quoted: 0, checked: 0, due: 0, claimed: 0, sent: 0, noDevice: 0,
    removedSubs: 0, released: 0, outOfTime: false, errors: 0,
  };

  const listRes = await sb(activeAlertsPath(now));
  if (!listRes.ok) throw new Error(`invest_alerts ${listRes.status}`);
  const alerts = (await listRes.json()) as AlertRow[];
  res.alerts = alerts.length;
  const symbols = symbolsToQuote(alerts, now);
  res.symbols = symbols.length;
  if (!symbols.length) return res;

  // Precios en lotes de 10, sin Origin (pedido de servidor: la API lo acepta).
  const quotes: Record<string, Quote> = {};
  const asked: string[] = [];
  const paths = quotePaths(symbols);
  for (let i = 0; i < paths.length; i++) {
    if (outOfTime()) { res.outOfTime = true; break; }
    asked.push(...symbols.slice(i * QUOTE_BATCH, (i + 1) * QUOTE_BATCH));
    try {
      const r = await d.fetchImpl(`${d.investApiUrl}${paths[i]}`, { headers: { Accept: "application/json" }, signal: timeoutSignal(timeoutMs) });
      if (r.ok) Object.assign(quotes, readQuotes(await r.json()));
      else if (r.status !== 404) res.errors++; // 404 = ningún símbolo del lote tiene precio
    } catch { res.errors++; }
  }
  res.quoted = Object.keys(quotes).length;

  const due = dueAlerts(alerts, quotes, now);
  res.due = due.length;
  if (d.dryRun) return res;

  // Rotación: las revisadas pasan al final de la fila (también las sin precio).
  const checked = checkedIds(alerts, asked);
  if (checked.length) {
    const mRes = await sb("rpc/invest_alerts_mark_checked", { method: "POST", body: JSON.stringify({ p_ids: checked, p_at: new Date(now).toISOString() }) });
    if (mRes.ok) res.checked = checked.length;
    else res.errors++;
  }
  if (!due.length) return res;

  // A quién avisar, ANTES de reclamar: si esto falla no se marca nada y la
  // próxima corrida lo vuelve a intentar (el wrapper registra el error).
  const users = [...new Set(due.map(x => x.alert.user_id))];
  const tRes = await sb("rpc/invest_alert_push_targets", { method: "POST", body: JSON.stringify({ p_user_ids: users }) });
  if (!tRes.ok) throw new Error(`invest_alert_push_targets ${tRes.status}`);
  const targets = (await tRes.json()) as Target[];
  const byUser = new Map<string, Target[]>();
  for (const t of targets) byUser.set(t.user_id, [...(byUser.get(t.user_id) || []), t]);

  const claimRes = await sb(claimPath(due.map(x => x.alert.id), now), {
    method: "PATCH",
    body: JSON.stringify({ last_triggered_at: new Date(now).toISOString() }),
  });
  if (!claimRes.ok) throw new Error(`claim ${claimRes.status}`);
  const claimedIds = new Set(((await claimRes.json()) as { id: string }[]).map(r => r.id));
  const claimed = due.filter(x => claimedIds.has(x.alert.id));
  res.claimed = claimed.length;
  if (!claimed.length) return res;

  const dead = new Set<string>();
  // Reclamos que no llegaron a ningún dispositivo por un fallo que se puede
  // reintentar (o por falta de tiempo): se devuelven a su valor anterior.
  const release = new Map<string, string[]>(); // last_triggered_at anterior ('' = null) → ids
  const toRelease = (a: AlertRow) => {
    const k = a.last_triggered_at ?? "";
    release.set(k, [...(release.get(k) || []), a.id]);
  };
  for (const { alert, quote } of claimed) {
    const subs = (byUser.get(alert.user_id) || []).filter(s => !dead.has(s.sub_id));
    if (!subs.length) { res.noDevice++; continue; } // sin dispositivo: queda marcada (no hay a quién avisar)
    if (outOfTime()) { res.outOfTime = true; toRelease(alert); continue; }
    const payload = buildAlertPayload(alert, quote);
    let delivered = false, retry = false;
    for (const s of subs) {
      try {
        const r = await d.sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload);
        if (r.status === 404 || r.status === 410) {
          // Suscripción muerta (desinstaló o quitó el permiso): se limpia, como send-push.
          dead.add(s.sub_id);
          await sb(`push_subscriptions?id=eq.${s.sub_id}`, { method: "DELETE" });
          res.removedSubs++;
        } else if (r.ok) { res.sent++; delivered = true; }
        else { res.errors++; if (retryableStatus(r.status)) retry = true; }
      } catch { res.errors++; retry = true; }
    }
    if (!delivered && retry) toRelease(alert);
  }

  for (const [prev, ids] of release) {
    try {
      const r = await sb(unclaimPath(ids, now), { method: "PATCH", body: JSON.stringify({ last_triggered_at: prev || null }) });
      if (r.ok) res.released += ids.length;
      else res.errors++;
    } catch { res.errors++; }
  }
  return res;
}
