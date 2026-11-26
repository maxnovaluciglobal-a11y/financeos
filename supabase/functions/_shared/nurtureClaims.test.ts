// Claims de los nurtures contra lo que la app hace hoy (26-nov-2026), en los
// 4 idiomas:
//   - Sin "categorización automática": la app sugiere la categoría y la persona
//     la confirma (Por revisar), o aplica las reglas que la persona creó
//     (src/utils/categoryRules.js).
//   - La prueba de Pro es de 14 días SIN tarjeta y la empieza la persona: nada
//     de "se pide una tarjeta".
//   - Nombres de pantallas y módulos de la app (i18n nav.* y proTrial.feature.*):
//     Inicio/Home/Início/Start, nunca "Dashboard"/"Painel"; nada de Coach,
//     Advisor, Goals o Reports en inglés fuera del inglés.
import { describe, it, expect } from "vitest";
import { renderEmail as renderStarter } from "../send-nurture-starter-email/nurtureEmailLogic.ts";
import { renderEmail as renderDiag } from "../send-nurture-diagnostico-email/nurtureEmailLogic.ts";

const CFG = { supabaseUrl: "https://p.supabase.co", serviceRole: "sr", resendApiKey: "re", fromEmail: "moyiq <hola@moyiq.app>", cronSecret: "s", landingUrl: "https://moyiq.app" } as any;
const LANGS = ["es", "en", "pt", "de"] as const;
const LABELS = ["Crítico", "Regular", "Bueno", "Excelente", null];

// Las URL (?open=dashboard) no son copy.
const noUrls = (t?: string) => String(t ?? "").replace(/https?:\/\/\S+/g, "");

function all() {
  const out: [string, string, string][] = [];
  for (const lang of LANGS) {
    for (const m of ["welcome", "day2", "day5"] as const) out.push([`starter/${lang}/${m}`, lang, noUrls(renderStarter(m, { id: "l1", email: "l@x.com", lang } as any, CFG).text)]);
    for (const m of ["welcome", "day2", "day5", "day12"] as const) for (const label of LABELS) out.push([`diag/${lang}/${m}/${label}`, lang, noUrls(renderDiag(m, { id: "l1", email: "l@x.com", lang, score: 42, label } as any, CFG).text)]);
  }
  return out;
}

describe("claims de los nurtures (Starter y Diagnóstico)", () => {
  it("nunca prometen categorización automática", () => {
    for (const [name, , t] of all()) expect(t, name).not.toMatch(/categoriza(ción)? autom|automatic categori|categoriz\w* automatic|categorização automática|categoriza automaticamente|automatische Kategori|automatisch einer Kategorie/i);
  });
  it("la prueba de Pro no pide tarjeta", () => {
    for (const [name, , t] of all()) expect(t, name).not.toMatch(/se pide una tarjeta|card is required|requires a card|pede um cartão|Karte erforderlich|Karte angeben/i);
  });
  it("usan los nombres de la app: Inicio, sin Dashboard ni módulos en inglés", () => {
    for (const [name, lang, t] of all()) {
      expect(t, name).not.toMatch(/Dashboard|Painel/i);
      expect(t, name).not.toMatch(/\bCoach\b/);
      if (lang !== "en") expect(t, name).not.toMatch(/\b(Advisor|Goals|Reports)\b/);
    }
  });
  it("el día 5 dice en los 4 idiomas que la prueba es sin tarjeta", () => {
    const want = { es: /sin tarjeta/, en: /no card/, pt: /sem cartão/, de: /ohne Karte/ };
    for (const lang of LANGS) {
      expect(renderStarter("day5", { id: "l1", email: "l@x.com", lang } as any, CFG).text, lang).toMatch(want[lang]);
      expect(renderDiag("day5", { id: "l1", email: "l@x.com", lang } as any, CFG).text, lang).toMatch(want[lang]);
    }
  });
});
