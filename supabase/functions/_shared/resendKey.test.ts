// Clave de Resend de stripe-webhook y send-report-email (auditoría 360, C-05 / VEN-3).
// Esas dos funciones leían solo RESEND_API_KEY (secret del 29-jun, de antes de la
// cuenta de empresa y de moyiq.app), que da 403 al mandar desde @moyiq.app: el
// correo con la licencia tras el pago y el aviso interno de "no recibió su clave"
// habrían fallado juntos. El resto de las funciones ya usan NURTURE_RESEND_API_KEY.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveResendApiKey } from './resendKey.ts';

const env = (vars: Record<string, string | undefined>) => (name: string) => vars[name];

describe('resolveResendApiKey', () => {
  it('prefiere NURTURE_RESEND_API_KEY (la scopeada a moyiq.app) si están las dos', () => {
    expect(resolveResendApiKey(env({ NURTURE_RESEND_API_KEY: 're_nurture', RESEND_API_KEY: 're_vieja' }))).toBe('re_nurture');
  });

  it('cae a RESEND_API_KEY si NURTURE_RESEND_API_KEY no está', () => {
    expect(resolveResendApiKey(env({ RESEND_API_KEY: 're_vieja' }))).toBe('re_vieja');
  });

  it('usa NURTURE_RESEND_API_KEY aunque RESEND_API_KEY no exista', () => {
    expect(resolveResendApiKey(env({ NURTURE_RESEND_API_KEY: 're_nurture' }))).toBe('re_nurture');
  });

  it('un secret vacío o de solo espacios no tapa al otro', () => {
    expect(resolveResendApiKey(env({ NURTURE_RESEND_API_KEY: '', RESEND_API_KEY: 're_vieja' }))).toBe('re_vieja');
    expect(resolveResendApiKey(env({ NURTURE_RESEND_API_KEY: '   ', RESEND_API_KEY: 're_vieja' }))).toBe('re_vieja');
  });

  it('sin ninguna de las dos devuelve undefined (el llamador avisa y no manda)', () => {
    expect(resolveResendApiKey(env({}))).toBeUndefined();
    expect(resolveResendApiKey(env({ NURTURE_RESEND_API_KEY: '', RESEND_API_KEY: ' ' }))).toBeUndefined();
  });

  it('quita espacios y saltos de línea alrededor de la clave', () => {
    expect(resolveResendApiKey(env({ NURTURE_RESEND_API_KEY: ' re_nurture\n' }))).toBe('re_nurture');
  });

  it('solo consulta esos dos nombres', () => {
    const asked: string[] = [];
    resolveResendApiKey((n) => { asked.push(n); return undefined; });
    expect(asked).toEqual(['NURTURE_RESEND_API_KEY', 'RESEND_API_KEY']);
  });
});

// index.ts no se puede importar desde Node (lee Deno.env al cargar), así que el
// cableado se verifica leyendo el texto: si alguien vuelve a leer RESEND_API_KEY a
// mano en estas dos funciones, el correo de la licencia vuelve a depender de la
// clave que da 403 desde @moyiq.app.
describe('cableado en stripe-webhook y send-report-email', () => {
  const functionsDir = join(dirname(fileURLToPath(import.meta.url)), '..');
  for (const fn of ['stripe-webhook', 'send-report-email']) {
    it(`${fn}/index.ts arma resendApiKey con resolveResendApiKey y no lee RESEND_API_KEY a mano`, () => {
      const src = readFileSync(join(functionsDir, fn, 'index.ts'), 'utf8');
      expect(src).toMatch(/resendApiKey:\s*resolveResendApiKey\(/);
      expect(src).not.toMatch(/Deno\.env\.get\(["']RESEND_API_KEY["']\)/);
    });
  }
});
