// Errores de las Edge Functions (auditoría 360, C-11 / OPS-2). Cada index.ts
// envuelve su handler con withErrorReporting("<nombre>", handler): si el
// handler lanza una excepción o responde 5xx, se guarda una fila en
// public.edge_function_errors (solo service_role). uptime-alert la lee cada
// 5 min y manda un resumen a la casilla de la empresa (ver
// uptime-alert/edgeErrorAlertLogic.ts y docs/monitoreo.md).
//
// Antes, un 500 de una función llamada por el navegador, por Stripe o por Auth
// (bienvenidas, opt-in, webhook, hook de correo) solo quedaba en los logs del
// dashboard: cron-health-alert ve solo las llamadas que hace pg_net.
//
// Nunca rompe la respuesta: si guardar el error falla, se escribe en el log y
// la respuesta sale igual. El mensaje se limpia (sin correos, claves ni tokens)
// y se corta a 300 caracteres. Sin referencias a Deno al cargar el módulo,
// para poder testearlo con vitest.

export type Handler = (req: Request) => Response | Promise<Response>;

export interface ReportConfig {
  supabaseUrl?: string;
  serviceRole?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export const MAX_MESSAGE = 300;

export function scrubMessage(input: unknown): string {
  const s = input instanceof Error ? `${input.name}: ${input.message}` : String(input ?? "");
  return s
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\bFNOS(-[A-Z0-9]{4}){3}\b/gi, "[key]")
    .replace(/\b(sk|pk|rk|whsec|re|sb_secret|sb_publishable)_[A-Za-z0-9_]{8,}/g, "[secret]")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]")
    .replace(/\b[A-Za-z0-9+/_-]{40,}={0,2}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MESSAGE);
}

function envConfig(): ReportConfig {
  // deno-lint-ignore no-explicit-any
  const env = (globalThis as any).Deno?.env;
  return {
    supabaseUrl: env?.get("SUPABASE_URL"),
    serviceRole: env?.get("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export async function reportEdgeError(fn: string, status: number | null, message: unknown, cfg: ReportConfig): Promise<boolean> {
  if (!cfg.supabaseUrl || !cfg.serviceRole) return false;
  const f = cfg.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs ?? 3000);
  try {
    const res = await f(`${cfg.supabaseUrl}/rest/v1/edge_function_errors`, {
      method: "POST",
      headers: {
        apikey: cfg.serviceRole,
        Authorization: `Bearer ${cfg.serviceRole}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ fn: fn.slice(0, 64), status, message: scrubMessage(message) }),
      signal: ctrl.signal,
    });
    if (!res.ok) console.error(`errorReport: no se pudo guardar el error de ${fn} (${res.status})`);
    return res.ok;
  } catch (e) {
    console.error(`errorReport: no se pudo guardar el error de ${fn}: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Deja correr el guardado después de responder si el runtime lo permite
// (EdgeRuntime.waitUntil en Supabase); si no, lo espera.
async function background(p: Promise<unknown>): Promise<void> {
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt && typeof rt.waitUntil === "function") {
    rt.waitUntil(p);
    return;
  }
  await p;
}

export function withErrorReporting(fn: string, handler: Handler, getConfig: () => ReportConfig = envConfig): Handler {
  return async (req: Request): Promise<Response> => {
    let res: Response;
    try {
      res = await handler(req);
    } catch (e) {
      console.error(`${fn}: excepción no controlada: ${e instanceof Error ? e.message : String(e)}`);
      await background(reportEdgeError(fn, 500, e, getConfig()));
      return new Response(JSON.stringify({ ok: false, error: "internal_error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (res.status >= 500) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = (await res.clone().text()).slice(0, 400);
        if (body) detail += `: ${body}`;
      } catch {
        // cuerpo no legible (stream ya usado): queda solo el status
      }
      await background(reportEdgeError(fn, res.status, detail, getConfig()));
    }
    return res;
  };
}
