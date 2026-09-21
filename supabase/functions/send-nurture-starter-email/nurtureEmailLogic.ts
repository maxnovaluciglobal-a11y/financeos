// supabase/functions/send-nurture-starter-email/nurtureEmailLogic.ts
//
// Lógica pura de la secuencia de 3 emails de nurture para quien elige
// "Starter" (cuenta gratis, sin clave) — pedido explícito de Walter,
// 14-sep-2026, calcado del patrón de send-nurture-diagnostico-email/. La
// diferencia de fondo con esa secuencia: quien recibe esto YA ES usuario
// Starter con cuenta activa, no un lead que "podría" registrarse. El
// objetivo es activación (que use Dashboard/Movimientos/Presupuestos con
// datos reales) y, en el email 3, upsell a Pro — nunca "creá tu cuenta".
//
// Separada de index.ts por el mismo motivo que en send-nurture-diagnostico-
// email/: index.ts lee Deno.env.get() a nivel de módulo y no se puede
// importar desde Node/vitest.
//
// Remitente: mismo "MOY IQ <hola@moyiq.app>" ya verificado en Resend para
// nurture — no hace falta configurar nada nuevo ahí (ver reporte de la
// sesión del 13-sep que armó send-nurture-diagnostico-email).
//
// consent_marketing: starter_leads no tenía esta columna — el signup de
// Starter no pide opt-in explícito de marketing hoy, a diferencia del
// formulario de Diagnóstico Exprés. Se agregó consent_marketing boolean not
// null default true en la migración 20260918000500 (ver esa migración para
// el razonamiento completo). El filtro de elegibilidad de acá exige
// consent_marketing = true, igual que diagnóstico — hoy es un no-op porque
// todos entran en true por default, pero deja el gate simétrico y listo
// para un futuro checkbox de opt-in sin tocar este archivo.

export type NurtureMode = "welcome" | "day2" | "day5";

export interface StarterLead {
  id: string;
  email: string;
}

export interface NurtureEmailConfig {
  supabaseUrl: string;
  serviceRole: string;
  resendApiKey?: string;
  fromEmail: string; // "MOY IQ <hola@moyiq.app>"
  cronSecret?: string;
  landingUrl: string; // "https://moyiq.app" — para armar el link de unsubscribe
}

export function unsubscribeUrl(config: NurtureEmailConfig, leadId: string): string {
  // t=starter selecciona el RPC unsubscribe_starter_lead en unsubscribe.html
  // (ver financeos-landing/unsubscribe.html, actualizado en esta misma tarea
  // para aceptar ambas tablas).
  return `${config.landingUrl.replace(/\/$/, "")}/unsubscribe.html?id=${encodeURIComponent(leadId)}&t=starter`;
}

function wrapHtml(bodyHtml: string, unsubUrl: string): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.55">
      ${bodyHtml}
      <p style="color:#999;font-size:11px;margin-top:32px;border-top:1px solid #eee;padding-top:12px">
        MOY IQ · MAXNOVA &amp; LUCI Global LLC.
        <a href="${unsubUrl}" style="color:#999">Darme de baja de estos correos</a>.
      </p>
    </div>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

export function renderEmail(mode: NurtureMode, lead: StarterLead, config: NurtureEmailConfig): RenderedEmail {
  const unsub = unsubscribeUrl(config, lead.id);

  if (mode === "welcome") {
    const subject = "Lo primero que conviene hacer con tu cuenta";
    const html = wrapHtml(
      `
      <h2 style="color:#14213D">Tu cuenta ya está activa</h2>
      <p>Hola,</p>
      <p>Tu cuenta de MOY IQ ya está lista. Sin nada cargado todavía, el Dashboard no tiene mucho que mostrarte — el primer paso que rinde es importar tus movimientos.</p>
      <p>Andá a Movimientos → Importar y subí el archivo que descargues de tu banco (CSV o Excel, la mayoría de los bancos de la región lo dan así). MOY IQ categoriza automáticamente lo que reconoce; lo que no, lo dejás en "Importado" y lo ajustás cuando quieras.</p>
      <p>No hace falta cargar todo el historial. Con el último mes alcanza para que el Dashboard y el IQ Score empiecen a mostrar algo real.</p>
      <p><a href="https://app.moyiq.app/import?ref=starter-welcome" style="display:inline-block;background:#14213D;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Importar movimientos →</a></p>
      <p style="color:#666;font-size:13px">Los datos se cifran en tu dispositivo antes de sincronizarse. Nadie del equipo puede ver tus montos ni categorías.</p>
      `,
      unsub,
    );
    return { subject, html };
  }

  if (mode === "day2") {
    const subject = "El IQ Score no es un número decorativo";
    const html = wrapHtml(
      `
      <h2 style="color:#14213D">Lo que la mayoría no descubre solo</h2>
      <p>Hola,</p>
      <p>Con movimientos ya cargados, hay una parte del Dashboard que suele pasar desapercibida: el IQ Score no es un puntaje genérico — se arma con cinco factores puntuales (flujo de caja, colchón de emergencia, carga de deuda, progreso de metas, consistencia de tus datos), cada uno con su propio peso.</p>
      <p>Tocá el score para ver el desglose. Sirve para ubicar dónde está el problema real en vez de adivinar — por ejemplo, un score bajo por flujo de caja negativo pide una acción distinta que uno bajo por falta de colchón de emergencia.</p>
      <p>Presupuestos hace algo parecido en otra sección: se arma solo a partir de lo que ya importaste, sin que tengas que definir categorías ni límites a mano primero.</p>
      <p><a href="https://app.moyiq.app/dashboard?ref=starter-d2" style="display:inline-block;background:#14213D;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Ver mi IQ Score →</a></p>
      <p style="color:#666;font-size:13px">Si todavía no importaste movimientos, el score no tiene con qué calcularse — ese es el paso anterior a este.</p>
      `,
      unsub,
    );
    return { subject, html };
  }

  // day5
  const subject = "Qué diferencia a Starter de Pro en la práctica";
  const html = wrapHtml(
    `
    <h2 style="color:#14213D">Sin testimonios inventados</h2>
    <p>Hola,</p>
    <p>No te vamos a inventar un testimonio de "Fulano ahorró X% en 3 meses". No tenemos esos casos documentados todavía, y prometer un resultado que no podemos mostrar con datos reales no ayuda a nadie.</p>
    <p>Lo que sí podemos ser específicos es en la diferencia real entre lo que ya estás usando en Starter y lo que suma Pro:</p>
    <p><strong>Starter (lo que ya tenés, sin fecha de vencimiento):</strong><br>
    — Dashboard con IQ Score<br>
    — Movimientos y categorización automática<br>
    — Presupuestos básicos<br>
    — Metas simples</p>
    <p><strong>Pro (US$4.99/mes o US$39.99/año):</strong><br>
    — Coach: recomendaciones que se ajustan con cada movimiento nuevo<br>
    — Advisor: proyección de escenarios antes de tomar una decisión grande<br>
    — Goals con seguimiento de múltiples objetivos y ajuste automático<br>
    — Reports exportables</p>
    <p>Si tu situación es simple, seguir en Starter no te falta nada. Si tenés varias metas corriendo en paralelo o una decisión grande en el horizonte cercano, ahí es donde Pro paga solo.</p>
    <p><a href="https://app.moyiq.app/upgrade?ref=starter-d5" style="display:inline-block;background:#14213D;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Ver Pro →</a></p>
    <p style="color:#666;font-size:13px">Si no es para vos, seguís en Starter sin perder nada de lo que ya armaste.</p>
    `,
    unsub,
  );
  return { subject, html };
}

// --- Envío con reintento (mismo patrón que send-nurture-diagnostico-email) --

export async function sendViaResend(
  to: string,
  rendered: RenderedEmail,
  config: NurtureEmailConfig,
): Promise<{ ok: boolean; error?: string }> {
  if (!config.resendApiKey) return { ok: false, error: "resend_not_configured" };

  const body = { from: config.fromEmail, to, subject: rendered.subject, html: rendered.html };
  const attempt = () =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  let res = await attempt();
  if (!res.ok) {
    console.warn(`send-nurture-starter-email: intento 1 falló (${res.status}) — reintentando`);
    res = await attempt();
  }
  if (!res.ok) {
    const text = await res.text();
    console.error(`send-nurture-starter-email: Resend error tras reintento: ${res.status} ${text}`);
    return { ok: false, error: `resend_${res.status}` };
  }
  return { ok: true };
}

// --- Consultas contra starter_leads (service role, REST) ---------------------

async function restGet<T>(path: string, config: NurtureEmailConfig): Promise<T> {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: config.serviceRole,
      Authorization: `Bearer ${config.serviceRole}`,
    },
  });
  if (!res.ok) throw new Error(`rest_get_failed_${res.status}`);
  return res.json();
}

async function restPatch(path: string, body: unknown, config: NurtureEmailConfig): Promise<void> {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: config.serviceRole,
      Authorization: `Bearer ${config.serviceRole}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`rest_patch_failed_${res.status}`);
}

export async function fetchLeadById(id: string, config: NurtureEmailConfig): Promise<StarterLead | null> {
  const rows = await restGet<StarterLead[]>(
    `starter_leads?id=eq.${encodeURIComponent(id)}&select=id,email&limit=1`,
    config,
  );
  return rows[0] ?? null;
}

const BATCH_LIMIT = 200; // tope por corrida del cron — mismo criterio que diagnóstico: salvaguarda contra un bug de filtro, no una expectativa de tráfico real.

// Email 2: sin edad mínima a propósito (mismo diseño anti-spam retroactivo
// que diagnóstico, ver 20260913173000_diagnostico_nurture_send.sql) — se
// manda una sola vez a quien todavía no lo tenga marcado, sin importar
// cuándo se creó el lead.
export async function fetchEligibleForEmail2(config: NurtureEmailConfig): Promise<StarterLead[]> {
  return restGet<StarterLead[]>(
    `starter_leads?select=id,email` +
      `&unsubscribed_at=is.null&consent_marketing=is.true&account_created_at=is.null&email2_sent_at=is.null` +
      `&limit=${BATCH_LIMIT}`,
    config,
  );
}

// Email 3: solo si ya se mandó el 2 y pasaron >= 3 días desde ESE envío (no
// desde la creación del lead) — así nunca se manda 2 y 3 en la misma corrida.
export async function fetchEligibleForEmail3(config: NurtureEmailConfig): Promise<StarterLead[]> {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  return restGet<StarterLead[]>(
    `starter_leads?select=id,email` +
      `&unsubscribed_at=is.null&consent_marketing=is.true&account_created_at=is.null` +
      `&email3_sent_at=is.null&email2_sent_at=not.is.null&email2_sent_at=lte.${cutoff}` +
      `&limit=${BATCH_LIMIT}`,
    config,
  );
}

export async function markSent(leadId: string, mode: NurtureMode, config: NurtureEmailConfig): Promise<void> {
  const column = mode === "welcome" ? "email1_sent_at" : mode === "day2" ? "email2_sent_at" : "email3_sent_at";
  await restPatch(`starter_leads?id=eq.${encodeURIComponent(leadId)}`, { [column]: new Date().toISOString() }, config);
}

export interface CronRunResult {
  email2: { attempted: number; sent: number; failed: number };
  email3: { attempted: number; sent: number; failed: number };
}

// Corre el batch de emails 2 y 3. Se llama desde index.ts en modo "cron"
// (autenticado con CRON_SECRET, no con la llamada pública del navegador).
export async function runCronBatch(config: NurtureEmailConfig): Promise<CronRunResult> {
  const result: CronRunResult = {
    email2: { attempted: 0, sent: 0, failed: 0 },
    email3: { attempted: 0, sent: 0, failed: 0 },
  };

  const leads2 = await fetchEligibleForEmail2(config);
  result.email2.attempted = leads2.length;
  for (const lead of leads2) {
    const rendered = renderEmail("day2", lead, config);
    const sent = await sendViaResend(lead.email, rendered, config);
    if (sent.ok) {
      await markSent(lead.id, "day2", config);
      result.email2.sent++;
    } else {
      result.email2.failed++;
      console.error(`send-nurture-starter-email: día2 falló para lead ${lead.id}: ${sent.error}`);
    }
  }

  const leads3 = await fetchEligibleForEmail3(config);
  result.email3.attempted = leads3.length;
  for (const lead of leads3) {
    const rendered = renderEmail("day5", lead, config);
    const sent = await sendViaResend(lead.email, rendered, config);
    if (sent.ok) {
      await markSent(lead.id, "day5", config);
      result.email3.sent++;
    } else {
      result.email3.failed++;
      console.error(`send-nurture-starter-email: día5 falló para lead ${lead.id}: ${sent.error}`);
    }
  }

  return result;
}
