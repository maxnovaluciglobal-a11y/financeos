// supabase/functions/_shared/emailSender.ts
//
// Nombre visible de los correos (rebranding moyiq, Entrega 1). Las direcciones
// no cambian (hola@, licencias@, invest@ de moyiq.app, verificadas en Resend);
// solo cambia el nombre que ve quien recibe. El nombre se impone en código
// aunque el secret (FROM_EMAIL, NURTURE_FROM_EMAIL, NURTURE_FROM_EMAIL_INVEST)
// todavía tenga el nombre anterior: del secret se toma solo la dirección.

import type { EmailLang } from "./emailLang.ts";

export const SENDER_NAME = "moyiq";

// Reply-To de los correos a usuarios (servicio y marketing): una respuesta llega
// a soporte, no a la casilla de envío (hola@, licencias@, invest@). No se usa en
// el reporte del Modo Asesor ni en el feedback, que responden a otra persona.
export const SUPPORT_REPLY_TO = "support@moyiq.app";
// Sitio externo de inversiones (invest.moyiq.app), "moyiq · Inversiones". En el
// nombre del remitente va sin el punto medio para no depender de cómo cada
// cliente de correo muestra un nombre con caracteres especiales.
export const INVEST_SENDER_NAME = "moyiq Inversiones";

// Nombre de la sección/sitio de inversiones por idioma (D14: en/de
// "Investments", pt "Investimentos").
export const INVEST_LABEL: Record<EmailLang, string> = {
  es: "Inversiones",
  en: "Investments",
  pt: "Investimentos",
  de: "Investments",
};
export function investSiteName(lang: EmailLang = "es"): string {
  return `moyiq · ${INVEST_LABEL[lang] ?? INVEST_LABEL.es}`;
}

const ADDRESS = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

// "<nombre anterior> <hola@moyiq.app>" | "hola@moyiq.app" | undefined → "moyiq <hola@moyiq.app>".
export function brandedSender(value: string | null | undefined, fallbackAddress: string, name: string = SENDER_NAME): string {
  const raw = String(value ?? "").trim();
  const inBrackets = raw.match(/<\s*([^<>\s]+)\s*>\s*$/)?.[1];
  const candidate = inBrackets ?? raw;
  const address = ADDRESS.test(candidate) ? candidate : fallbackAddress;
  return `${name} <${address}>`;
}
