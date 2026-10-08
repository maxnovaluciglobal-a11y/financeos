// supabase/functions/_shared/newsletterSubscribe.ts
//
// Suscribe un email a la publication de beehiiv correspondiente (moyiq |
// invest) vía el proxy ya existente en Vercel (moyiq-newsletter-proxy,
// endpoint /api/subscribe) — ese proxy es el único lugar con la
// BEEHIIV_API_KEY real, así que ninguna función de Supabase la necesita.
// Reusado desde stripe-webhook (altas Pro/Personal pagas) y
// notify-admin-signup (altas Starter/Invest gratuitas) — pedido de Walter
// 21-sep-2026: "el usuario Pro también debería recibirla" tras notar que la
// publication MOY IQ en beehiiv solo tenía su propia cuenta suscrita, sin
// ninguna conexión automática desde la app.
//
// Best-effort a propósito, igual criterio que notifyNewProPurchase/
// notifyKeyDeliveryFailure: la licencia/registro ya se completó y la
// respuesta 200 ya se decidió antes de esto, así que un fallo acá (beehiiv
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

// Doble opt-in (oct-2026, § 7 UWG): la suscripción automática a beehiiv es
// marketing y solo corre si su variable de entorno vale exactamente "true"
// (NEWSLETTER_AUTO_SUBSCRIBE_FREE en notify-admin-signup,
// NEWSLETTER_AUTO_SUBSCRIBE_PRO en stripe-webhook). Sin variable: apagada.
export function autoSubscribeEnabled(envValue: string | null | undefined): boolean {
  return envValue === "true";
}
