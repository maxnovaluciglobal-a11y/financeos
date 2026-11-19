// supabase/functions/_shared/emailText.ts
//
// Parte de texto plano de los correos (auditoría de correos 18-nov-2026: 11
// tipos salían solo con HTML). Se deriva del mismo HTML que arma emailLayout,
// así el texto nunca se desincroniza de lo que se ve: una sola fuente.
//
// Reglas:
//   - Fuera <head>, <style>, <script> y el preheader oculto (display:none).
//   - Imágenes fuera (el logo no aporta nada en texto). Un enlace sin texto
//     visible (el logo) desaparece.
//   - Enlace "texto (URL)"; si el texto ya es la URL o el email del mailto:,
//     solo el texto.
//   - Bloques (p, h1-h3, tr, li, br, hr) → saltos de línea; li → "- ".
//   - Entidades decodificadas, espacios colapsados, como mucho una línea en
//     blanco seguida.

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rarr: "→", larr: "←",
  middot: "·", mdash: "—", ndash: "–", hellip: "…", copy: "©", reg: "®", euro: "€",
  laquo: "«", raquo: "»", iexcl: "¡", iquest: "¿",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, ent: string) => {
    if (ent[0] === "#") {
      const code = ent[1] === "x" || ent[1] === "X" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : all;
    }
    return NAMED[ent.toLowerCase()] ?? all;
  });
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

export function htmlToText(html: string): string {
  let s = String(html ?? "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<(head|style|script|title)\b[\s\S]*?<\/\1>/gi, "");
  // Preheader: div oculto con display:none (emailLayout y nurtures).
  s = s.replace(/<div\b[^>]*display\s*:\s*none[^>]*>[\s\S]*?<\/div>/gi, "");
  s = s.replace(/<img\b[^>]*>/gi, "");

  // Enlaces → "texto (URL)".
  s = s.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_all, attrs: string, inner: string) => {
    const label = decodeEntities(stripTags(inner)).replace(/\s+/g, " ").trim();
    const m = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)')/i);
    const href = decodeEntities(m?.[2] ?? m?.[3] ?? "").trim();
    if (!label) return "";
    if (!href || href === "#") return label;
    const target = href.replace(/^mailto:/i, "");
    if (target === label || href === label) return label;
    return `${label} (${target})`;
  });

  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<hr\b[^>]*>/gi, "\n----\n");
  s = s.replace(/<li\b[^>]*>/gi, "\n- ").replace(/<\/li>/gi, "");
  s = s.replace(/<\/(td|th)>/gi, "  ");
  s = s.replace(/<\/?(p|div|h[1-6]|tr|table|tbody|thead|ul|ol|li|blockquote|pre|section|header|footer)\b[^>]*>/gi, "\n");
  s = stripTags(s);
  s = decodeEntities(s);

  return s
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}
