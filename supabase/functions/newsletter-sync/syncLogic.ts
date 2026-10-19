// supabase/functions/newsletter-sync/syncLogic.ts
//
// Auditoría 360, C-16 (MKT-4): el doble opt-in confirmaba el consentimiento
// pero nadie agregaba la dirección a la lista del newsletter. Esta lógica
// recorre las tablas con consentimiento de marketing, toma las filas
// confirmadas, sin baja y todavía sin sincronizar, las suscribe al segmento de
// Resend por el proxy (/api/subscribe) y marca newsletter_synced_at. La llama
// el job newsletter-sync cada 10 minutos; si el proxy falla, la fila queda sin
// marcar y la próxima corrida la reintenta.
//
// Separada de index.ts para testearla con vitest (index.ts lee Deno.env).

import { subscribeToNewsletter, type NewsletterConfig } from "../_shared/newsletterSubscribe.ts";

export type Product = "moyiq" | "invest";

export interface SyncSource {
  table: string;
  // Producto fijo de la tabla, o null si lo dice cada fila (newsletter_signups).
  product: Product | null;
}

export const SYNC_SOURCES: readonly SyncSource[] = [
  { table: "starter_leads", product: "moyiq" },
  { table: "diagnostico_leads", product: "moyiq" },
  { table: "demo_leads", product: "moyiq" },
  { table: "invest_leads", product: "invest" },
  { table: "newsletter_signups", product: null },
];

export const BATCH_PER_TABLE = 50;

export interface SyncConfig extends NewsletterConfig {
  supabaseUrl: string;
  serviceRole: string;
}

export interface TableResult {
  pending: number;
  subscribed: number;
  failed: number;
}

interface PendingRow {
  id: string;
  email: string;
  product?: string | null;
}

function headers(config: SyncConfig, extra: Record<string, string> = {}) {
  return { apikey: config.serviceRole, Authorization: `Bearer ${config.serviceRole}`, ...extra };
}

export function pendingUrl(config: SyncConfig, source: SyncSource, limit = BATCH_PER_TABLE): string {
  const select = source.product ? "id,email" : "id,email,product";
  return `${config.supabaseUrl}/rest/v1/${source.table}?select=${select}` +
    "&consent_marketing=is.true&consent_confirmed_at=not.is.null&unsubscribed_at=is.null&newsletter_synced_at=is.null" +
    `&order=consent_confirmed_at.asc&limit=${limit}`;
}

async function fetchPending(config: SyncConfig, source: SyncSource): Promise<PendingRow[]> {
  const res = await fetch(pendingUrl(config, source), { headers: headers(config) });
  if (!res.ok) throw new Error(`rest_get_failed_${source.table}_${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

async function markSynced(config: SyncConfig, table: string, id: string): Promise<void> {
  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&newsletter_synced_at=is.null`,
    {
      method: "PATCH",
      headers: headers(config, { "Content-Type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify({ newsletter_synced_at: new Date().toISOString() }),
    },
  );
  if (!res.ok) throw new Error(`rest_patch_failed_${table}_${res.status}`);
}

export function productOf(source: SyncSource, row: PendingRow): Product | null {
  const p = source.product ?? row.product;
  return p === "moyiq" || p === "invest" ? p : null;
}

// dryRun: solo cuenta lo pendiente, no llama al proxy ni marca nada.
export async function runNewsletterSync(
  config: SyncConfig,
  opts: { dryRun?: boolean } = {},
): Promise<{ tables: Record<string, TableResult>; errors: string[] }> {
  const tables: Record<string, TableResult> = {};
  const errors: string[] = [];
  for (const source of SYNC_SOURCES) {
    const r: TableResult = { pending: 0, subscribed: 0, failed: 0 };
    tables[source.table] = r;
    let rows: PendingRow[];
    try {
      rows = await fetchPending(config, source);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      continue;
    }
    r.pending = rows.length;
    if (opts.dryRun) continue;
    for (const row of rows) {
      const product = productOf(source, row);
      if (!product) { r.failed++; continue; }
      const sub = await subscribeToNewsletter(row.email, product, config);
      if (!sub.ok) { r.failed++; continue; }
      try {
        await markSynced(config, source.table, row.id);
        r.subscribed++;
      } catch (e) {
        r.failed++;
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
  }
  return { tables, errors };
}
