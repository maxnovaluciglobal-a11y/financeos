// supabase/functions/_shared/emailLayout.ts
//
// Sistema visual único de los correos de la app (auditoría 360, BRD-5),
// actualizado al libro de marca de moyiq (rebranding Entrega 1, 17-nov-2026):
// cabecera morada con el logo, franja lima, tarjeta blanca sobre fondo gris
// muy claro y pie lavanda.
//
// Reglas de marca que respeta:
//   - Morado #3C2282 = estructura, títulos, enlaces y acción principal. Sobre
//     morado, texto blanco (contraste > 11:1).
//   - Lima solo como acento sobre morado (franja y etiqueta), nunca como texto
//     sobre fondo claro (no pasa contraste).
//   - Verde y rojo solo para estado de dato, nunca como acento.
//   - Radios chicos (8 px), nunca píldora. Sin sombras.
//   - Solo modo claro (la inversión automática estropea el logo).
//   - Inter si el cliente la tiene; si no, la fuente del sistema (system-ui).
//     Gmail no carga fuentes propias.
//
// Uso: emailLayout({ lang, bodyHtml, footerHtml }) envuelve el contenido;
// emailButton(href, label) es la única llamada a la acción; brandEmailBody()
// impone colores y tipografía a títulos y enlaces del contenido.

export const EMAIL_BRAND = {
  brand: "#3C2282",
  brandDeep: "#1E1044",
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

export const EMAIL_FONTS = {
  display: "Inter,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  body: "Inter,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  mono: "ui-monospace,Menlo,Consolas,'Liberation Mono',monospace",
} as const;

// Logo horizontal blanco sobre el morado de la cabecera (320x73, sin alfa),
// servido por la propia app desde public/email/moyiq-logo-v2.png
// (emailLogo.test.ts). Va en una URL nueva a propósito: public/email/moyiq-logo.png
// sigue siendo el logo anterior, el que muestran los correos ya enviados con
// cabecera Navy (entre ellos el de la licencia), y no se toca. La app debe
// desplegarse antes que las funciones para que el archivo v2 exista.
export const EMAIL_LOGO_URL = "https://app.moyiq.app/app/email/moyiq-logo-v2.png";
const LOGO_W = 160;
const LOGO_H = 37;

// Línea legal de los pies transaccionales (facturación, reporte): quién está
// detrás del servicio y cómo contactarlo. Mismo texto que optin y cancelación;
// el nombre de la LLC es el de legalMeta.js (OPERATOR). HTML ya escapado.
export const EMAIL_LEGAL_LINE = `moyiq · MAXNOVA &amp; LUCI Global LLC · <a href="mailto:support@moyiq.app">support@moyiq.app</a>`;

export const EMAIL_LINK_STYLE =`color:${EMAIL_BRAND.brand};text-decoration:underline`;
export const EMAIL_MUTED_STYLE = `color:${EMAIL_BRAND.muted};font-size:13px`;
export const EMAIL_H_STYLE = `font-family:${EMAIL_FONTS.display};color:${EMAIL_BRAND.brand};font-weight:600;font-size:20px;line-height:1.25;margin:0 0 12px`;

const BUTTON_STYLE = [
  "display:inline-block",
  "padding:12px 20px",
  `background-color:${EMAIL_BRAND.brand}`,
  `color:${EMAIL_BRAND.onBrand}`,
  `font-family:${EMAIL_FONTS.body}`,
  "font-size:15px",
  "font-weight:600",
  "text-decoration:none",
  "border-radius:8px",
].join(";");

export function emailButton(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${href}" style="${BUTTON_STYLE}">${label}</a></p>`;
}

export function emailHeading(text: string): string {
  return `<h1 style="${EMAIL_H_STYLE}">${text}</h1>`;
}

// Bloque destacado para un dato a copiar (clave de licencia, código).
export function emailCode(text: string): string {
  return `<p style="font-family:${EMAIL_FONTS.mono};font-size:20px;font-weight:600;letter-spacing:1px;color:${EMAIL_BRAND.brand};background:${EMAIL_BRAND.tint};border:1px solid ${EMAIL_BRAND.tintDeep};border-radius:8px;padding:14px 16px;text-align:center;margin:16px 0">${text}</p>`;
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

export function emailLayout(opts: EmailLayoutOptions): string {
  const { lang, bodyHtml, footerHtml, preheader, title, tag } = opts;
  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeText(preheader)}</div>`
    : "";
  const tagCell = tag
    ? `<td align="right" style="font-family:${EMAIL_FONTS.body};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${EMAIL_BRAND.accent}">${escapeText(tag)}</td>`
    : "";
  const footer = footerHtml
    ? `<tr><td style="padding:20px 28px;background:${EMAIL_BRAND.tint};font-family:${EMAIL_FONTS.body};font-size:12px;line-height:1.5;color:${EMAIL_BRAND.muted}">${brandEmailBody(footerHtml)}</td></tr>`
    : "";
  return `<!doctype html>
<html lang="${escapeText(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeText(title ?? "moyiq")}</title></head>
<body style="margin:0;padding:0;background:${EMAIL_BRAND.bg}">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_BRAND.bg}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${EMAIL_BRAND.card};border-radius:10px;overflow:hidden">
<tr><td style="background:${EMAIL_BRAND.brand};padding:20px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td align="left"><a href="https://moyiq.app" style="text-decoration:none"><img src="${EMAIL_LOGO_URL}" width="${LOGO_W}" height="${LOGO_H}" alt="moyiq" style="display:block;border:0;width:${LOGO_W}px;height:${LOGO_H}px"></a></td>
${tagCell}
</tr></table>
</td></tr>
<tr><td style="height:3px;line-height:3px;font-size:0;background:${EMAIL_BRAND.accent}">&nbsp;</td></tr>
<tr><td lang="${escapeText(lang)}" style="padding:32px 28px;font-family:${EMAIL_FONTS.body};font-size:16px;line-height:1.6;color:${EMAIL_BRAND.ink}">
${brandEmailBody(bodyHtml)}
</td></tr>
${footer}
</table>
</td></tr>
</table>
</body></html>`;
}
