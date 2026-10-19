// supabase/config.toml fija verify_jwt por función (auditoría 360, C-12 / OPS-3).
// El CLI de Supabase ignora en silencio las claves que no conoce (probado el
// 19-oct-2026: `verify_jwtt = false` no da error), así que un typo o una función
// nueva sin entrada pasaría sin aviso y el próximo deploy usaría el valor por
// defecto (verify_jwt = true → 401 para pg_cron, Stripe y los navegadores).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FUNCTIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = join(FUNCTIONS_DIR, '..', 'config.toml');

// Valores de producción al 19-oct-2026 (`supabase functions list -o json`).
const EXPECTED_VERIFY_JWT: Record<string, boolean> = {
  'auth-email-hook': false,
  'cron-health-alert': false,
  'notify-admin-signup': false,
  'send-cancellation-confirmation': false,
  'send-nurture-diagnostico-email': false,
  'send-nurture-invest-email': false,
  'send-nurture-starter-email': false,
  'send-optin-confirmation': false,
  'send-push': true,
  'send-report-email': false,
  'stripe-webhook': false,
  'uptime-alert': false,
};

// Parser estricto del subconjunto que usamos: project_id y [functions.<slug>] con
// verify_jwt. Cualquier otra línea falla: así nadie suma por accidente secciones
// ([auth], [api]…) que un `supabase config push` empujaría a producción.
export function parseFunctionsConfig(text: string) {
  const out: { projectId: string | null; functions: Record<string, boolean> } = { projectId: null, functions: {} };
  let current: string | null = null;
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^project_id = "([a-z0-9-]+)"$/))) { out.projectId = m[1]; current = null; return; }
    if ((m = line.match(/^\[functions\.([a-z0-9-]+)\]$/))) {
      if (m[1] in out.functions) throw new Error(`línea ${i + 1}: [functions.${m[1]}] repetido`);
      current = m[1]; return;
    }
    if ((m = line.match(/^verify_jwt = (true|false)$/)) && current) { out.functions[current] = m[1] === 'true'; return; }
    throw new Error(`línea ${i + 1}: no permitida en config.toml: ${line}`);
  });
  return out;
}

const functionDirs = readdirSync(FUNCTIONS_DIR)
  .filter((d) => !d.startsWith('_') && statSync(join(FUNCTIONS_DIR, d)).isDirectory())
  .sort();

describe('supabase/config.toml: verify_jwt por función', () => {
  const parsed = parseFunctionsConfig(readFileSync(CONFIG_PATH, 'utf8'));

  it('tiene una entrada por cada carpeta de supabase/functions (y ninguna de más)', () => {
    expect(Object.keys(parsed.functions).sort()).toEqual(functionDirs);
  });

  it('cada función tiene verify_jwt explícito y igual al de producción', () => {
    expect(parsed.functions).toEqual(EXPECTED_VERIFY_JWT);
  });

  it('el test cubre exactamente las funciones que existen', () => {
    expect(Object.keys(EXPECTED_VERIFY_JWT).sort()).toEqual(functionDirs);
  });

  it('solo send-push verifica JWT (pg_cron la invoca con el service role)', () => {
    expect(Object.entries(parsed.functions).filter(([, v]) => v).map(([k]) => k)).toEqual(['send-push']);
  });

  it('project_id es el nombre del proyecto, no el ref de producción', () => {
    expect(parsed.projectId).toBe('financeos-prod');
  });
});

describe('parseFunctionsConfig', () => {
  it('rechaza secciones que no sean [functions.*] (p. ej. [auth])', () => {
    expect(() => parseFunctionsConfig('[auth]\nenable_signup = true')).toThrow(/no permitida/);
  });
  it('rechaza claves mal escritas dentro de una función', () => {
    expect(() => parseFunctionsConfig('[functions.x]\nverify_jwtt = false')).toThrow(/no permitida/);
  });
  it('rechaza valores que no sean booleanos', () => {
    expect(() => parseFunctionsConfig('[functions.x]\nverify_jwt = "false"')).toThrow(/no permitida/);
  });
  it('rechaza una función repetida', () => {
    expect(() => parseFunctionsConfig('[functions.x]\nverify_jwt = false\n[functions.x]\nverify_jwt = true')).toThrow(/repetido/);
  });
});
