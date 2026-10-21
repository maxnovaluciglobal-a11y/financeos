import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrubMessage, reportEdgeError, withErrorReporting } from './errorReport.ts';

const cfg = (f: any) => () => ({ supabaseUrl: 'https://x.supabase.co', serviceRole: 'sr', fetchImpl: f });
const ok = () => vi.fn(async () => new Response('', { status: 201 }));

afterEach(() => { delete (globalThis as any).EdgeRuntime; });

describe('errorReport (C-11): errores de Edge Functions a public.edge_function_errors', () => {
  it('limpia correos, claves, tokens y corta el mensaje', () => {
    const m = scrubMessage(new Error('fallo para Ana.Perez+x@gmail.com clave FNOS-AB12-CD34-EF56 key re_abcdefgh12345678 jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abcdefghijk'));
    expect(m).not.toMatch(/gmail|FNOS-AB12|re_abcdefgh|eyJhbGci/);
    expect(m).toContain('[email]');
    expect(m).toContain('[key]');
    expect(m).toContain('[secret]');
    expect(m).toContain('[jwt]');
    expect(m.startsWith('Error: ')).toBe(true);
    expect(scrubMessage('x'.repeat(1000)).length).toBeLessThanOrEqual(300);
  });

  it('una excepción del handler responde 500 y guarda la fila con el nombre de la función', async () => {
    const f = ok();
    const h = withErrorReporting('send-optin-confirmation', async () => { throw new Error('boom a@b.co'); }, cfg(f));
    const res = await h(new Request('https://x/fn', { method: 'POST' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'internal_error' });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = (f.mock.calls[0] as any);
    expect(url).toBe('https://x.supabase.co/rest/v1/edge_function_errors');
    expect(init.headers.Authorization).toBe('Bearer sr');
    expect(JSON.parse(init.body)).toEqual({ fn: 'send-optin-confirmation', status: 500, message: 'Error: boom [email]' });
  });

  it('una respuesta 5xx se guarda con su cuerpo y sale igual al cliente', async () => {
    const f = ok();
    const h = withErrorReporting('stripe-webhook', async () => new Response('error issuing license', { status: 500 }), cfg(f));
    const res = await h(new Request('https://x/fn'));
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('error issuing license');
    expect(JSON.parse((f.mock.calls[0] as any)[1].body)).toMatchObject({ fn: 'stripe-webhook', status: 500, message: 'HTTP 500: error issuing license' });
  });

  it('2xx, 3xx y 4xx no se guardan', async () => {
    const f = ok();
    for (const status of [200, 303, 400, 401, 404, 429]) {
      const h = withErrorReporting('lead-unsubscribe', async () => new Response(null, { status }), cfg(f));
      expect((await h(new Request('https://x/fn'))).status).toBe(status);
    }
    expect(f).not.toHaveBeenCalled();
  });

  it('si guardar falla (red, 4xx o sin config) la respuesta sale igual', async () => {
    const broken = vi.fn(async () => { throw new Error('network'); });
    const h = withErrorReporting('auth-email-hook', async () => new Response('x', { status: 502 }), cfg(broken));
    expect((await h(new Request('https://x/fn'))).status).toBe(502);
    expect(await reportEdgeError('a', 500, 'x', { supabaseUrl: 'https://x.supabase.co', serviceRole: 'sr', fetchImpl: vi.fn(async () => new Response('', { status: 403 })) as any })).toBe(false);
    expect(await reportEdgeError('a', 500, 'x', {})).toBe(false);
  });

  it('con EdgeRuntime.waitUntil el guardado no demora la respuesta', async () => {
    const waitUntil = vi.fn();
    (globalThis as any).EdgeRuntime = { waitUntil };
    const f = ok();
    const h = withErrorReporting('send-feedback', async () => { throw new Error('x'); }, cfg(f));
    expect((await h(new Request('https://x/fn'))).status).toBe(500);
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('todas las Edge Functions envuelven su handler con su propio nombre', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const fns = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(join(root, d.name, 'index.ts')))
      .map((d) => d.name);
    expect(fns.length).toBeGreaterThanOrEqual(18);
    for (const fn of fns) {
      const src = readFileSync(join(root, fn, 'index.ts'), 'utf8');
      expect(src, fn).toContain(`Deno.serve(withErrorReporting("${fn}", `);
      expect(src.match(/Deno\.serve\(/g)?.length, fn).toBe(1);
    }
  });
});
