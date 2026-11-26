// El logo de la cabecera de los correos lo sirve la propia app: la URL
// https://app.moyiq.app/app/email/moyiq-logo-v3.png sale de public/email/ (el
// build copia public/ a dist/app/). Esta prueba fija que el archivo existe, que
// es el logotipo blanco 3x (288x100) que emailLayout muestra a 96x33 y que su
// fondo es TRANSPARENTE: va sobre la banda Impulso, y un PNG con fondo opaco
// dejaría un rectángulo de otro color dentro del degradado.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { EMAIL_BRAND, EMAIL_LOGO_SIZE, EMAIL_LOGO_URL, emailLayout } from "./emailLayout.ts";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

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
  return { width, height, colorType, first: px(0), raw, bpp };
}

const hex = (rgb: number[]) => "#" + rgb.slice(0, 3).map(n => n.toString(16).padStart(2, "0")).join("").toUpperCase();

describe("logo de los correos", () => {
  it("la URL apunta a public/email/moyiq-logo-v3.png servido bajo /app/", () => {
    expect(EMAIL_LOGO_URL).toBe("https://app.moyiq.app/app/email/moyiq-logo-v3.png");
  });

  it("es el logotipo blanco 3x sobre transparente (RGBA), sin rectángulo de fondo", () => {
    const png = readPng(readFileSync(`${ROOT}public/email/moyiq-logo-v3.png`));
    expect([png.width, png.height]).toEqual([288, 100]);
    expect(png.colorType).toBe(6); // RGBA
    expect(png.first[3]).toBe(0); // la esquina es transparente
  });

  it("v2 (fondo morado opaco) y el logo viejo siguen en sus URL, sin cambios (correos ya enviados)", () => {
    const v2 = readPng(readFileSync(`${ROOT}public/email/moyiq-logo-v2.png`));
    expect([v2.width, v2.height]).toEqual([320, 73]);
    expect(hex(v2.first)).toBe(EMAIL_BRAND.brand.toUpperCase());
    const old = readPng(readFileSync(`${ROOT}public/email/moyiq-logo.png`));
    expect(hex(old.first)).not.toBe(EMAIL_BRAND.brand.toUpperCase());
  });

  it("la cabecera muestra el logo a 96x33 (≥ 80 px de ancho, libro de marca) con la misma proporción del PNG", () => {
    expect(EMAIL_LOGO_SIZE).toEqual({ width: 96, height: 33 });
    expect(Math.abs(288 / 100 - 96 / 33)).toBeLessThan(0.05);
    const html = emailLayout({ lang: "es", bodyHtml: "<p>x</p>" });
    expect(html).toMatch(/<img src="https:\/\/app\.moyiq\.app\/app\/email\/moyiq-logo-v3\.png" width="96" height="33" alt="moyiq"/);
  });
});
