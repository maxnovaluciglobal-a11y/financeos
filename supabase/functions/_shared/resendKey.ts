// Clave de Resend de las funciones que mandan desde @moyiq.app (stripe-webhook y
// send-report-email, auditoría 360 C-05 / VEN-3).
//
// NURTURE_RESEND_API_KEY es la clave de la cuenta de empresa, scopeada al dominio
// moyiq.app: la que ya usan los nurtures, auth-email-hook, optin y cancelación.
// RESEND_API_KEY es el secret genérico del 29-jun-2026 (de antes de la migración
// de Resend a la cuenta de empresa y de la compra de moyiq.app): devuelve 403 al
// mandar desde moyiq.app. Queda solo como respaldo hasta que Walter cree una clave
// nueva "sending access" de moyiq.app y la cargue como RESEND_API_KEY (W-09).
//
// Recibe el lector de variables (en las funciones, `(n) => Deno.env.get(n)`) para
// poder probarse desde Node: index.ts no se puede importar fuera de Deno.
export function resolveResendApiKey(get: (name: string) => string | undefined): string | undefined {
  const clean = (v: string | undefined) => v?.trim() || undefined;
  return clean(get("NURTURE_RESEND_API_KEY")) ?? clean(get("RESEND_API_KEY"));
}
