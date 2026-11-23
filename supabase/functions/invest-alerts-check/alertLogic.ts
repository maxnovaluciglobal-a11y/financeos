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
// Presupuestos separados: los precios no se comen el tiempo de los envíos. Lo
// reclamado tiene siempre su propio tramo para mandarse (o devolverse).
export const QUOTE_BUDGET_MS = 35000; // después no se piden más lotes de precios
export const SEND_BUDGET_MS = 40000; // contado desde el primer envío
export const QUOTE_CONCURRENCY = 4; // lotes de precios en paralelo (40 lotes ≈ 10 vueltas)
export const SEND_CONCURRENCY = 4; // cuentas atendidas en paralelo
export const RPC_BATCH = 500; // ids por llamada a las RPC (van en el cuerpo, no en la URL)
export const MAX_SUBS_PER_USER = 5; // dispositivos por cuenta (invest_alert_push_targets ya devuelve 5)

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

// Partir una lista en tandas (RPC de reclamo, devolución y rotación).
export function chunks<T>(list: T[], size = RPC_BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// Respuesta de una RPC `returns setof uuid`: PostgREST la manda como lista de
// valores (["…"]) o, según la versión, como objetos { invest_alerts_claim: "…" }.
export function readIdList(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.map(v => (typeof v === "string" ? v : v && typeof v === "object" ? String(Object.values(v)[0] ?? "") : "")).filter(Boolean);
}

// Alertas revisadas en esta corrida: las de los símbolos que se pidieron
// (tuvieran precio o no). Las demás siguen primeras en la fila.
export function checkedIds(alerts: AlertRow[], symbols: string[]): string[] {
  const set = new Set(symbols);
  return alerts.filter(a => set.has(String(a.symbol || "").toUpperCase())).map(a => a.id);
}

// Qué hacer con la respuesta del servicio push para UN dispositivo:
//  · ok: llegó.
//  · gone (404/410): la suscripción ya no existe; se borra al final de la corrida.
//  · invalid (400/403): token inválido o firmado con otra clave VAPID. Suma un
//    fallo; si en ese servicio push nada llegó, suena la alarma (puede ser la
//    clave del servidor) y el aviso se devuelve.
//  · retry (429/5xx o red): se puede reintentar; el aviso se devuelve y suma un fallo.
//  · fail: cualquier otro 4xx; suma un fallo.
export type PushOutcome = "ok" | "gone" | "invalid" | "retry" | "fail";
export function pushOutcome(status: number): PushOutcome {
  if (status >= 200 && status < 300) return "ok";
  if (status === 404 || status === 410) return "gone";
  if (status === 400 || status === 403) return "invalid";
  if (status === 429 || status >= 500) return "retry";
  return "fail";
}
export const retryableStatus = (status: number) => pushOutcome(status) === "retry";

// Servicio push de un endpoint (para decidir si un 400/403 es del servidor).
export function pushHost(endpoint: string): string {
  try { return new URL(endpoint).host.toLowerCase(); } catch { return "?"; }
}

// ¿La corrida falló? Solo por errores del sistema (lista, precios, RPC,
// reclamo, devolución, falta de tiempo) o si fallan más de la mitad de los
// envíos (con al menos 10). Un dispositivo roto de una persona no dispara la
// alarma de uptime cada 15 minutos.
export const PUSH_FAIL_MIN = 10;
export function runFailed(r: { errors: number; pushAttempts: number; pushFailed: number }): boolean {
  return r.errors > 0 || (r.pushAttempts >= PUSH_FAIL_MIN && r.pushFailed / r.pushAttempts > 0.5);
}

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
  clock?: () => number; // para los presupuestos (tests)
  quoteBudgetMs?: number;
  sendBudgetMs?: number;
  timeoutMs?: number;
};
type Target = { user_id: string; sub_id: string; endpoint: string; p256dh: string; auth: string };

const timeoutSignal = (ms: number) => (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(ms) : undefined);

// Corre `work` sobre `items` con a lo sumo `n` a la vez.
async function pool<T>(items: T[], n: number, work: (item: T, i: number) => Promise<void>) {
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; await work(items[i], i); } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

export async function runAlertsCheck(d: RunDeps, now = Date.now()) {
  const clock = d.clock ?? Date.now;
  const started = clock();
  const quoteBudget = d.quoteBudgetMs ?? QUOTE_BUDGET_MS;
  const sendBudget = d.sendBudgetMs ?? SEND_BUDGET_MS;
  const timeoutMs = d.timeoutMs ?? FETCH_TIMEOUT_MS;
  const at = new Date(now).toISOString();
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
  const rpc = (name: string, body: unknown) => sb(`rpc/${name}`, { method: "POST", body: JSON.stringify(body) });
  const res = {
    alerts: 0, symbols: 0, quoted: 0, quoteSkipped: 0, checked: 0, due: 0, claimed: 0, sent: 0, noDevice: 0,
    pushAttempts: 0, pushFailed: 0, removedSubs: 0, invalidSubs: 0, pushSystemic: false, released: 0, outOfTime: false, errors: 0,
  };

  const listRes = await sb(activeAlertsPath(now));
  if (!listRes.ok) throw new Error(`invest_alerts ${listRes.status}`);
  const alerts = (await listRes.json()) as AlertRow[];
  res.alerts = alerts.length;
  const symbols = symbolsToQuote(alerts, now);
  res.symbols = symbols.length;
  if (!symbols.length) return res;

  // Precios en lotes de 10, QUOTE_CONCURRENCY a la vez, sin Origin (pedido de
  // servidor: la API lo acepta). Sin tiempo no se empiezan más lotes: esos
  // símbolos no cuentan como revisados y siguen primeros en la fila.
  const quotes: Record<string, Quote> = {};
  const asked: string[] = [];
  const batches = chunks(symbols, QUOTE_BATCH);
  const paths = quotePaths(symbols);
  await pool(paths, QUOTE_CONCURRENCY, async (path, i) => {
    if (clock() - started > quoteBudget) { res.outOfTime = true; return; }
    asked.push(...batches[i]);
    try {
      const r = await d.fetchImpl(`${d.investApiUrl}${path}`, { headers: { Accept: "application/json" }, signal: timeoutSignal(timeoutMs) });
      if (r.ok) Object.assign(quotes, readQuotes(await r.json()));
      else if (r.status !== 404) res.errors++; // 404 = ningún símbolo del lote tiene precio
    } catch { res.errors++; }
  });
  res.quoted = Object.keys(quotes).length;
  res.quoteSkipped = symbols.length - asked.length;
  if (res.quoteSkipped > 0) res.errors++; // sin tiempo para todos los precios: queda registrado

  const askedSet = new Set(asked);
  const due = dueAlerts(alerts.filter(a => askedSet.has(String(a.symbol || "").toUpperCase())), quotes, now);
  res.due = due.length;
  if (d.dryRun) return res;

  // Rotación: las revisadas pasan al final de la fila (también las sin precio).
  for (const ids of chunks(checkedIds(alerts, asked))) {
    try {
      const mRes = await rpc("invest_alerts_mark_checked", { p_ids: ids, p_at: at });
      if (mRes.ok) res.checked += ids.length;
      else res.errors++;
    } catch { res.errors++; }
  }
  if (!due.length) return res;

  // A quién avisar, ANTES de reclamar: si esto falla no se marca nada y la
  // próxima corrida lo vuelve a intentar (el wrapper registra el error).
  const users = [...new Set(due.map(x => x.alert.user_id))];
  const tRes = await rpc("invest_alert_push_targets", { p_user_ids: users });
  if (!tRes.ok) throw new Error(`invest_alert_push_targets ${tRes.status}`);
  const targets = (await tRes.json()) as Target[];
  const subsOf = new Map<string, Target[]>();
  for (const t of targets) subsOf.set(t.user_id, [...(subsOf.get(t.user_id) || []), t]);

  // Reclamo por RPC, en tandas: solo lo que nadie avisó en 24 h (si dos
  // corridas se cruzan, la segunda no reclama nada y no hay aviso doble). Una
  // tanda que falla no corta las demás.
  const claimedIds = new Set<string>();
  for (const ids of chunks(due.map(x => x.alert.id))) {
    try {
      const cRes = await rpc("invest_alerts_claim", { p_ids: ids, p_at: at });
      if (!cRes.ok) { res.errors++; continue; }
      for (const id of readIdList(await cRes.json())) claimedIds.add(id);
    } catch { res.errors++; }
  }
  const claimed = due.filter(x => claimedIds.has(x.alert.id));
  res.claimed = claimed.length;
  if (!claimed.length) return res;

  // Resultado de cada dispositivo en esta corrida. A uno que respondió bien se
  // le manda cada alerta; uno que ya falló (o ya no existe) no se vuelve a
  // llamar: las alertas siguientes de la cuenta reusan ese resultado.
  const failedSubs = new Map<string, Exclude<PushOutcome, "ok">>();
  const okSubs = new Set<string>();
  const okHosts = new Set<string>(); // servicios push con al menos un envío que llegó
  const invalidHosts = new Set<string>(); // servicios push con algún 400/403
  // Reclamos que no llegaron a ningún dispositivo por un fallo que se puede
  // reintentar (o por falta de tiempo): se devuelven a su valor anterior.
  const release: AlertRow[] = [];
  const invalidOnly: { alert: AlertRow; hosts: string[] }[] = []; // no llegaron solo por 400/403
  let sendOutOfTime = false;
  const sendStart = clock();

  const byUser = new Map<string, typeof claimed>();
  for (const x of claimed) byUser.set(x.alert.user_id, [...(byUser.get(x.alert.user_id) || []), x]);
  await pool([...byUser.entries()], SEND_CONCURRENCY, async ([userId, items]) => {
    const subs = (subsOf.get(userId) || []).slice(0, MAX_SUBS_PER_USER);
    for (const { alert, quote } of items) {
      const live = subs.filter(s => failedSubs.get(s.sub_id) !== "gone");
      if (!live.length) { res.noDevice++; continue; } // sin dispositivo: queda marcada (no hay a quién avisar)
      const payload = buildAlertPayload(alert, quote);
      // Todos los dispositivos de la alerta a la vez; el presupuesto se mira
      // antes de cada envío.
      const outcomes = await Promise.all(live.map(async (s): Promise<PushOutcome | "late"> => {
        const prior = failedSubs.get(s.sub_id);
        if (prior) return prior;
        if (clock() - sendStart > sendBudget) return "late";
        res.pushAttempts++;
        let o: PushOutcome;
        try { o = pushOutcome((await d.sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload)).status); }
        catch { o = "retry"; }
        if (o === "ok") { res.sent++; okSubs.add(s.sub_id); okHosts.add(pushHost(s.endpoint)); return o; }
        res.pushFailed++;
        failedSubs.set(s.sub_id, o);
        if (o === "invalid") invalidHosts.add(pushHost(s.endpoint));
        return o;
      }));
      if (outcomes.includes("ok")) continue;
      if (outcomes.includes("late")) { sendOutOfTime = true; release.push(alert); continue; }
      if (outcomes.includes("retry")) { release.push(alert); continue; }
      if (outcomes.every(o => o === "gone")) { res.noDevice++; continue; } // ya no hay dispositivo
      if (outcomes.includes("invalid")) {
        invalidOnly.push({ alert, hosts: live.filter(s => failedSubs.get(s.sub_id) === "invalid").map(s => pushHost(s.endpoint)) });
      }
      // "fail" (otro 4xx): queda reclamada.
    }
  });
  if (sendOutOfTime) { res.outOfTime = true; res.errors++; }

  // 400/403 por servicio push: si en un servicio NADA llegó y hubo 400/403, el
  // problema puede ser del servidor (clave VAPID, encabezado): suena la alarma
  // y se devuelven esos avisos. Las suscripciones nunca se borran por un solo
  // 400/403: push_subscriptions_record las borra con 8 fallos seguidos y el
  // primero hace 48 h o más (migración 20261123000100).
  res.invalidSubs = [...failedSubs.values()].filter(o => o === "invalid").length;
  const systemicHosts = [...invalidHosts].filter(h => !okHosts.has(h));
  if (systemicHosts.length) {
    res.pushSystemic = true;
    res.errors++;
    const sys = new Set(systemicHosts);
    release.push(...invalidOnly.filter(x => x.hosts.some(h => sys.has(h))).map(x => x.alert));
  }

  // Resultado por dispositivo, por RPC y en tandas: ok vuelve a 0, gone
  // (404/410) se borra, los demás fallos suman.
  const gone: string[] = [], failed: string[] = [];
  for (const [id, o] of failedSubs) {
    if (o === "gone") gone.push(id);
    else if (!okSubs.has(id)) failed.push(id); // si además llegó algo, cuenta como ok
  }
  const ok = [...okSubs].filter(id => failedSubs.get(id) !== "gone");
  const parts = Math.max(chunks(ok).length, chunks(failed).length, chunks(gone).length);
  for (let k = 0; k < parts; k++) {
    const slice = (l: string[]) => l.slice(k * RPC_BATCH, (k + 1) * RPC_BATCH);
    try {
      const r = await rpc("push_subscriptions_record", { p_ok: slice(ok), p_failed: slice(failed), p_gone: slice(gone), p_at: at });
      if (r.ok) res.removedSubs += Number(await r.json()) || 0;
      else res.errors++;
    } catch { res.errors++; }
  }

  // Devolución por RPC, en tandas: a su valor anterior (queda revisada en esta corrida).
  for (const part of chunks(release)) {
    try {
      const r = await rpc("invest_alerts_release", { p_ids: part.map(a => a.id), p_prev: part.map(a => a.last_triggered_at ?? null), p_at: at });
      if (r.ok) res.released += part.length;
      else res.errors++;
    } catch { res.errors++; }
  }
  return res;
}
