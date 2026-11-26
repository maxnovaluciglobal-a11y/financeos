import { describe, it, expect } from "vitest";
import {
  emailLayout, emailButton, brandEmailBody, contrastRatio,
  EMAIL_BRAND, EMAIL_DARK, EMAIL_LOGO_URL, EMAIL_CONTRAST_PAIRS, IMPULSO_GRADIENT, IMPULSO_STOPS,
} from "./emailLayout.ts";
import { htmlToText } from "./emailText.ts";

describe("emailLayout (BRD-5, Impulso desde el 26-nov-2026)", () => {
  const html = emailLayout({ lang: "en", bodyHtml: "<h2>Hi</h2><p>Body <a href=\"https://x\">link</a></p>", footerHtml: "Footer <a href=\"https://u\">unsubscribe</a>", preheader: "Pre <x>", tag: "Investments" });

  it("header: Impulso gradient with a solid #3C2282 fallback (bgcolor + background-color)", () => {
    expect(IMPULSO_GRADIENT).toBe("linear-gradient(74deg,#2D1D59 0%,#8620D0 59%,#7A21FF 100%)");
    expect(html).toMatch(/<td class="mq-head[^"]*" bgcolor="#3C2282" style="background-color:#3C2282;background-image:linear-gradient\(74deg,#2D1D59 0%,#8620D0 59%,#7A21FF 100%\)/);
    // Nada de la cabecera morada plana anterior ni de los otros degradados.
    expect(html).not.toMatch(/#3C0097|#2F01B0|#4D12AC|#391E63/i);
  });

  it("white logo with alt text, lime rule under the header, light background", () => {
    expect(html).toContain(`src="${EMAIL_LOGO_URL}"`);
    expect(html).toContain('alt="moyiq"');
    expect(html).toMatch(/<img [^>]*style="[^"]*color:#FFFFFF/);
    expect(html).toContain(`background:${EMAIL_BRAND.accent}`);
    expect(html).toContain(`background:${EMAIL_BRAND.bg}`);
    expect(html).toMatch(/<html lang="en">/);
  });

  it("lime is never text: not in a color declaration anywhere (tag in white)", () => {
    expect(html).not.toMatch(/(^|[^-])color:#D0F06E/i);
    expect(html).toMatch(/color:#FFFFFF">Investments</);
  });

  it("600 px card that shrinks on phones; light and dark declared", () => {
    expect(html).toMatch(/class="mq-card" role="presentation" width="600"[^>]*style="width:600px;max-width:100%/);
    expect(html).toContain("@media (max-width:620px)");
    expect(html).toContain('meta name="color-scheme" content="light dark"');
    expect(html).toContain('meta name="supported-color-schemes" content="light dark"');
  });

  it("dark mode keeps the Impulso header and swaps the light colors for the graphite palette", () => {
    const dark = html.match(/@media \(prefers-color-scheme:dark\)\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(dark).toContain(`.mq-card{background:${EMAIL_DARK.card}!important}`);
    expect(dark).toContain(`[style*="color:${EMAIL_BRAND.brand}"]`);
    expect(dark).toContain(`color:${EMAIL_DARK.brandText}!important`);
    expect(dark).toContain(`background-image:${IMPULSO_GRADIENT}!important`);
    // El botón no hereda el morado claro del selector genérico (td.mq-btn gana).
    expect(dark).toMatch(/\.mq-body td\.mq-btn,\.mq-body a\.mq-btn\{background:#A897DA!important;background-color:#A897DA!important;color:#1C1D21!important\}/);
    // El oscuro va en su propio <style>: Gmail descarta el bloque entero si no
    // entiende un selector, y el responsivo tiene que sobrevivir.
    expect(html.match(/<style>/g)?.length).toBe(2);
    expect(html.split("<style>")[1]).not.toContain("prefers-color-scheme");
  });

  it("preheader: escaped, hidden, padded so the body does not leak into the inbox preview, and out of the plain text", () => {
    expect(html).toContain("Pre &lt;x&gt;");
    expect(html).toMatch(/<div style="display:none;[^"]*mso-hide:all[^"]*">Pre &lt;x&gt;(&#847;&zwnj;&nbsp;){40}<\/div>/);
    expect(htmlToText(html)).not.toContain("Pre <x>");
  });

  it("brands headings and plain links", () => {
    expect(html).toMatch(/<h2 style="[^"]*color:#3C2282/);
    expect(html).toMatch(/font-family:Inter,system-ui/);
    expect(html).toContain(`<a href="https://x" style="color:${EMAIL_BRAND.brand}`);
    expect(html).toContain(`<a href="https://u" style="color:${EMAIL_BRAND.brand}`);
  });

  it("omits the footer row when there is none", () => {
    expect(emailLayout({ lang: "es", bodyHtml: "<p>x</p>" })).not.toContain(`class="mq-foot`);
  });
});

describe("emailButton: bulletproof, purple with white text", () => {
  const b = emailButton("https://a.test/?open=x&amp;ref=y", "Go");

  it("is a table whose cell is painted (bgcolor) so the whole button shows without <a> padding", () => {
    expect(b).toMatch(/^<table role="presentation"[^>]*><tr><td class="mq-btn" align="center" bgcolor="#3C2282" style="background-color:#3C2282;border-radius:8px;mso-padding-alt:14px 24px">/);
    expect(b).toContain('href="https://a.test/?open=x&amp;ref=y"');
  });

  it("purple fill, white text, 8 px radius, never lime text, never a pill", () => {
    expect(b).toContain(`background-color:${EMAIL_BRAND.brand}`);
    expect(b).toContain(`color:${EMAIL_BRAND.onBrand}`);
    expect(b).not.toContain(`color:${EMAIL_BRAND.accent}`);
    expect(b).toContain("border-radius:8px");
    expect(b).not.toMatch(/border-radius:(999|50|100)/);
  });

  it("chosen over violet because it is the brand action color and has more contrast", () => {
    expect(contrastRatio(EMAIL_BRAND.onBrand, EMAIL_BRAND.brand)).toBeGreaterThan(contrastRatio(EMAIL_BRAND.onBrand, EMAIL_BRAND.violet));
  });

  it("plain text keeps the label and the URL", () => {
    expect(htmlToText(b)).toBe("Go (https://a.test/?open=x&ref=y)\n");
  });

  it("brandEmailBody keeps links that already have a color (buttons) and is idempotent", () => {
    expect(brandEmailBody(b)).toBe(b);
    const once = brandEmailBody('<p><a href="https://x">l</a></p>');
    expect(brandEmailBody(once)).toBe(once);
  });
});

describe("contrast of every text/background pair (WCAG 2.x)", () => {
  it("contrastRatio matches known values", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#3C2282")).toBeCloseTo(12.05, 1);
    expect(contrastRatio("#7A21FF", "#FFFFFF")).toBeCloseTo(6.01, 1);
  });

  it("white on every Impulso stop is covered", () => {
    for (const stop of IMPULSO_STOPS) expect(EMAIL_CONTRAST_PAIRS.some((p) => p.bg === stop && p.fg === "#FFFFFF")).toBe(true);
  });

  for (const p of EMAIL_CONTRAST_PAIRS) {
    it(`${p.name}: ${p.fg} on ${p.bg} ≥ ${p.min}`, () => {
      expect(contrastRatio(p.fg, p.bg)).toBeGreaterThanOrEqual(p.min);
    });
  }

  it("lime as text on a light background would fail (the reason for the rule)", () => {
    expect(contrastRatio(EMAIL_BRAND.accent, EMAIL_BRAND.card)).toBeLessThan(3);
  });
});
