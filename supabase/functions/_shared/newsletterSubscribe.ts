// supabase/functions/_shared/newsletterSubscribe.ts
//
// Suscribe un email al newsletter correspondiente (moyiq | invest) vía el
// proxy en Vercel (moyiq-newsletter-proxy, endpoint /api/subscribe), que lo
// agrega al segmento de Resend. El proxy es el único lugar con la
// RESEND_API_KEY de marketing, así que ninguna función de Supabase la necesita.
// Hasta el 18-oct-2026 el newsletter vivía en beehiiv; se migró a Resend
// cuando beehiiv Free dejó de permitir la API de posts.
// Reusado desde stripe-webhook (altas Pro/Personal pagas), notify-admin-signup
// (altas Starter/Invest gratuitas) y newsletter-sync (direcciones con el doble
// opt-in confirmado, auditoría 360 C-16).
//
// Best-effort a propósito, igual criterio que notifyNewProPurchase/
// notifyKeyDeliveryFailure: la licencia/registro ya se completó y la
// respuesta 200 ya se decidió antes de esto, así que un fallo acá (Resend
// caído, proxy caído) se loguea pero nunca debe tumbar el flujo principal.
export interface NewsletterConfig {
  proxyUrl?: string;   // https://moyiq-newsletter-proxy.vercel.app/api/subscribe
  proxyToken?: string; // SUBSCRIBE_PROXY_TOKEN del proxy (secret NEWSLETTER_PROXY_TOKEN en Supabase)
}

// Devuelve ok:true solo si el proxy respondió 2xx. Los logs no llevan el
// correo (auditoría 360, C-13/C-16): el producto y el status alcanzan.
export async function subscribeToNewsletter(
  email: string | null,
  product: "moyiq" | "invest",
  config: NewsletterConfig,
): Promise<{ ok: boolean; status?: number; unsubscribed?: boolean }> {
  if (!email || !config.proxyUrl || !config.proxyToken) return { ok: false };
  try {
    const res = await fetch(config.proxyUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.proxyToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ product, email }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      console.error(`subscribeToNewsletter: proxy error ${res.status} product=${product} ${detail}`);
      return { ok: false, status: res.status };
    }
    let data: { unsubscribed?: unknown } | null = null;
    try { data = await res.json(); } catch { data = null; }
    return { ok: true, status: res.status, unsubscribed: data?.unsubscribed === true };
  } catch (err) {
    console.error(`subscribeToNewsletter: fallo de red product=${product}`, err);
    return { ok: false };
  }
}

// Doble opt-in (oct-2026, § 7 UWG): la suscripción automática al newsletter es
// marketing y solo corre si su variable de entorno vale exactamente "true"
// (NEWSLETTER_AUTO_SUBSCRIBE_FREE en notify-admin-signup,
// NEWSLETTER_AUTO_SUBSCRIBE_PRO en stripe-webhook). Sin variable: apagada.
export function autoSubscribeEnabled(envValue: string | null | undefined): boolean {
  return envValue === "true";
}
