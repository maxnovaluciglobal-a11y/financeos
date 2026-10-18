// supabase/functions/_shared/newsletterSubscribe.ts
//
// Suscribe un email al newsletter correspondiente (moyiq | invest) vía el
// proxy en Vercel (moyiq-newsletter-proxy, endpoint /api/subscribe), que lo
// agrega al segmento de Resend. El proxy es el único lugar con la
// RESEND_API_KEY de marketing, así que ninguna función de Supabase la necesita.
// Hasta el 18-oct-2026 el newsletter vivía en beehiiv; se migró a Resend
// cuando beehiiv Free dejó de permitir la API de posts.
// Reusado desde stripe-webhook (altas Pro/Personal pagas) y
// notify-admin-signup (altas Starter/Invest gratuitas) — pedido de Walter
// 21-sep-2026: "el usuario Pro también debería recibirla".
//
// Best-effort a propósito, igual criterio que notifyNewProPurchase/
// notifyKeyDeliveryFailure: la licencia/registro ya se completó y la
// respuesta 200 ya se decidió antes de esto, así que un fallo acá (Resend
// caído, proxy caído) se loguea pero nunca debe tumbar el flujo principal.
export interface NewsletterConfig {
  proxyUrl?: string;   // https://moyiq-newsletter-proxy.vercel.app/api/subscribe
  proxyToken?: string; // mismo PROXY_AUTH_TOKEN que ya usan las rutinas cloud de newsletter
}

export async function subscribeToNewsletter(
  email: string | null,
  product: "moyiq" | "invest",
  config: NewsletterConfig,
): Promise<void> {
  if (!email || !config.proxyUrl || !config.proxyToken) return;
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
      console.error(`subscribeToNewsletter: proxy error ${res.status} ${await res.text()} email=${email} product=${product}`);
    }
  } catch (err) {
    console.error(`subscribeToNewsletter: fallo de red email=${email} product=${product}`, err);
  }
}

// Doble opt-in (oct-2026, § 7 UWG): la suscripción automática al newsletter es
// marketing y solo corre si su variable de entorno vale exactamente "true"
// (NEWSLETTER_AUTO_SUBSCRIBE_FREE en notify-admin-signup,
// NEWSLETTER_AUTO_SUBSCRIBE_PRO en stripe-webhook). Sin variable: apagada.
export function autoSubscribeEnabled(envValue: string | null | undefined): boolean {
  return envValue === "true";
}
