// supabase/functions/_shared/emailLayout.ts
//
// Sistema visual único de los correos de la app (auditoría 360, BRD-5),
// actualizado al libro de marca de moyiq (17-nov-2026) y, desde el 26-nov-2026,
// a la regla del 23-nov: Impulso es el único degradado de marca en toda
// superficie a sangre. Cabecera con la banda Impulso y el logo blanco, línea
// lima, tarjeta blanca sobre fondo gris muy claro y pie lavanda.
//
// Reglas de marca que respeta:
//   - Cabecera: Impulso linear-gradient(74deg, #2D1D59, #8620D0 59%, #7A21FF)
//     con bgcolor y background-color #3C2282 de respaldo (Outlook de Windows y
//     los clientes sin degradados la ven morada plana, igual de legible). Todo
//     lo que va encima es blanco: logo PNG blanco con transparencia (v3) y la
//     etiqueta de sección. Nada de lima chica sobre Impulso.
//   - Lima solo como acento: la línea de 3 px bajo la cabecera. Nunca como
//     texto (ni chico sobre Impulso ni sobre fondo claro).
//   - Morado #3C2282 = títulos, enlaces y acción principal (botón con texto
//     blanco, 12,05:1). Se prefiere a violeta #7A21FF (6,01:1) porque es el rol
//     "acción principal" de tokens.css y el de más contraste; el violeta queda
//     dentro del degradado.
//   - Verde y rojo solo para estado de dato, nunca como acento.
//   - Radios de 8 px, nunca píldora. Sin sombras.
//   - Modo oscuro: los clientes que respetan prefers-color-scheme (Apple Mail,
//     Outlook de Mac/iOS, Thunderbird) reciben la paleta grafito de la app (D6)
//     con la misma cabecera Impulso; el resto aplica su propia inversión, y
//     como el logo es blanco sobre transparente sigue legible sobre cualquier
//     fondo oscuro. Los pares de color están en EMAIL_CONTRAST_PAIRS y
//     emailLayout.test.ts exige el mínimo WCAG de cada uno.
//   - Inter si el cliente la tiene; si no, la fuente del sistema (system-ui).
//     Gmail no carga fuentes propias.
//
// Uso: emailLayout({ lang, bodyHtml, footerHtml, preheader }) envuelve el
// contenido; emailButton(href, label) es la única llamada a la acción (una por
// correo); brandEmailBody() impone colores y tipografía a títulos y enlaces.

export const EMAIL_BRAND = {
  brand: "#3C2282",
  brandDeep: "#1E1044",
  violet: "#7A21FF",
  accent: "#D0F06E",
  bg: "#FAFAFA",
  card: "#FFFFFF",
  tint: "#F4F1FB",
  tintDeep: "#E6E0F5",
  onBrand: "#FFFFFF",
  ink: "#1C1D21",
  muted: "#6B6F78",
  pos: "#0E7A50",
  neg: "#C2272D",
} as const;

// Impulso (branding/CLAUDE.md, 23-nov-2026). Las paradas sirven también para
// comprobar el contraste del blanco en todo el ancho de la banda.
export const IMPULSO_STOPS = ["#2D1D59", "#8620D0", "#7A21FF"] as const;
export const IMPULSO_GRADIENT = "linear-gradient(74deg,#2D1D59 0%,#8620D0 59%,#7A21FF 100%)";

// Paleta del modo oscuro (tokens.css, [data-theme="dark"], D6): grafito de
// fondo, superficie 800, texto gris 50, acento morado 200/300.
export const EMAIL_DARK = {
  bg: "#1C1D21",
  card: "#2A2C31",
  foot: "#1C1D21",
  ink: "#FAFAFA",
  muted: "#A3A7AE",
  brandText: "#CBBFEA",
  button: "#A897DA",
  onButton: "#1C1D21",
  tint: "#383645",
  pos: "#47C292",
  neg: "#F09598",
} as const;

// Contraste WCAG 2.x entre dos colores hex (#RRGGBB).
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = hex.replace("#", "");
    const ch = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Todos los pares texto/fondo que usan los correos. min: 4,5 para texto normal
// y 3 para texto grande (≥ 24 px, o ≥ 18,66 px en negrita) o elementos no
// textuales. Los prueba emailLayout.test.ts.
export const EMAIL_CONTRAST_PAIRS: { name: string; fg: string; bg: string; min: number }[] = [
  ...IMPULSO_STOPS.map((bg) => ({ name: `blanco (logo, etiqueta) sobre Impulso ${bg}`, fg: "#FFFFFF", bg, min: 4.5 })),
  { name: "blanco sobre el respaldo plano de la cabecera", fg: "#FFFFFF", bg: EMAIL_BRAND.brand, min: 4.5 },
  { name: "texto principal sobre tarjeta", fg: EMAIL_BRAND.ink, bg: EMAIL_BRAND.card, min: 4.5 },
  { name: "títulos y enlaces morados sobre tarjeta", fg: EMAIL_BRAND.brand, bg: EMAIL_BRAND.card, min: 4.5 },
  { name: "texto secundario sobre tarjeta", fg: EMAIL_BRAND.muted, bg: EMAIL_BRAND.card, min: 4.5 },
  { name: "texto del pie sobre lavanda", fg: EMAIL_BRAND.muted, bg: EMAIL_BRAND.tint, min: 4.5 },
  { name: "enlaces del pie sobre lavanda", fg: EMAIL_BRAND.brand, bg: EMAIL_BRAND.tint, min: 4.5 },
  { name: "clave/código morado sobre lavanda", fg: EMAIL_BRAND.brand, bg: EMAIL_BRAND.tint, min: 4.5 },
  { name: "botón: blanco sobre morado", fg: EMAIL_BRAND.onBrand, bg: EMAIL_BRAND.brand, min: 4.5 },
  { name: "botón contra la tarjeta (borde del componente)", fg: EMAIL_BRAND.brand, bg: EMAIL_BRAND.card, min: 3 },
  { name: "dato positivo sobre tarjeta", fg: EMAIL_BRAND.pos, bg: EMAIL_BRAND.card, min: 4.5 },
  { name: "dato negativo sobre tarjeta", fg: EMAIL_BRAND.neg, bg: EMAIL_BRAND.card, min: 4.5 },
  { name: "[oscuro] texto principal sobre superficie", fg: EMAIL_DARK.ink, bg: EMAIL_DARK.card, min: 4.5 },
  { name: "[oscuro] títulos y enlaces sobre superficie", fg: EMAIL_DARK.brandText, bg: EMAIL_DARK.card, min: 4.5 },
  { name: "[oscuro] texto secundario sobre superficie", fg: EMAIL_DARK.muted, bg: EMAIL_DARK.card, min: 4.5 },
  { name: "[oscuro] texto del pie sobre grafito", fg: EMAIL_DARK.muted, bg: EMAIL_DARK.foot, min: 4.5 },
  { name: "[oscuro] enlaces del pie sobre grafito", fg: EMAIL_DARK.brandText, bg: EMAIL_DARK.foot, min: 4.5 },
  { name: "[oscuro] clave/código sobre tinte", fg: EMAIL_DARK.brandText, bg: EMAIL_DARK.tint, min: 4.5 },
  { name: "[oscuro] botón: grafito sobre morado 300", fg: EMAIL_DARK.onButton, bg: EMAIL_DARK.button, min: 4.5 },
  { name: "[oscuro] botón contra la superficie", fg: EMAIL_DARK.button, bg: EMAIL_DARK.card, min: 3 },
  { name: "[oscuro] dato positivo sobre superficie", fg: EMAIL_DARK.pos, bg: EMAIL_DARK.card, min: 4.5 },
  { name: "[oscuro] dato negativo sobre superficie", fg: EMAIL_DARK.neg, bg: EMAIL_DARK.card, min: 4.5 },
];

export const EMAIL_FONTS = {
  display: "Inter,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  body: "Inter,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  mono: "ui-monospace,Menlo,Consolas,'Liberation Mono',monospace",
} as const;

// Logo horizontal BLANCO sobre TRANSPARENTE (288x100, 3x), servido por la
// propia app desde public/email/moyiq-logo-v3.png (emailLogo.test.ts). Va sobre
// la banda Impulso: un PNG con fondo opaco dejaría un rectángulo morado dentro
// del degradado. Se muestra a 96x33 (el libro de marca pide al menos 80 px de
// ancho; el v2 se veía a 75 px). v2 (blanco sobre #3C2282 opaco) y el viejo
// moyiq-logo.png quedan intactos para los correos ya enviados. La app debe
// desplegarse antes que las funciones para que el archivo v3 exista.
export const EMAIL_LOGO_URL = "https://app.moyiq.app/app/email/moyiq-logo-v3.png";
export const EMAIL_LOGO_SIZE = { width: 96, height: 33 } as const;

// Línea legal de los pies transaccionales (facturación, reporte): quién está
// detrás del servicio y cómo contactarlo. Mismo texto que optin y cancelación;
// el nombre de la LLC es el de legalMeta.js (OPERATOR). HTML ya escapado.
export const EMAIL_LEGAL_LINE = `moyiq · MAXNOVA &amp; LUCI Global LLC · <a href="mailto:support@moyiq.app">support@moyiq.app</a>`;

export const EMAIL_LINK_STYLE =`color:${EMAIL_BRAND.brand};text-decoration:underline`;
export const EMAIL_MUTED_STYLE = `color:${EMAIL_BRAND.muted};font-size:13px`;
export const EMAIL_H_STYLE = `font-family:${EMAIL_FONTS.display};color:${EMAIL_BRAND.brand};font-weight:600;font-size:20px;line-height:1.25;margin:0 0 12px`;

// Botón "a prueba de clientes": tabla con la celda pintada (bgcolor +
// background-color) y el enlace con su propio relleno, así el área entera se ve
// aunque el cliente ignore el padding del <a> (Outlook de Windows usa
// mso-padding-alt de la celda). Morado con texto blanco; en oscuro, morado 300
// con texto grafito (clase mq-btn). Un solo botón por correo.
const BUTTON_LINK_STYLE = [
  "display:inline-block",
  "padding:14px 24px",
  `background-color:${EMAIL_BRAND.brand}`,
  `color:${EMAIL_BRAND.onBrand}`,
  `font-family:${EMAIL_FONTS.body}`,
  "font-size:16px",
  "line-height:20px",
  "font-weight:600",
  "text-decoration:none",
  "border-radius:8px",
  "mso-padding-alt:0",
].join(";");

export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0"><tr><td class="mq-btn" align="center" bgcolor="${EMAIL_BRAND.brand}" style="background-color:${EMAIL_BRAND.brand};border-radius:8px;mso-padding-alt:14px 24px"><a class="mq-btn" href="${href}" target="_blank" style="${BUTTON_LINK_STYLE}">${label}</a></td></tr></table>`;
}

export function emailHeading(text: string): string {
  return `<h1 style="${EMAIL_H_STYLE}">${text}</h1>`;
}

// Bloque destacado para un dato a copiar (clave de licencia, código).
export function emailCode(text: string): string {
  return `<p class="mq-code" style="font-family:${EMAIL_FONTS.mono};font-size:20px;font-weight:600;letter-spacing:1px;color:${EMAIL_BRAND.brand};background:${EMAIL_BRAND.tint};border:1px solid ${EMAIL_BRAND.tintDeep};border-radius:8px;padding:14px 16px;text-align:center;margin:16px 0">${text}</p>`;
}

const HEADING_STYLE: Record<string, string> = {
  h1: `font-family:${EMAIL_FONTS.display};color:${EMAIL_BRAND.brand};font-weight:600;font-size:22px;line-height:1.2;margin:0 0 12px`,
  h2: `font-family:${EMAIL_FONTS.display};color:${EMAIL_BRAND.brand};font-weight:600;font-size:19px;line-height:1.25;margin:0 0 12px`,
  h3: `font-family:${EMAIL_FONTS.display};color:${EMAIL_BRAND.brand};font-weight:600;font-size:16px;line-height:1.3;margin:20px 0 6px`,
};

// Impone la marca a títulos y enlaces del contenido. Idempotente: un enlace
// con color propio (un botón) no se toca; los títulos se reescriben siempre.
export function brandEmailBody(html: string): string {
  return String(html ?? "")
    .replace(/<(h[123])(\s[^>]*)?>/gi, (_all, name: string) => `<${name} style="${HEADING_STYLE[name.toLowerCase()]}">`)
    .replace(/<a\b([^>]*)>/gi, (tag: string, attrs: string) => {
      if (/style\s*=\s*["'][^"']*color\s*:/i.test(attrs)) return tag;
      const clean = attrs.replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/i, "");
      return `<a${clean} style="${EMAIL_LINK_STYLE}">`;
    });
}

export interface EmailLayoutOptions {
  lang: string;
  bodyHtml: string;
  // Pie: texto legal, motivo del correo y baja (HTML ya armado).
  footerHtml?: string;
  // Texto oculto que muestran los clientes de correo junto al asunto.
  preheader?: string;
  title?: string;
  // Etiqueta corta a la derecha del logo (p. ej. "Invest").
  tag?: string;
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Relleno tras el preheader: evita que el cliente complete la vista previa con
// el texto del cuerpo (o con el alt del logo). Caracteres invisibles estándar.
const PREHEADER_PAD = "&#847;&zwnj;&nbsp;".repeat(40);

// CSS del <head>. Lo leen los clientes que soportan <style> y media queries;
// todo lo esencial va además en línea. El modo oscuro reescribe los colores
// claros conocidos por selector de atributo (style*="color:#3C2282"…), así
// cubre también el contenido de cada plantilla sin tocarlas una por una.
const D = EMAIL_DARK;
const B = EMAIL_BRAND;
// Dos bloques a propósito: Gmail descarta un <style> entero si encuentra algo
// que no soporta (los selectores de atributo del oscuro), y el primero, con lo
// responsivo, tiene que sobrevivir.
const BASE_CSS = `
body{margin:0;padding:0;-webkit-text-size-adjust:100%;text-size-adjust:100%}
table{border-collapse:collapse}
img{border:0;outline:none;text-decoration:none}
@media (max-width:620px){
.mq-card{width:100%!important}
.mq-pad{padding:24px 20px!important}
.mq-headpad{padding:20px!important}
.mq-footpad{padding:18px 20px!important}
}
`.trim();
const DARK_CSS = `
:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (prefers-color-scheme:dark){
.mq-bg{background:${D.bg}!important}
.mq-card{background:${D.card}!important}
.mq-body{color:${D.ink}!important}
.mq-foot{background:${D.foot}!important;color:${D.muted}!important}
.mq-body [style*="color:${B.ink}"]{color:${D.ink}!important}
.mq-body [style*="color:${B.brand}"],.mq-foot [style*="color:${B.brand}"]{color:${D.brandText}!important}
.mq-body [style*="color:${B.muted}"],.mq-foot [style*="color:${B.muted}"]{color:${D.muted}!important}
.mq-body [style*="color:${B.pos}"]{color:${D.pos}!important}
.mq-body [style*="color:${B.neg}"]{color:${D.neg}!important}
.mq-body [style*="background:${B.tint}"],.mq-body [style*="background-color:${B.tint}"]{background:${D.tint}!important}
.mq-body [style*="${B.tintDeep}"]{border-color:${D.tint}!important}
.mq-body td.mq-btn,.mq-body a.mq-btn{background:${D.button}!important;background-color:${D.button}!important;color:${D.onButton}!important}
.mq-head{background-color:${B.brand}!important;background-image:${IMPULSO_GRADIENT}!important}
.mq-head,.mq-head a,.mq-head td{color:#FFFFFF!important}
}
`.trim();

export function emailLayout(opts: EmailLayoutOptions): string {
  const { lang, bodyHtml, footerHtml, preheader, title, tag } = opts;
  const pre = preheader
    ? `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${EMAIL_BRAND.bg}">${escapeText(preheader)}${PREHEADER_PAD}</div>`
    : "";
  const tagCell = tag
    ? `<td align="right" valign="middle" style="font-family:${EMAIL_FONTS.body};font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#FFFFFF">${escapeText(tag)}</td>`
    : "";
  const footer = footerHtml
    ? `<tr><td class="mq-foot mq-footpad" style="padding:20px 28px;background:${EMAIL_BRAND.tint};font-family:${EMAIL_FONTS.body};font-size:12px;line-height:1.5;color:${EMAIL_BRAND.muted}">${brandEmailBody(footerHtml)}</td></tr>`
    : "";
  const { width: LW, height: LH } = EMAIL_LOGO_SIZE;
  return `<!doctype html>
<html lang="${escapeText(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><meta name="format-detection" content="telephone=no,date=no,address=no,email=no"><title>${escapeText(title ?? "moyiq")}</title><style>${BASE_CSS}</style><style>${DARK_CSS}</style></head>
<body class="mq-bg" style="margin:0;padding:0;background:${EMAIL_BRAND.bg}">
${pre}
<table class="mq-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${EMAIL_BRAND.bg}" style="background:${EMAIL_BRAND.bg}">
<tr><td align="center" style="padding:24px 12px">
<table class="mq-card" role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="${EMAIL_BRAND.card}" style="width:600px;max-width:100%;background:${EMAIL_BRAND.card};border-radius:10px;overflow:hidden">
<tr><td class="mq-head mq-headpad" bgcolor="${EMAIL_BRAND.brand}" style="background-color:${EMAIL_BRAND.brand};background-image:${IMPULSO_GRADIENT};padding:24px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td align="left" valign="middle"><a href="https://moyiq.app" style="text-decoration:none;color:#FFFFFF"><img src="${EMAIL_LOGO_URL}" width="${LW}" height="${LH}" alt="moyiq" style="display:block;border:0;outline:none;width:${LW}px;height:${LH}px;color:#FFFFFF;font-family:${EMAIL_FONTS.display};font-size:24px;font-weight:600;line-height:${LH}px"></a></td>
${tagCell}
</tr></table>
</td></tr>
<tr><td bgcolor="${EMAIL_BRAND.accent}" style="height:3px;line-height:3px;font-size:0;background:${EMAIL_BRAND.accent}">&nbsp;</td></tr>
<tr><td class="mq-body mq-pad" lang="${escapeText(lang)}" style="padding:32px 28px;font-family:${EMAIL_FONTS.body};font-size:16px;line-height:1.6;color:${EMAIL_BRAND.ink}">
${brandEmailBody(bodyHtml)}
</td></tr>
${footer}
</table>
</td></tr>
</table>
</body></html>`;
}
