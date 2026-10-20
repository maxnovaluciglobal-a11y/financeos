import { describe, it, expect } from "vitest";
import { emailLayout, emailButton, brandEmailBody, EMAIL_BRAND, EMAIL_LOGO_URL } from "./emailLayout.ts";

describe("emailLayout (BRD-5)", () => {
  const html = emailLayout({ lang: "en", bodyHtml: "<h2>Hi</h2><p>Body <a href=\"https://x\">link</a></p>", footerHtml: "Footer <a href=\"https://u\">unsubscribe</a>", preheader: "Pre <x>" });

  it("has the Navy header with the logo, the Latón stripe and the Papel background", () => {
    expect(html).toContain(`background:${EMAIL_BRAND.navy}`);
    expect(html).toContain(`src="${EMAIL_LOGO_URL}"`);
    expect(html).toContain(`background:${EMAIL_BRAND.laton}`);
    expect(html).toContain(`background:${EMAIL_BRAND.papel}`);
    expect(html).toMatch(/<html lang="en">/);
    expect(html).toContain('meta name="color-scheme" content="light"');
  });

  it("escapes the preheader and brands headings and plain links", () => {
    expect(html).toContain("Pre &lt;x&gt;");
    expect(html).toMatch(/<h2 style="[^"]*color:#14213D/);
    expect(html).toContain(`<a href="https://x" style="color:${EMAIL_BRAND.laton700}`);
    expect(html).toContain(`<a href="https://u" style="color:${EMAIL_BRAND.laton700}`);
  });

  it("omits the footer row when there is none", () => {
    expect(emailLayout({ lang: "es", bodyHtml: "<p>x</p>" })).not.toContain(EMAIL_BRAND.papelDeep + ";font-family");
  });

  it("button: Latón fill with Navy text, never white on Latón, never a pill", () => {
    const b = emailButton("https://a", "Go");
    expect(b).toContain(`background-color:${EMAIL_BRAND.laton}`);
    expect(b).toContain(`color:${EMAIL_BRAND.navy}`);
    expect(b).not.toMatch(/color:#fff/i);
    expect(b).toContain("border-radius:8px");
  });

  it("brandEmailBody keeps links that already have a color (buttons) and is idempotent", () => {
    const b = emailButton("https://a", "Go");
    expect(brandEmailBody(b)).toBe(b);
    const once = brandEmailBody('<p><a href="https://x">l</a></p>');
    expect(brandEmailBody(once)).toBe(once);
  });
});
