// supabase/functions/send-nurture-invest-email/nurtureEmailLogic.ts
//
// Lógica pura de la secuencia de 3 emails de nurture para el lead magnet de
// Invest ("Perfil de Inversor", perfil-inversor.html → invest_leads) —
// pedido explícito de Walter, 14-sep-2026, calcada de
// send-nurture-starter-email/nurtureEmailLogic.ts. Quien recibe esto es un
// lead (no todavía usuario de Invest) que ya sabe su perfil de riesgo — el
// objetivo del email 1 es que cree cuenta en /app, no repetirle el quiz.
//
// Separada de index.ts por el mismo motivo que las otras nurture: index.ts
// lee Deno.env.get() a nivel de módulo y no se puede importar desde
// Node/vitest.
//
// Remitente: "moyiq Inversiones <invest@moyiq.app>" (INVEST_SENDER_NAME) — mismo dominio raíz
// (moyiq.app) ya verificado en Resend, usado hoy por auth-email-hook. No
// hace falta configurar nada nuevo ahí.
//
// Secret de Resend: usa NURTURE_RESEND_API_KEY (mismo secret que usan
// send-nurture-starter-email y send-nurture-diagnostico-email) — NO
// RESEND_API_KEY, que está scopeado a otro remitente y devuelve 403 (ver
// comentario en supabase/functions/auth-email-hook/index.ts).
//
// consent_marketing: desde el relanzamiento v2 (migración 20261009000100) el
// default es false y register_invest_lead guarda la casilla del quiz
// (p_consent_marketing). Los leads anteriores al 2026-10-08 quedaron marcados
// como enviados y sin consentimiento.
//
// Doble opt-in (10-oct-2026): los emails 2 y 3 son marketing y exigen
// consent_marketing=true Y consent_confirmed_at no nulo (columna agregada en
// 20261010010000_marketing_double_optin.sql). Mientras invest-web no mande el
// correo de confirmación (send-optin-confirmation) tras el quiz, ninguna fila
// queda elegible: la secuencia 2/3 de Invest está apagada en la práctica. El
// email 1 (el RESULTADO del quiz que la persona pidió) es transaccional y se
// manda siempre.

export type NurtureMode = "welcome" | "day2" | "day5";
export type Perfil = "conservador" | "moderado" | "agresivo";

export interface InvestLead {
  email1_sent_at?: string | null;
  unsubscribed_at?: string | null;
  id: string;
  email: string;
  perfil: Perfil | null;
  // invest_leads.lang (migración 20261019210000). Sin dato o desconocido: es.
  lang?: string | null;
}

export interface NurtureEmailConfig {
  supabaseUrl: string;
  serviceRole: string;
  resendApiKey?: string;
  fromEmail: string; // "moyiq Inversiones <invest@moyiq.app>"
  cronSecret?: string;
  // Base de los botones: la sección Inversiones de la app (C6 de la auditoría
  // de branding, 23-nov-2026). Hasta entonces apuntaban a invest.moyiq.app,
  // el sitio aparte con su propio login. Ver investCtaUrl.
  landingUrl: string; // DEFAULT_INVEST_APP_URL
  // Base del link de baja. La página unsubscribe.html vive en la landing de
  // moyiq (moyiq.app), no en invest-web: hasta el 18-oct-2026 el link
  // apuntaba a invest.moyiq.app/unsubscribe.html y daba 404.
  unsubscribeBaseUrl?: string;
}

// Destino por defecto de los botones (env INVEST_APP_URL en index.ts).
export const DEFAULT_INVEST_APP_URL = "https://app.moyiq.app/app/?open=invest-resumen";

// Botón de un correo: la base configurada con su ?open= (o el pedido, p. ej.
// invest-planificar en el día 2) y el ref= del correo. Los utm_* y demás
// parámetros que traiga la base se conservan. Base inválida: la de defecto.
export function investCtaUrl(config: Pick<NurtureEmailConfig, "landingUrl">, ref: string, open?: string): string {
  let url: URL;
  try {
    url = new URL(config.landingUrl || DEFAULT_INVEST_APP_URL);
  } catch {
    url = new URL(DEFAULT_INVEST_APP_URL);
  }
  if (open) url.searchParams.set("open", open);
  else if (!url.searchParams.has("open")) url.searchParams.set("open", "invest-resumen");
  url.searchParams.set("ref", ref);
  url.hash = "";
  return url.toString();
}

export function unsubscribeUrl(config: NurtureEmailConfig, leadId: string): string {
  // t=invest selecciona el RPC unsubscribe_invest_lead en unsubscribe.html
  // (mismo patrón multi-tabla que ya soporta starter/diagnostico).
  return `${(config.unsubscribeBaseUrl ?? "https://moyiq.app").replace(/\/$/, "")}/unsubscribe.html?id=${encodeURIComponent(leadId)}&t=invest`;
}

// Pie de los 3 correos (relanzamiento v2, oct-2026): disclaimer, nombre del
// sitio, dirección de la LLC y baja. Desde el 18-nov-2026 en los 4 idiomas
// (antes solo español aunque invest_leads.lang existía).
export const DISCLAIMERS: Record<EmailLang, string> = {
  es: "Herramienta educativa. No es asesoría financiera ni ejecuta órdenes.",
  en: "Educational tool. It is not financial advice and does not execute orders.",
  pt: "Ferramenta educativa. Não é assessoria financeira nem executa ordens.",
  de: "Ein Werkzeug zum Lernen. Keine Finanzberatung und keine Ausführung von Aufträgen.",
};
export const DISCLAIMER = DISCLAIMERS.es;

const UNSUBSCRIBE: Record<EmailLang, string> = {
  es: "Darme de baja de estos correos",
  en: "Unsubscribe from these emails",
  pt: "Cancelar a inscrição nestes e-mails",
  de: "Von diesen E-Mails abmelden",
};

// Sistema visual único de los correos (BRD-5): el layout de marca de moyiq
// con la etiqueta de la sección ("Inversiones", "Investments"…) junto al logo.
function wrapHtml(bodyHtml: string, unsubUrl: string, lang: EmailLang): string {
  return emailLayout({
    lang,
    tag: INVEST_LABEL[lang],
    bodyHtml,
    footerHtml: `${DISCLAIMERS[lang]}<br>
          ${investSiteName(lang)} · ${COMPANY_POSTAL_HTML}.
          <a href="${unsubUrl}">${UNSUBSCRIBE[lang]}</a>.`,
  });
}

export interface RenderedEmail {
  subject: string;
  html: string;
  // Parte de texto plano, derivada del HTML (_shared/emailText.ts).
  text?: string;
  headers?: Record<string, string>;
}

// Relanzamiento v2 (beta pública gratuita, oct-2026): el copy describe el
// perfil según las respuestas del quiz, sin sugerir un mix ni recomendar
// activos. Nada de planes pagos, precios, "tiempo real" ni puntajes.
const PROFILE_COPY: Record<EmailLang, Record<Perfil, { name: string; desc: string }>> = {
  es: {
    conservador: { name: "Conservador", desc: "Según tus respuestas, priorizas preservar tu capital por sobre el crecimiento y toleras poco las caídas de valor." },
    moderado: { name: "Moderado", desc: "Según tus respuestas, buscas un balance entre crecimiento y estabilidad y toleras caídas de valor moderadas." },
    agresivo: { name: "Agresivo", desc: "Según tus respuestas, priorizas el crecimiento, tienes un horizonte largo y toleras caídas de valor más fuertes." },
  },
  en: {
    conservador: { name: "Conservative", desc: "Based on your answers, you put preserving your capital ahead of growth and have little tolerance for drops in value." },
    moderado: { name: "Moderate", desc: "Based on your answers, you look for a balance between growth and stability and tolerate moderate drops in value." },
    agresivo: { name: "Aggressive", desc: "Based on your answers, you put growth first, have a long horizon and tolerate larger drops in value." },
  },
  pt: {
    conservador: { name: "Conservador", desc: "Pelas suas respostas, você prioriza preservar seu capital em vez do crescimento e tolera pouco as quedas de valor." },
    moderado: { name: "Moderado", desc: "Pelas suas respostas, você busca um equilíbrio entre crescimento e estabilidade e tolera quedas de valor moderadas." },
    agresivo: { name: "Arrojado", desc: "Pelas suas respostas, você prioriza o crescimento, tem um horizonte longo e tolera quedas de valor maiores." },
  },
  de: {
    conservador: { name: "Konservativ", desc: "Nach Ihren Antworten ist Ihnen der Erhalt Ihres Kapitals wichtiger als Wachstum, und Wertverluste tolerieren Sie kaum." },
    moderado: { name: "Ausgewogen", desc: "Nach Ihren Antworten suchen Sie ein Gleichgewicht zwischen Wachstum und Stabilität und tolerieren moderate Wertverluste." },
    agresivo: { name: "Wachstumsorientiert", desc: "Nach Ihren Antworten steht für Sie Wachstum im Vordergrund, Sie haben einen langen Anlagehorizont und tolerieren größere Wertverluste." },
  },
};

interface InvestCopy {
  welcomeSubject: (profile: string) => string;
  welcomeHeading: (profile: string) => string;
  hello: string;
  orientative: string;
  welcomeBeta: string;
  open: string;
  welcomeNote: string;
  day2Subject: string;
  day2Heading: string;
  day2Body: string;
  day2Math: string;
  day2Button: string;
  day2Note: string;
  day5Subject: string;
  day5Heading: string;
  day5Intro: string;
  day5Items: string[];
  day5Tool: string;
  day5Note: string;
}

// Regla de nombre (D14): "moyiq · Inversiones" es el nombre del sitio
// (investSiteName); en prosa, "las Inversiones de moyiq". Una frase nunca
// empieza con "moyiq" en minúscula.
const COPY: Record<EmailLang, InvestCopy> = {
  es: {
    welcomeSubject: (p) => `Tu perfil: ${p}`,
    welcomeHeading: (p) => `Tu perfil es ${p}`,
    hello: "Hola,",
    orientative: "Es un resultado orientativo, no una recomendación de inversión. Sirve para leer tus propias decisiones con más contexto.",
    welcomeBeta: "Las Inversiones de moyiq están abiertas como beta pública gratuita. Puedes registrar tus posiciones, ver precios de Yahoo Finance con la hora del último dato y revisar cada indicador con su rango y una lectura simple.",
    open: `Abrir ${investSiteName("es")}`,
    welcomeNote: "Durante la beta todas las funciones están abiertas para todos, sin tarjeta.",
    day2Subject: "Cuánto arriesgar por operación, con tu regla de riesgo",
    day2Heading: "Con tu regla de riesgo",
    day2Body: `En el <strong>Position Builder</strong> de ${investSiteName("es")} ingresas el ticker, tu capital y el precio de tu stop loss. Con tu regla de riesgo, por ejemplo no arriesgar más del 2% del capital en una sola operación, calcula cuántas unidades corresponden para que, si el precio llega al stop, la pérdida no supere ese límite.`,
    day2Math: "Es un cálculo aritmético: no evalúa si la operación conviene ni sugiere comprar o vender. La decisión es tuya.",
    day2Button: "Abrir el Position Builder",
    day2Note: "Las Inversiones de moyiq están en beta pública gratuita. Si todavía no creaste tu cuenta, puedes hacerlo desde el mismo enlace.",
    day5Subject: `Qué incluye la beta pública de ${investSiteName("es")}`,
    day5Heading: "Qué puedes usar durante la beta",
    day5Intro: "Las Inversiones de moyiq están en beta pública gratuita: todas las funciones están abiertas para todos, sin tarjeta. Esto es lo que puedes usar hoy:",
    day5Items: [
      "Seguimiento de tus posiciones",
      "Precios de Yahoo Finance con retraso, con la hora del último dato visible",
      "Indicadores (RSI, MACD, Bandas de Bollinger), cada uno con su rango y una lectura simple",
      "Position Builder con tu regla de riesgo",
      "Comparador de activos",
      "Alertas de precio",
    ],
    day5Tool: "La herramienta ordena tu información y explica cada dato. No te dice qué comprar ni vender, y no está conectada a ningún broker.",
    day5Note: "Si no te sirve ahora, puedes darte de baja con el enlace de abajo.",
  },
  en: {
    welcomeSubject: (p) => `Your profile: ${p}`,
    welcomeHeading: (p) => `Your profile is ${p}`,
    hello: "Hi,",
    orientative: "This is an indicative result, not an investment recommendation. It helps you read your own decisions with more context.",
    welcomeBeta: "The investments section of moyiq is open as a free public beta. You can record your positions, see Yahoo Finance prices with the time of the latest data point and review each indicator with its range and a plain reading.",
    open: `Open ${investSiteName("en")}`,
    welcomeNote: "During the beta every feature is open to everyone, no card required.",
    day2Subject: "How much to risk per trade, with your risk rule",
    day2Heading: "With your risk rule",
    day2Body: `In the <strong>Position Builder</strong> of ${investSiteName("en")} you enter the ticker, your capital and your stop-loss price. With your risk rule, for example never risking more than 2% of your capital on a single trade, it works out how many units fit so that, if the price reaches the stop, the loss stays within that limit.`,
    day2Math: "It is plain arithmetic: it doesn't judge whether the trade is worth it or suggest buying or selling. The decision is yours.",
    day2Button: "Open the Position Builder",
    day2Note: "The investments section of moyiq is in free public beta. If you haven't created your account yet, you can do it from the same link.",
    day5Subject: `What the ${investSiteName("en")} public beta includes`,
    day5Heading: "What you can use during the beta",
    day5Intro: "The investments section of moyiq is in free public beta: every feature is open to everyone, no card required. This is what you can use today:",
    day5Items: [
      "Tracking of your positions",
      "Delayed Yahoo Finance prices, with the time of the latest data point shown",
      "Indicators (RSI, MACD, Bollinger Bands), each with its range and a plain reading",
      "Position Builder with your risk rule",
      "Asset comparison",
      "Price alerts",
    ],
    day5Tool: "The tool organizes your information and explains each data point. It doesn't tell you what to buy or sell, and it isn't connected to any broker.",
    day5Note: "If it isn't useful right now, you can unsubscribe with the link below.",
  },
  pt: {
    welcomeSubject: (p) => `Seu perfil: ${p}`,
    welcomeHeading: (p) => `Seu perfil é ${p}`,
    hello: "Olá,",
    orientative: "É um resultado orientativo, não uma recomendação de investimento. Serve para ler suas próprias decisões com mais contexto.",
    welcomeBeta: "Os Investimentos do moyiq estão abertos como beta pública gratuita. Você pode registrar suas posições, ver preços do Yahoo Finance com o horário do último dado e revisar cada indicador com sua faixa e uma leitura simples.",
    open: `Abrir ${investSiteName("pt")}`,
    welcomeNote: "Durante a beta, todas as funções estão abertas para todos, sem cartão.",
    day2Subject: "Quanto arriscar por operação, com sua regra de risco",
    day2Heading: "Com sua regra de risco",
    day2Body: `No <strong>Position Builder</strong> do ${investSiteName("pt")} você informa o ticker, seu capital e o preço do seu stop loss. Com sua regra de risco, por exemplo não arriscar mais de 2% do capital em uma única operação, ele calcula quantas unidades cabem para que, se o preço chegar ao stop, a perda não passe desse limite.`,
    day2Math: "É um cálculo aritmético: não avalia se a operação vale a pena nem sugere comprar ou vender. A decisão é sua.",
    day2Button: "Abrir o Position Builder",
    day2Note: "Os Investimentos do moyiq estão em beta pública gratuita. Se você ainda não criou sua conta, pode fazer isso pelo mesmo link.",
    day5Subject: `O que inclui a beta pública do ${investSiteName("pt")}`,
    day5Heading: "O que você pode usar durante a beta",
    day5Intro: "Os Investimentos do moyiq estão em beta pública gratuita: todas as funções estão abertas para todos, sem cartão. Isto é o que você pode usar hoje:",
    day5Items: [
      "Acompanhamento das suas posições",
      "Preços do Yahoo Finance com atraso, com o horário do último dado visível",
      "Indicadores (RSI, MACD, Bandas de Bollinger), cada um com sua faixa e uma leitura simples",
      "Position Builder com sua regra de risco",
      "Comparador de ativos",
      "Alertas de preço",
    ],
    day5Tool: "A ferramenta organiza suas informações e explica cada dado. Não diz o que comprar ou vender e não está conectada a nenhuma corretora.",
    day5Note: "Se não for útil agora, você pode cancelar a inscrição pelo link abaixo.",
  },
  de: {
    welcomeSubject: (p) => `Ihr Profil: ${p}`,
    welcomeHeading: (p) => `Ihr Profil: ${p}`,
    hello: "Hallo,",
    orientative: "Das Ergebnis dient der Orientierung und ist keine Anlageempfehlung. Es hilft Ihnen, Ihre eigenen Entscheidungen besser einzuordnen.",
    welcomeBeta: "Der Investmentbereich von moyiq ist als kostenlose öffentliche Beta geöffnet. Sie können Ihre Positionen erfassen, Kurse von Yahoo Finance mit der Uhrzeit des letzten Datenpunkts sehen und jeden Indikator mit seinem Wertebereich und einer einfachen Einordnung prüfen.",
    // Un botón no empieza con "moyiq" en minúscula: se nombra la sección.
    open: "Investmentbereich öffnen",
    welcomeNote: "Während der Beta sind alle Funktionen für alle freigeschaltet, ohne Kreditkarte.",
    day2Subject: "Wie viel pro Trade riskieren, nach Ihrer Risikoregel",
    day2Heading: "Nach Ihrer Risikoregel",
    day2Body: `Im <strong>Position Builder</strong> von ${investSiteName("de")} geben Sie den Ticker, Ihr Kapital und den Kurs Ihres Stop-Loss ein. Mit Ihrer Risikoregel, zum Beispiel nie mehr als 2 % des Kapitals in einem einzelnen Trade zu riskieren, berechnet er, wie viele Einheiten passen, damit der Verlust diese Grenze nicht überschreitet, wenn der Kurs den Stop erreicht.`,
    day2Math: "Das ist reine Arithmetik: Es wird weder bewertet, ob sich der Trade lohnt, noch ein Kauf oder Verkauf vorgeschlagen. Die Entscheidung liegt bei Ihnen.",
    day2Button: "Position Builder öffnen",
    day2Note: "Der Investmentbereich von moyiq ist in einer kostenlosen öffentlichen Beta. Falls Sie noch kein Konto haben, können Sie es über denselben Link anlegen.",
    day5Subject: `Was die öffentliche Beta von ${investSiteName("de")} umfasst`,
    day5Heading: "Was Sie während der Beta nutzen können",
    day5Intro: "Der Investmentbereich von moyiq ist in einer kostenlosen öffentlichen Beta: Alle Funktionen sind für alle freigeschaltet, ohne Kreditkarte. Das können Sie heute nutzen:",
    day5Items: [
      "Verfolgung Ihrer Positionen",
      "Verzögerte Kurse von Yahoo Finance, mit sichtbarer Uhrzeit des letzten Datenpunkts",
      "Indikatoren (RSI, MACD, Bollinger-Bänder), jeweils mit Wertebereich und einfacher Einordnung",
      "Position Builder mit Ihrer Risikoregel",
      "Vergleich von Anlagen",
      "Kursalarme",
    ],
    day5Tool: "Das Werkzeug ordnet Ihre Informationen und erklärt jeden Wert. Es sagt Ihnen nicht, was Sie kaufen oder verkaufen sollen, und ist mit keinem Broker verbunden.",
    day5Note: "Wenn es Ihnen gerade nicht weiterhilft, können Sie sich über den Link unten abmelden.",
  },
};

export function renderEmail(mode: NurtureMode, lead: InvestLead, config: NurtureEmailConfig): RenderedEmail {
  const lang = pickLang(lead.lang);
  const T = COPY[lang];
  const unsub = unsubscribeUrl(config, lead.id);
  const profile = PROFILE_COPY[lang][lead.perfil ?? "moderado"];
  const headers = listUnsubscribeHeaders(config.supabaseUrl, "invest", lead.id);
  const done = (subject: string, body: string): RenderedEmail => {
    const html = wrapHtml(body, unsub, lang);
    return { subject, html, text: htmlToText(html), headers };
  };

  if (mode === "welcome") {
    return done(T.welcomeSubject(profile.name), `
      <h2>${T.welcomeHeading(profile.name)}</h2>
      <p>${T.hello}</p>
      <p>${profile.desc}</p>
      <p>${T.orientative}</p>
      <p>${T.welcomeBeta}</p>
      ${emailButton(investCtaUrl(config, "invest-welcome"), T.open)}
      <p style="${EMAIL_MUTED_STYLE}">${T.welcomeNote}</p>
      `);
  }

  if (mode === "day2") {
    return done(T.day2Subject, `
      <h2>${T.day2Heading}</h2>
      <p>${T.hello}</p>
      <p>${T.day2Body}</p>
      <p>${T.day2Math}</p>
      ${emailButton(investCtaUrl(config, "invest-d2", "invest-planificar"), T.day2Button)}
      <p style="${EMAIL_MUTED_STYLE}">${T.day2Note}</p>
      `);
  }

  // day5
  return done(T.day5Subject, `
    <h2>${T.day5Heading}</h2>
    <p>${T.hello}</p>
    <p>${T.day5Intro}</p>
    <p>
    ${T.day5Items.map((i) => `— ${i}`).join("<br>\n    ")}</p>
    <p>${T.day5Tool}</p>
    ${emailButton(investCtaUrl(config, "invest-d5"), T.open)}
    <p style="${EMAIL_MUTED_STYLE}">${T.day5Note}</p>
    `);
}

// --- Envío con reintento (mismo patrón que las otras nurture) ---------------

export async function sendViaResend(
  to: string,
  rendered: RenderedEmail,
  config: NurtureEmailConfig,
): Promise<{ ok: boolean; error?: string }> {
  if (!config.resendApiKey) return { ok: false, error: "resend_not_configured" };

  const body = { from: config.fromEmail, to, subject: rendered.subject, html: rendered.html, text: rendered.text ?? htmlToText(rendered.html), ...(rendered.headers ? { headers: rendered.headers } : {}) };
  const attempt = () =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  let res = await attempt();
  if (!res.ok) {
    console.warn(`send-nurture-invest-email: intento 1 falló (${res.status}) — reintentando`);
    res = await attempt();
  }
  if (!res.ok) {
    const text = await res.text();
    console.error(`send-nurture-invest-email: Resend error tras reintento: ${res.status} ${text}`);
    return { ok: false, error: `resend_${res.status}: ${text}` };
  }
  return { ok: true };
}

// --- Consultas contra invest_leads (service role, REST) ----------------------

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

export async function fetchLeadById(id: string, config: NurtureEmailConfig): Promise<InvestLead | null> {
  const rows = await restGet<InvestLead[]>(
    `invest_leads?id=eq.${encodeURIComponent(id)}&select=id,email,perfil,email1_sent_at,unsubscribed_at,lang&limit=1`,
    config,
  );
  return rows[0] ?? null;
}

const BATCH_LIMIT = 200; // tope por corrida del cron — salvaguarda, no expectativa de tráfico real.

export async function fetchEligibleForEmail2(config: NurtureEmailConfig): Promise<InvestLead[]> {
  return restGet<InvestLead[]>(
    `invest_leads?select=id,email,perfil,lang` +
      `&unsubscribed_at=is.null&consent_marketing=is.true&consent_confirmed_at=not.is.null&account_created_at=is.null&email2_sent_at=is.null` +
      `&limit=${BATCH_LIMIT}`,
    config,
  );
}

// Email 3: solo si ya se mandó el 2 y pasaron >= 3 días desde ESE envío.
export async function fetchEligibleForEmail3(config: NurtureEmailConfig): Promise<InvestLead[]> {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  return restGet<InvestLead[]>(
    `invest_leads?select=id,email,perfil,lang` +
      `&unsubscribed_at=is.null&consent_marketing=is.true&consent_confirmed_at=not.is.null&account_created_at=is.null` +
      `&email3_sent_at=is.null&email2_sent_at=not.is.null&email2_sent_at=lte.${cutoff}` +
      `&limit=${BATCH_LIMIT}`,
    config,
  );
}

export async function markSent(leadId: string, mode: NurtureMode, config: NurtureEmailConfig): Promise<void> {
  const column = mode === "welcome" ? "email1_sent_at" : mode === "day2" ? "email2_sent_at" : "email3_sent_at";
  await restPatch(`invest_leads?id=eq.${encodeURIComponent(leadId)}`, { [column]: new Date().toISOString() }, config);
}

export interface CronRunResult {
  email2: { attempted: number; sent: number; failed: number };
  email3: { attempted: number; sent: number; failed: number };
}

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
      console.error(`send-nurture-invest-email: día2 falló para lead ${lead.id}: ${sent.error}`);
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
      console.error(`send-nurture-invest-email: día5 falló para lead ${lead.id}: ${sent.error}`);
    }
  }

  return result;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type WelcomeResult =
  | { ok: true; state?: "already_sent" | "unsubscribed" }
  | { ok: false; error: string };

// La bienvenida es transaccional (la pidió la persona al registrarse), pero
// sale una sola vez por fila y nunca a quien se dio de baja: antes cualquiera
// con el id de un lead podía dispararla de nuevo (auditoría 18-oct-2026).
// Mismo patrón que processWelcome de send-nurture-diagnostico-email.
export async function processWelcome(leadId: unknown, config: NurtureEmailConfig): Promise<WelcomeResult> {
  if (typeof leadId !== "string" || !UUID_RE.test(leadId)) return { ok: false, error: "invalid_lead_id" };
  const lead = await fetchLeadById(leadId, config);
  if (!lead) return { ok: false, error: "lead_not_found" };
  if (lead.email1_sent_at) return { ok: true, state: "already_sent" };
  if (lead.unsubscribed_at) return { ok: true, state: "unsubscribed" };
  const gate = await welcomeGate(
    "invest_leads",
    { id: lead.id, email: lead.email, email1_sent_at: lead.email1_sent_at ?? null, unsubscribed_at: lead.unsubscribed_at ?? null },
    { supabaseUrl: config.supabaseUrl, serviceRole: config.serviceRole },
  );
  if (gate === "unsubscribed") return { ok: true, state: "unsubscribed" };
  if (gate !== "send") return { ok: true, state: "already_sent" };
  const rendered = renderEmail("welcome", lead, config);
  const result = await sendViaResend(lead.email, rendered, config);
  if (!result.ok) {
    await releaseWelcome("invest_leads", lead.id, { supabaseUrl: config.supabaseUrl, serviceRole: config.serviceRole });
    return { ok: false, error: result.error ?? "send_failed" };
  }
  return { ok: true };
}
import { welcomeGate, releaseWelcome } from "../_shared/welcomeGuard.ts";
import { COMPANY_POSTAL_HTML, listUnsubscribeHeaders } from "../_shared/marketingEmail.ts";
import { emailButton, emailLayout, EMAIL_MUTED_STYLE } from "../_shared/emailLayout.ts";
import { htmlToText } from "../_shared/emailText.ts";
import { type EmailLang, pickLang } from "../_shared/emailLang.ts";
import { INVEST_LABEL, investSiteName } from "../_shared/emailSender.ts";
