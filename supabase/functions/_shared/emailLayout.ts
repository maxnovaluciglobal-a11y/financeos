// supabase/functions/_shared/emailLayout.ts
//
// Sistema visual único de los correos de la app (auditoría 360, BRD-5): el
// mismo de los newsletters ("El Instrumento", moyiq-newsletter-proxy/lib/
// brand.js y lib/template.js). Cabecera Navy con el logo horizontal, franja
// Latón, tarjeta Papel claro sobre fondo Papel y pie Papel oscuro.
//
// Reglas de marca que respeta (branding/CLAUDE.md):
//   - Navy = estructura y títulos; Latón = acento. Sobre Latón, texto Navy,
//     nunca blanco (blanco sobre Latón falla AA).
//   - Latón como TEXTO sobre fondo claro es siempre la variante oscura.
//   - Verde y rojo solo para estado de dato, nunca como acento.
//   - Radios chicos (8 px), nunca píldora. Sin sombras.
//   - Solo modo claro (la inversión automática estropea el logo).
//   - Gmail no carga fuentes propias: las pilas caen a Helvetica/Arial.
//
// Uso: emailLayout({ lang, bodyHtml, footerHtml }) envuelve el contenido;
// emailButton(href, label) es la única llamada a la acción; brandEmailBody()
// impone colores y tipografía a títulos y enlaces del contenido.

export const EMAIL_BRAND = {
  navy: "#14213D",
  laton: "#B8863B",
  laton700: "#8A6329",
  latonDark: "#CC9A52",
  papel: "#F1EEE6",
  papelLight: "#FAF8F2",
  papelDeep: "#E4DFD1",
  ink: "#4A4739",
  muted: "#63604F",
  pos: "#356E57",
  neg: "#A23E2E",
} as const;

export const EMAIL_FONTS = {
  display: "'Instrument Sans','Helvetica Neue',Helvetica,Arial,sans-serif",
  body: "'IBM Plex Sans','Helvetica Neue',Helvetica,Arial,sans-serif",
  mono: "'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace",
} as const;

// Logo horizontal para fondo oscuro (320x73), servido por la propia app
// (public/email/moyiq-logo.png, copia del que usa el newsletter).
export const EMAIL_LOGO_URL = "https://app.moyiq.app/app/email/moyiq-logo.png";
const LOGO_W = 160;
const LOGO_H = 37;

export const EMAIL_LINK_STYLE = `color:${EMAIL_BRAND.laton700};text-decoration:underline`;
export const EMAIL_MUTED_STYLE = `color:${EMAIL_BRAND.muted};font-size:13px`;
export const EMAIL_H_STYLE = `font-family:${EMAIL_FONTS.display};color:${EMAIL_BRAND.navy};font-weight:600;font-size:20px;line-height:1.25;margin:0 0 12px`;

const BUTTON_STYLE = [
  "display:inline-block",
  "padding:12px 20px",
  `background-color:${EMAIL_BRAND.laton}`,
  `color:${EMAIL_BRAND.navy}`,
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
  return `<p style="font-family:${EMAIL_FONTS.mono};font-size:20px;font-weight:600;letter-spacing:1px;color:${EMAIL_BRAND.navy};background:${EMAIL_BRAND.papel};border:1px solid ${EMAIL_BRAND.papelDeep};border-radius:8px;padding:14px 16px;text-align:center;margin:16px 0">${text}</p>`;
}

const HEADING_STYLE: Record<string, string> = {
  h1: `font-family:${EMAIL_FONTS.display};color:${EMAIL_BRAND.navy};font-weight:600;font-size:22px;line-height:1.2;margin:0 0 12px`,
  h2: `font-family:${EMAIL_FONTS.display};color:${EMAIL_BRAND.navy};font-weight:600;font-size:19px;line-height:1.25;margin:0 0 12px`,
  h3: `font-family:${EMAIL_FONTS.display};color:${EMAIL_BRAND.navy};font-weight:600;font-size:16px;line-height:1.3;margin:20px 0 6px`,
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
    ? `<td align="right" style="font-family:${EMAIL_FONTS.body};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${EMAIL_BRAND.latonDark}">${escapeText(tag)}</td>`
    : "";
  const footer = footerHtml
    ? `<tr><td style="padding:20px 28px;background:${EMAIL_BRAND.papelDeep};font-family:${EMAIL_FONTS.body};font-size:12px;line-height:1.5;color:${EMAIL_BRAND.muted}">${brandEmailBody(footerHtml)}</td></tr>`
    : "";
  return `<!doctype html>
<html lang="${escapeText(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeText(title ?? "MOY IQ")}</title></head>
<body style="margin:0;padding:0;background:${EMAIL_BRAND.papel}">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_BRAND.papel}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${EMAIL_BRAND.papelLight};border-radius:10px;overflow:hidden">
<tr><td style="background:${EMAIL_BRAND.navy};padding:20px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td align="left"><a href="https://moyiq.app" style="text-decoration:none"><img src="${EMAIL_LOGO_URL}" width="${LOGO_W}" height="${LOGO_H}" alt="MOY IQ" style="display:block;border:0;width:${LOGO_W}px;height:${LOGO_H}px"></a></td>
${tagCell}
</tr></table>
</td></tr>
<tr><td style="height:3px;line-height:3px;font-size:0;background:${EMAIL_BRAND.laton}">&nbsp;</td></tr>
<tr><td lang="${escapeText(lang)}" style="padding:32px 28px;font-family:${EMAIL_FONTS.body};font-size:16px;line-height:1.6;color:${EMAIL_BRAND.ink}">
${brandEmailBody(bodyHtml)}
</td></tr>
${footer}
</table>
</td></tr>
</table>
</body></html>`;
}
