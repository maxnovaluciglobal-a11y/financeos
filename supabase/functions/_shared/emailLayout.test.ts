import { describe, it, expect } from "vitest";
import { emailLayout, emailButton, brandEmailBody, EMAIL_BRAND, EMAIL_LOGO_URL } from "./emailLayout.ts";

describe("emailLayout (BRD-5)", () => {
  const html = emailLayout({ lang: "en", bodyHtml: "<h2>Hi</h2><p>Body <a href=\"https://x\">link</a></p>", footerHtml: "Footer <a href=\"https://u\">unsubscribe</a>", preheader: "Pre <x>" });

  it("has the purple header with the logo, the lime stripe and the light background", () => {
    expect(html).toContain(`background:${EMAIL_BRAND.brand}`);
    expect(html).toContain(`src="${EMAIL_LOGO_URL}"`);
    expect(html).toContain(`background:${EMAIL_BRAND.accent}`);
    expect(html).toContain(`background:${EMAIL_BRAND.bg}`);
    expect(html).toContain('alt="moyiq"');
    expect(html).toContain("<title>moyiq</title>");
    expect(html).toMatch(/<html lang="en">/);
    expect(html).toContain('meta name="color-scheme" content="light"');
  });

  it("escapes the preheader and brands headings and plain links", () => {
    expect(html).toContain("Pre &lt;x&gt;");
    expect(html).toMatch(/<h2 style="[^"]*color:#3C2282/);
    expect(html).toMatch(/font-family:Inter,system-ui/);
    expect(html).toContain(`<a href="https://x" style="color:${EMAIL_BRAND.brand}`);
    expect(html).toContain(`<a href="https://u" style="color:${EMAIL_BRAND.brand}`);
  });

  it("omits the footer row when there is none", () => {
    expect(emailLayout({ lang: "es", bodyHtml: "<p>x</p>" })).not.toContain(EMAIL_BRAND.tint + ";font-family");
  });

  it("button: purple fill with white text, never lime text, never a pill", () => {
    const b = emailButton("https://a", "Go");
    expect(b).toContain(`background-color:${EMAIL_BRAND.brand}`);
    expect(b).toContain(`color:${EMAIL_BRAND.onBrand}`);
    expect(b).not.toContain(`color:${EMAIL_BRAND.accent}`);
    expect(b).toContain("border-radius:8px");
  });

  it("brandEmailBody keeps links that already have a color (buttons) and is idempotent", () => {
    const b = emailButton("https://a", "Go");
    expect(brandEmailBody(b)).toBe(b);
    const once = brandEmailBody('<p><a href="https://x">l</a></p>');
    expect(brandEmailBody(once)).toBe(once);
  });
});
