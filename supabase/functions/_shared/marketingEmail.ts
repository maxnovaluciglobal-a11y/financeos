// Requisitos comunes de los correos de marketing (nurtures), auditoría 360
// C-35 (COM-9, D-14):
//   - Dirección postal de la empresa en el pie (CAN-SPAM). Es la misma que usa
//     el pie del newsletter (moyiq-newsletter-proxy/lib/template.js).
//   - List-Unsubscribe + List-Unsubscribe-Post (RFC 8058, baja con un clic que
//     piden Gmail y Yahoo): un POST a la función lead-unsubscribe da de baja
//     sin pasar por la página; el mailto queda de respaldo.

export const COMPANY_POSTAL_TEXT = "MAXNOVA & LUCI Global LLC · 10482 NW 31st Terrace, Office 1D, Doral, FL 33172, USA";
export const COMPANY_POSTAL_HTML = COMPANY_POSTAL_TEXT.replace("&", "&amp;");

// "trial": secuencia de activación de la prueba (C-35 / COM-10).
export const UNSUBSCRIBE_TABLES = ["starter", "diagnostico", "invest", "demo", "trial"] as const;
export type UnsubscribeTable = typeof UNSUBSCRIBE_TABLES[number];

export function oneClickUnsubscribeUrl(supabaseUrl: string, table: UnsubscribeTable, leadId: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/lead-unsubscribe?t=${table}&id=${encodeURIComponent(leadId)}`;
}

export function listUnsubscribeHeaders(supabaseUrl: string, table: UnsubscribeTable, leadId: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${oneClickUnsubscribeUrl(supabaseUrl, table, leadId)}>, <mailto:support@moyiq.app?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
