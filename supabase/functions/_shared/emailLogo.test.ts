// El logo de la cabecera de los correos lo sirve la propia app: la URL
// https://app.moyiq.app/app/email/moyiq-logo-v2.png sale de public/email/ (el
// build copia public/ a dist/app/). Esta prueba fija que el archivo existe,
// que es el horizontal 2x (320x73) que emailLayout muestra a 160x37 y que su
// fondo es el morado de la cabecera (#3C2282), con el logo en blanco: así un
// PNG nuevo con otro fondo o con transparencia no deja un rectángulo de otro
// color dentro de la cabecera.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { EMAIL_BRAND, EMAIL_LOGO_URL, emailLayout } from "./emailLayout.ts";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const LOGO_PATH = `${ROOT}public/email/moyiq-logo-v2.png`;

function readPng(buf: Buffer) {
  expect(buf.subarray(1, 4).toString("latin1")).toBe("PNG");
  let off = 8;
  let width = 0, height = 0, colorType = -1;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString("latin1");
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]; }
    if (type === "IDAT") idat.push(data);
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : 3;
  // El primer píxel de la primera fila no depende del filtro (no hay vecinos).
  const px = (i: number) => Array.from(raw.subarray(1 + i * bpp, 1 + i * bpp + bpp));
  return { width, height, colorType, first: px(0) };
}

const hex = (rgb: number[]) => "#" + rgb.slice(0, 3).map(n => n.toString(16).padStart(2, "0")).join("").toUpperCase();

describe("logo de los correos", () => {
  it("la URL apunta a public/email/moyiq-logo-v2.png servido bajo /app/", () => {
    expect(EMAIL_LOGO_URL).toBe("https://app.moyiq.app/app/email/moyiq-logo-v2.png");
  });

  it("es el horizontal 2x con fondo morado de cabecera y sin transparencia", () => {
    const png = readPng(readFileSync(LOGO_PATH));
    expect([png.width, png.height]).toEqual([320, 73]);
    expect(png.colorType).toBe(2); // RGB: sin canal alfa
    expect(hex(png.first)).toBe(EMAIL_BRAND.brand.toUpperCase());
  });

  it("el logo anterior sigue en su URL, sin cambios (correos ya enviados)", () => {
    const old = readPng(readFileSync(`${ROOT}public/email/moyiq-logo.png`));
    expect(hex(old.first)).not.toBe(EMAIL_BRAND.brand.toUpperCase());
  });

  it("la cabecera usa el mismo morado #3C2282 y muestra el logo a 160x37", () => {
    expect(EMAIL_BRAND.brand).toBe("#3C2282");
    const html = emailLayout({ lang: "es", bodyHtml: "<p>x</p>" });
    expect(html).toContain(`background:${EMAIL_BRAND.brand};padding:20px 28px`);
    expect(html).toMatch(/<img src="https:\/\/app\.moyiq\.app\/app\/email\/moyiq-logo-v2\.png" width="160" height="37" alt="moyiq"/);
  });
});
