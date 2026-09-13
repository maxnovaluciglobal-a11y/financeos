// supabase/functions/send-nurture-diagnostico-email/nurtureEmailLogic.ts
//
// Lógica pura de la secuencia de 3 emails de nurture post-Diagnóstico Exprés
// (ver financeos-landing/marketing/nurture-diagnostico-3-emails.md — ahí está
// el copy exacto de donde sale este contenido). Separada de index.ts por el
// mismo motivo que reportEmailLogic.ts: index.ts lee Deno.env.get() a nivel
// de módulo y no se puede importar desde Node/vitest.
//
// Remitente: MOY IQ <hola@moyiq.app> — separado a propósito del transaccional
// (licencias@moyiq.app, usado por stripe-webhook y send-report-email). Es
// marketing/nurture, no transaccional; mezclar los dos golpea la reputación
// de entrega del remitente que sí importa para logins/recibos. Mismo dominio
// moyiq.app ya verificado en Resend — un alias nuevo no necesita verificación
// DNS adicional, solo darlo de alta como "From" en Resend (ver reporte final
// de esta sesión para el paso manual pendiente si no se pudo confirmar).
//
// A/B de asunto: el .md da 2 variantes de asunto por email. Sin infraestructura
// de A/B testing en este envío (no hay tracking de qué variante ganó ni forma
// de medirlo todavía), se fija SIEMPRE la variante A. Documentado acá porque
// es una decisión de producto, no un detalle de implementación.

export type NurtureMode = "welcome" | "day2" | "day5";

export interface DiagnosticoLead {
  id: string;
  email: string;
  score: number | null;
  label: string | null;
}

export interface NurtureEmailConfig {
  supabaseUrl: string;
  serviceRole: string;
  resendApiKey?: string;
  fromEmail: string; // "MOY IQ <hola@moyiq.app>"
  cronSecret?: string;
  landingUrl: string; // "https://moyiq.app" — para armar el link de unsubscribe
}

// --- Personalización del email 1 --------------------------------------------
//
// El diagnóstico corre 100% client-side en diagnostico.html y hoy solo manda
// al servidor `score` y `label` (Excelente/Bueno/Regular/Crítico) — el
// desglose por factor (flujo de caja / colchón de emergencia / carga de
// deuda / metas), que sería el dato ideal para saber el "hallazgo dominante",
// se calcula en el navegador pero nunca se persiste. Portarlo requeriría
// tocar el schema de diagnostico_leads y el flujo de captura de la landing,
// fuera del alcance de esta entrega (que es activar el envío, no rediseñar
// la captura de datos).
//
// Fallback implementado: se usa `label` como proxy del hallazgo dominante.
// Un label "Crítico" o "Regular" es, en la enorme mayoría de los casos que
// arma este cálculo (pesos: flujo 30, emergencia 20, deuda 20, metas 15),
// resultado de un flujo de caja negativo o ajustado — así que se apunta al
// mismo feature que el email 2 profundiza (Dashboard + Movimientos). No es
// tan preciso como saber el factor exacto, pero es consistente con lo que
// la app puede después mostrar con datos reales (regla explícita del .md:
// no prometer una recomendación que la app no pueda sostener).
function actionBlockForLabel(label: string | null): string {
  switch (label) {
    case "Crítico":
      return "Con tu resultado, lo más probable es que el problema esté en el flujo de caja del mes a mes — más sale de lo que entra, o casi. Registrá tus movimientos de esta semana en MOY IQ: el Dashboard te va a mostrar exactamente en qué categoría se te va la plata, sin que tengas que armar una planilla.";
    case "Regular":
      return "Tu resultado está en la zona donde un cambio chico rinde mucho: ordenar el colchón de emergencia o la carga de deuda. Con tus movimientos reales cargados, MOY IQ te muestra cuál de los dos te conviene atacar primero según tu propio flujo de caja.";
    case "Bueno":
      return "Ya estás manejando bien lo básico. El siguiente paso es que ese resultado no dependa de que te acuerdes de revisarlo — con tus movimientos importados, el Dashboard te avisa solo cuando algo se corre de lo normal.";
    case "Excelente":
      return "Tu resultado ya está en el nivel donde el foco pasa de \"ordenar\" a \"optimizar\" — metas en paralelo, proyección de decisiones grandes. Eso es exactamente lo que hace Goals y Advisor con tus datos reales.";
    default:
      // Fallback genérico si no llegó label (no debería pasar dado que el
      // formulario siempre lo manda, pero el gate de email es más flexible).
      return "Registrá tus movimientos de esta semana en MOY IQ. El Dashboard te muestra en qué categoría se te va más plata cada mes, sin que tengas que actualizar nada a mano.";
  }
}

export function unsubscribeUrl(config: NurtureEmailConfig, leadId: string): string {
  return `${config.landingUrl.replace(/\/$/, "")}/unsubscribe.html?id=${encodeURIComponent(leadId)}`;
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

export function renderEmail(mode: NurtureMode, lead: DiagnosticoLead, config: NurtureEmailConfig): RenderedEmail {
  const unsub = unsubscribeUrl(config, lead.id);
  const score = lead.score != null ? `${lead.score}/100` : "tu resultado";

  if (mode === "welcome") {
    const subject = "Tu diagnóstico financiero completo"; // variante A fija, ver nota arriba
    const html = wrapHtml(
      `
      <h2 style="color:#14213D">Acá está tu diagnóstico completo</h2>
      <p>Hola,</p>
      <p>Acá está tu diagnóstico completo — sin el recorte que viste en el preview.</p>
      <p><strong>Tu puntaje MOY IQ exprés: ${score}${lead.label ? ` (${lead.label})` : ""}</strong></p>
      <p>Un paso concreto para esta semana, según tu resultado:</p>
      <p>${actionBlockForLabel(lead.label)}</p>
      <p>Este diagnóstico es una foto de un momento. Para ver cómo cambia con cada decisión que tomás, hace falta registrar los movimientos reales — eso es lo que hace la cuenta gratuita.</p>
      <p><a href="https://app.moyiq.app/signup?ref=diagnostico" style="display:inline-block;background:#14213D;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Crear cuenta gratis →</a></p>
      <p style="color:#666;font-size:13px">Sin tarjeta, sin trial que vencer. Starter no tiene fecha de corte.</p>
      `,
      unsub,
    );
    return { subject, html };
  }

  if (mode === "day2") {
    const subject = "Por qué el presupuesto que armaste en una hoja de cálculo no dura"; // variante A
    const html = wrapHtml(
      `
      <h2 style="color:#14213D">El problema no es cuánto ganás</h2>
      <p>Hola,</p>
      <p>Un dato que se repite en las encuestas de capacidad financiera en la región: la mayoría de las personas que arman un presupuesto lo dejan de actualizar antes de los 60 días. No por falta de disciplina — porque mantenerlo a mano en una hoja de cálculo es trabajo, y ese trabajo compite con todo lo demás.</p>
      <p>El problema no es el presupuesto. Es que depende de que alguien lo teclee.</p>
      <p>Cuando importás tus movimientos en MOY IQ, no armás el presupuesto — se arma solo a partir de lo que ya gastaste. La sección de Movimientos categoriza automáticamente cada transacción, y el Dashboard te muestra en qué categoría se te fue más plata este mes comparado con el anterior. No hay que actualizar nada a mano para verlo.</p>
      <p>Si tu diagnóstico marcó un puntaje bajo, es probablemente esto: no falta de ingreso, falta de visibilidad de a dónde va.</p>
      <p><a href="https://app.moyiq.app/signup?ref=diagnostico-d2" style="display:inline-block;background:#14213D;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Ver mi dashboard →</a></p>
      <p style="color:#666;font-size:13px">Starter incluye Dashboard, Movimientos y Presupuestos sin costo.</p>
      `,
      unsub,
    );
    return { subject, html };
  }

  // day5
  const subject = "Qué diferencia a Starter de Pro en la práctica"; // variante A
  const html = wrapHtml(
    `
    <h2 style="color:#14213D">Sin testimonios inventados</h2>
    <p>Hola,</p>
    <p>No te vamos a inventar un testimonio de "Fulano ahorró X% en 3 meses". No tenemos esos casos documentados todavía, y prometer un resultado que no podemos mostrar con datos reales no ayuda a nadie.</p>
    <p>Lo que sí podemos ser específicos es en la diferencia real entre lo que ya estás usando (o podés usar gratis) y lo que suma Pro:</p>
    <p><strong>Starter (gratis, sin fecha de vencimiento):</strong><br>
    — Dashboard con IQ Score<br>
    — Movimientos y categorización automática<br>
    — Presupuestos básicos<br>
    — Metas simples</p>
    <p><strong>Pro (US$4.99/mes o US$39.99/año):</strong><br>
    — Coach: recomendaciones que se ajustan con cada movimiento nuevo<br>
    — Advisor: proyección de escenarios antes de tomar una decisión grande<br>
    — Goals con seguimiento de múltiples objetivos y ajuste automático<br>
    — Reports exportables</p>
    <p>Si tu situación es simple, Starter alcanza y no hace falta pagar nada. Si tenés varias metas corriendo en paralelo o decisiones grandes en el horizonte cercano, ahí es donde Pro paga solo.</p>
    <p><a href="https://app.moyiq.app/upgrade?ref=diagnostico-d5" style="display:inline-block;background:#14213D;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Actualizar a Pro →</a></p>
    <p style="color:#666;font-size:13px">Si no es para vos, seguís en Starter sin perder nada de lo que ya armaste.</p>
    `,
    unsub,
  );
  return { subject, html };
}

// --- Envío con reintento (mismo patrón que reportEmailLogic.sendReportEmail) --

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
    console.warn(`send-nurture-diagnostico-email: intento 1 falló (${res.status}) — reintentando`);
    res = await attempt();
  }
  if (!res.ok) {
    const text = await res.text();
    console.error(`send-nurture-diagnostico-email: Resend error tras reintento: ${res.status} ${text}`);
    return { ok: false, error: `resend_${res.status}` };
  }
  return { ok: true };
}

// --- Consultas contra diagnostico_leads (service role, REST) -----------------

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

export async function fetchLeadById(id: string, config: NurtureEmailConfig): Promise<DiagnosticoLead | null> {
  const rows = await restGet<DiagnosticoLead[]>(
    `diagnostico_leads?id=eq.${encodeURIComponent(id)}&select=id,email,score,label&limit=1`,
    config,
  );
  return rows[0] ?? null;
}

const BATCH_LIMIT = 200; // tope por corrida del cron — este volumen de leads nunca se acerca a esto hoy, es una salvaguarda contra un bug de filtro, no una expectativa de tráfico.

// Email 2: sin edad mínima a propósito (ver nota de diseño anti-spam en la
// migración) — se manda una sola vez a quien todavía no lo tenga marcado.
export async function fetchEligibleForEmail2(config: NurtureEmailConfig): Promise<DiagnosticoLead[]> {
  return restGet<DiagnosticoLead[]>(
    `diagnostico_leads?select=id,email,score,label` +
      `&unsubscribed_at=is.null&consent_marketing=is.true&account_created_at=is.null&email2_sent_at=is.null` +
      `&limit=${BATCH_LIMIT}`,
    config,
  );
}

// Email 3: solo si ya se mandó el 2 y pasaron >= 3 días desde ESE envío (no
// desde la creación del lead) — así nunca se manda 2 y 3 en la misma corrida.
export async function fetchEligibleForEmail3(config: NurtureEmailConfig): Promise<DiagnosticoLead[]> {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  return restGet<DiagnosticoLead[]>(
    `diagnostico_leads?select=id,email,score,label` +
      `&unsubscribed_at=is.null&consent_marketing=is.true&account_created_at=is.null` +
      `&email3_sent_at=is.null&email2_sent_at=not.is.null&email2_sent_at=lte.${cutoff}` +
      `&limit=${BATCH_LIMIT}`,
    config,
  );
}

export async function markSent(leadId: string, mode: NurtureMode, config: NurtureEmailConfig): Promise<void> {
  const column = mode === "welcome" ? "email1_sent_at" : mode === "day2" ? "email2_sent_at" : "email3_sent_at";
  await restPatch(`diagnostico_leads?id=eq.${encodeURIComponent(leadId)}`, { [column]: new Date().toISOString() }, config);
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
      console.error(`send-nurture-diagnostico-email: día2 falló para lead ${lead.id}: ${sent.error}`);
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
      console.error(`send-nurture-diagnostico-email: día5 falló para lead ${lead.id}: ${sent.error}`);
    }
  }

  return result;
}
