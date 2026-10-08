// supabase/functions/send-cancellation-confirmation/cancellationLogic.ts
//
// Confirmación de una cancelación online (§ 312k BGB "Kündigungsbutton",
// leyes de renovación automática de EE. UU.). La landing guarda la
// declaración con la RPC pública submit_cancellation_request y después llama
// a esta función con el id. Acá se manda:
//   (a) al cliente, en su idioma, la confirmación de recepción con el
//       contenido de la declaración, la fecha/hora de recepción y el momento
//       en que debe terminar el contrato (§ 312k Abs. 4 BGB: "sofort ... in
//       Textform");
//   (b) a soporte, el aviso interno con todos los datos para procesarla.
//
// Idempotencia: cada envío se "reclama" con un PATCH condicional
// (…&customer_email_sent_at=is.null) que solo actualiza si nadie lo mandó
// antes; si Resend falla se libera el reclamo para que un reintento pueda
// mandarlo. Así, llamar a la función N veces con el mismo id manda cada
// correo una sola vez (también ante dos llamadas simultáneas).
//
// Separada de index.ts por el mismo motivo que el resto de funciones del
// repo: index.ts lee Deno.env.get() y no se puede importar desde vitest.

import { type EmailLang, pickLang, INTL_LOCALE } from "../_shared/emailLang.ts";

export interface CancellationRow {
  id: string;
  created_at: string;
  lang?: string | null;
  name?: string | null;
  email: string;
  plan?: string | null;
  contract_ref?: string | null;
  kind?: string | null;
  reason?: string | null;
  requested_date?: string | null; // 'YYYY-MM-DD' o null = próxima fecha posible
  user_agent?: string | null;
  customer_email_sent_at?: string | null;
  internal_email_sent_at?: string | null;
}

export interface CancellationConfig {
  supabaseUrl: string;
  serviceRole: string;
  resendApiKey?: string;
  fromEmail: string; // "MOY IQ <hola@moyiq.app>"
  replyTo: string; // support@moyiq.app
  internalTo: string[]; // support@moyiq.app + ALERT_EMAIL
}

export type SendState = "sent" | "already_sent" | "failed";

export interface ProcessResult {
  ok: boolean;
  error?: string;
  customer?: SendState;
  internal?: SendState;
}

// --- Textos -----------------------------------------------------------------

interface Copy {
  subject: string;
  intro: (ts: string) => string;
  outro: (id: string) => string;
  labels: {
    receivedAt: string;
    name: string;
    email: string;
    plan: string;
    contractRef: string;
    kind: string;
    reason: string;
    endDate: string;
  };
  plan: Record<string, string>;
  kind: { ordinary: string; extraordinary: string };
  nextPossible: string;
}

export const COPY: Record<EmailLang, Copy> = {
  es: {
    subject: "Recibimos tu cancelación — MOY IQ",
    intro: (ts) => `Recibimos tu declaración de cancelación el ${ts}. Este correo confirma su recepción. Este es su contenido:`,
    outro: (id) =>
      `Número de referencia: ${id}. Guarda este correo. Procesamos la cancelación y te confirmamos por este medio la fecha en que termina tu contrato. Si no pediste esta cancelación, responde a este correo.`,
    labels: {
      receivedAt: "Recibida el",
      name: "Nombre",
      email: "Email",
      plan: "Contrato",
      contractRef: "Identificación del contrato",
      kind: "Tipo de cancelación",
      reason: "Motivo",
      endDate: "Fin del contrato solicitado",
    },
    plan: { pro_monthly: "Pro mensual", pro_yearly: "Pro anual", starter: "Starter (cuenta gratis)", unsure: "No lo sé" },
    kind: { ordinary: "Ordinaria", extraordinary: "Extraordinaria (por causa justificada)" },
    nextPossible: "En la próxima fecha posible",
  },
  en: {
    subject: "We received your cancellation — MOY IQ",
    intro: (ts) => `We received your cancellation notice on ${ts}. This email confirms receipt. This is its content:`,
    outro: (id) =>
      `Reference number: ${id}. Keep this email. We will process the cancellation and confirm by email the date your contract ends. If you did not request this cancellation, reply to this email.`,
    labels: {
      receivedAt: "Received on",
      name: "Name",
      email: "Email",
      plan: "Contract",
      contractRef: "Contract identification",
      kind: "Type of cancellation",
      reason: "Reason",
      endDate: "Requested end of contract",
    },
    plan: { pro_monthly: "Pro monthly", pro_yearly: "Pro yearly", starter: "Starter (free account)", unsure: "Not sure" },
    kind: { ordinary: "Ordinary", extraordinary: "Extraordinary (for good cause)" },
    nextPossible: "At the next possible date",
  },
  pt: {
    subject: "Recebemos seu cancelamento — MOY IQ",
    intro: (ts) => `Recebemos sua declaração de cancelamento em ${ts}. Este e-mail confirma o recebimento. Este é o conteúdo:`,
    outro: (id) =>
      `Número de referência: ${id}. Guarde este e-mail. Vamos processar o cancelamento e confirmar por e-mail a data em que seu contrato termina. Se você não pediu este cancelamento, responda a este e-mail.`,
    labels: {
      receivedAt: "Recebida em",
      name: "Nome",
      email: "E-mail",
      plan: "Contrato",
      contractRef: "Identificação do contrato",
      kind: "Tipo de cancelamento",
      reason: "Motivo",
      endDate: "Fim do contrato solicitado",
    },
    plan: { pro_monthly: "Pro mensal", pro_yearly: "Pro anual", starter: "Starter (conta grátis)", unsure: "Não sei" },
    kind: { ordinary: "Ordinário", extraordinary: "Extraordinário (por justa causa)" },
    nextPossible: "Na próxima data possível",
  },
  de: {
    subject: "Eingangsbestätigung Ihrer Kündigung — MOY IQ",
    intro: (ts) =>
      `Ihre Kündigungserklärung ist am ${ts} bei uns eingegangen. Mit dieser E-Mail bestätigen wir den Eingang. Ihre Erklärung hat folgenden Inhalt:`,
    outro: (id) =>
      `Referenznummer: ${id}. Bitte bewahren Sie diese E-Mail auf. Wir bearbeiten Ihre Kündigung und teilen Ihnen per E-Mail mit, zu welchem Zeitpunkt Ihr Vertrag endet. Falls Sie diese Kündigung nicht veranlasst haben, antworten Sie bitte auf diese E-Mail.`,
    labels: {
      receivedAt: "Eingegangen am",
      name: "Name",
      email: "E-Mail",
      plan: "Vertrag",
      contractRef: "Vertragsidentifikation",
      kind: "Art der Kündigung",
      reason: "Kündigungsgrund",
      endDate: "Gewünschtes Vertragsende",
    },
    plan: { pro_monthly: "Pro – Monatsabo", pro_yearly: "Pro – Jahresabo", starter: "Starter – kostenloses Konto", unsure: "Nicht sicher" },
    kind: { ordinary: "Ordentliche Kündigung", extraordinary: "Außerordentliche (fristlose) Kündigung aus wichtigem Grund" },
    nextPossible: "Zum nächstmöglichen Zeitpunkt",
  },
};

// --- Formato ----------------------------------------------------------------

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Fecha y hora de recepción con zona explícita: hora de Berlín para alemán
// (MEZ/MESZ), UTC para el resto (el servidor no conoce la zona del cliente).
export function fmtTimestamp(iso: string, lang: EmailLang): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(INTL_LOCALE[lang], {
    // dateStyle/timeStyle no se pueden combinar con timeZoneName.
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: lang === "de" ? "Europe/Berlin" : "UTC",
    timeZoneName: "short",
  });
}

export function fmtDate(ymd: string, lang: EmailLang): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toLocaleDateString(INTL_LOCALE[lang], { dateStyle: "long", timeZone: "UTC" } as Intl.DateTimeFormatOptions);
}

function rowsFor(row: CancellationRow, lang: EmailLang): [string, string][] {
  const c = COPY[lang];
  const kind = row.kind === "extraordinary" ? "extraordinary" : "ordinary";
  const out: [string, string][] = [
    [c.labels.receivedAt, fmtTimestamp(row.created_at, lang)],
    [c.labels.name, row.name ?? ""],
    [c.labels.email, row.email],
    [c.labels.plan, row.plan ? (c.plan[row.plan] ?? row.plan) : ""],
    [c.labels.contractRef, row.contract_ref ?? ""],
    [c.labels.kind, c.kind[kind]],
    [c.labels.reason, kind === "extraordinary" ? (row.reason ?? "") : ""],
    [c.labels.endDate, row.requested_date ? fmtDate(row.requested_date, lang) : c.nextPossible],
  ];
  return out.filter(([, v]) => v !== "");
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function table(rows: [string, string][]): string {
  return `<table style="border-collapse:collapse;width:100%;font-size:14px;margin:16px 0">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#5F5236;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0;color:#14213D;vertical-align:top;word-break:break-word">${escapeHtml(v).replace(/\n/g, "<br>")}</td></tr>`,
    )
    .join("")}</table>`;
}

function wrap(inner: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#14213D;line-height:1.55">${inner}<p style="color:#8B7A55;font-size:11px;margin-top:32px;border-top:1px solid #E4DFD1;padding-top:12px">MOY IQ · MAXNOVA &amp; LUCI Global LLC · support@moyiq.app</p></div>`;
}

export function renderCustomerEmail(row: CancellationRow): RenderedEmail {
  const lang = pickLang(row.lang);
  const c = COPY[lang];
  const ts = fmtTimestamp(row.created_at, lang);
  const rows = rowsFor(row, lang);
  const html = wrap(
    `<p>${escapeHtml(c.intro(ts))}</p>${table(rows)}<p>${escapeHtml(c.outro(row.id))}</p>`,
  );
  const text = [c.intro(ts), "", ...rows.map(([k, v]) => `${k}: ${v}`), "", c.outro(row.id), "", "MOY IQ · MAXNOVA & LUCI Global LLC · support@moyiq.app"].join("\n");
  return { subject: c.subject, html, text };
}

// Aviso interno: siempre en español (lo lee soporte), con todo lo necesario
// para procesarla y el idioma en que hay que contestarle al cliente.
export function renderInternalEmail(row: CancellationRow): RenderedEmail {
  const lang = pickLang(row.lang);
  const es = COPY.es;
  const extra = row.kind === "extraordinary";
  const rows: [string, string][] = [
    ...rowsFor(row, "es"),
    ["Idioma del cliente", row.lang ?? `sin dato (se le escribió en ${lang})`],
    ["User agent", row.user_agent ?? ""],
    ["ID", row.id],
  ].filter(([, v]) => v !== "") as [string, string][];
  const name = (row.name ?? row.email).slice(0, 80);
  const subject = `${extra ? "[Extraordinaria] " : ""}Cancelación recibida — ${name}${row.plan ? ` (${es.plan[row.plan] ?? row.plan})` : ""}`;
  const todo =
    "Pendiente: ubicar el contrato (Stripe / licencia / cuenta Starter), cancelar la renovación y confirmarle al cliente, en su idioma, la fecha en que termina el contrato. Después marcar la fila como done (status, processed_at).";
  const html = wrap(`<p><strong>Nueva cancelación online.</strong></p>${table(rows)}<p>${escapeHtml(todo)}</p>`);
  const text = ["Nueva cancelación online.", "", ...rows.map(([k, v]) => `${k}: ${v}`), "", todo].join("\n");
  return { subject, html, text };
}

// --- Red --------------------------------------------------------------------

function restHeaders(config: CancellationConfig, extra: Record<string, string> = {}) {
  return { apikey: config.serviceRole, Authorization: `Bearer ${config.serviceRole}`, ...extra };
}

export async function fetchCancellation(id: string, config: CancellationConfig): Promise<CancellationRow | null> {
  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/cancellation_requests?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
    { headers: restHeaders(config) },
  );
  if (!res.ok) throw new Error(`rest_get_failed_${res.status}`);
  const rows = (await res.json()) as CancellationRow[];
  return rows[0] ?? null;
}

export type SentColumn = "customer_email_sent_at" | "internal_email_sent_at";

// PATCH condicional: solo marca si la columna sigue en null. Devuelve true si
// esta llamada se quedó con el envío.
export async function claimSend(id: string, column: SentColumn, config: CancellationConfig): Promise<boolean> {
  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/cancellation_requests?id=eq.${encodeURIComponent(id)}&${column}=is.null`,
    {
      method: "PATCH",
      headers: restHeaders(config, { "Content-Type": "application/json", Prefer: "return=representation" }),
      body: JSON.stringify({ [column]: new Date().toISOString() }),
    },
  );
  if (!res.ok) throw new Error(`rest_patch_failed_${res.status}`);
  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

export async function releaseSend(id: string, column: SentColumn, config: CancellationConfig): Promise<void> {
  try {
    await fetch(`${config.supabaseUrl}/rest/v1/cancellation_requests?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: restHeaders(config, { "Content-Type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify({ [column]: null }),
    });
  } catch (e) {
    console.error(`send-cancellation-confirmation: no se pudo liberar ${column} de ${id}: ${e}`);
  }
}

// Un reintento ante error de red, 429 o 5xx (mismo patrón que las demás
// funciones con Resend). Un 4xx distinto de 429 no se reintenta.
export async function sendViaResend(
  to: string | string[],
  rendered: RenderedEmail,
  config: CancellationConfig,
): Promise<{ ok: boolean; error?: string }> {
  if (!config.resendApiKey) return { ok: false, error: "resend_not_configured" };
  const body = JSON.stringify({
    from: config.fromEmail,
    to,
    reply_to: config.replyTo,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
  const attempt = async (): Promise<Response | null> => {
    try {
      return await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
        body,
      });
    } catch {
      return null;
    }
  };
  let res = await attempt();
  if (!res || (!res.ok && (res.status === 429 || res.status >= 500))) {
    console.warn(`send-cancellation-confirmation: intento 1 falló (${res ? res.status : "red"}) — reintentando`);
    res = await attempt();
  }
  if (!res) return { ok: false, error: "resend_network" };
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`send-cancellation-confirmation: Resend ${res.status} ${text}`);
    return { ok: false, error: `resend_${res.status}` };
  }
  return { ok: true };
}

async function sendOnce(
  row: CancellationRow,
  column: SentColumn,
  to: string | string[],
  rendered: RenderedEmail,
  config: CancellationConfig,
): Promise<SendState> {
  if (row[column]) return "already_sent";
  if (!(await claimSend(row.id, column, config))) return "already_sent";
  const r = await sendViaResend(to, rendered, config);
  if (r.ok) return "sent";
  await releaseSend(row.id, column, config);
  return "failed";
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function processCancellation(id: unknown, config: CancellationConfig): Promise<ProcessResult> {
  if (typeof id !== "string" || !UUID_RE.test(id)) return { ok: false, error: "invalid_id" };
  if (!config.resendApiKey) return { ok: false, error: "resend_not_configured" };
  const row = await fetchCancellation(id, config);
  if (!row) return { ok: false, error: "not_found" };

  const customer = await sendOnce(row, "customer_email_sent_at", row.email, renderCustomerEmail(row), config);
  const internalTo = [...new Set(config.internalTo.filter(Boolean))];
  const internal = internalTo.length
    ? await sendOnce(row, "internal_email_sent_at", internalTo, renderInternalEmail(row), config)
    : "failed";

  return { ok: customer !== "failed", customer, internal };
}
