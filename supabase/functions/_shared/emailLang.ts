// supabase/functions/_shared/emailLang.ts
//
// Idioma de los correos transaccionales (auth, licencia, fin de prueba,
// reporte). La app tiene 4 idiomas; el servidor no guarda el de cada usuario,
// así que cada función lo toma de la mejor señal que tenga a mano y cae a
// español (comportamiento histórico) si no hay ninguna:
//   - auth-email-hook: user.user_metadata.lang (lo pone signUp() en el cliente)
//   - stripe-webhook:  client_reference_id 'lang_xx' del Payment Link, después
//                      session.locale y preferred_locales del customer si
//                      vienen en el evento
//   - send-report-email: el `lang` que manda el cliente
export type EmailLang = 'es' | 'en' | 'pt' | 'de';
export const EMAIL_LANGS: EmailLang[] = ['es', 'en', 'pt', 'de'];

// 'pt-BR' → 'pt', 'EN' → 'en', 'auto'/'fr'/basura → null.
export function normalizeLang(value: unknown): EmailLang | null {
  if (typeof value !== 'string') return null;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return (EMAIL_LANGS as string[]).includes(base) ? (base as EmailLang) : null;
}

// Primer candidato reconocible; si ninguno, 'es'.
export function pickLang(...candidates: unknown[]): EmailLang {
  for (const c of candidates) {
    if (Array.isArray(c)) {
      for (const x of c) { const l = normalizeLang(x); if (l) return l; }
      continue;
    }
    const l = normalizeLang(c);
    if (l) return l;
  }
  return 'es';
}

// El Payment Link no acepta un parámetro de idioma, pero sí
// client_reference_id (alfanumérico, guion y guion bajo; documentado en
// https://docs.stripe.com/payment-links/url-parameters) y Stripe lo devuelve
// en checkout.session.completed. La app manda 'lang_en', 'lang_pt', etc.
export function langFromClientReference(ref: unknown): EmailLang | null {
  if (typeof ref !== 'string') return null;
  const m = ref.match(/^lang[_-]([a-z]{2})$/i);
  return m ? normalizeLang(m[1]) : null;
}

// session.locale puede ser 'auto' (= idioma del navegador, que Stripe no nos
// dice): en ese caso no sirve y se sigue con lo siguiente.
export function langFromStripeSession(session: any): EmailLang {
  return pickLang(
    langFromClientReference(session?.client_reference_id),
    session?.locale,
    typeof session?.customer === 'object' ? session.customer?.preferred_locales : null,
    session?.metadata?.lang,
  );
}

// customer.subscription.trial_will_end trae la suscripción, sin el customer
// expandido: solo hay idioma si viene expandido o en metadata. Si no, 'es'.
export function langFromStripeSubscription(sub: any): EmailLang {
  return pickLang(
    sub?.metadata?.lang,
    typeof sub?.customer === 'object' ? sub.customer?.preferred_locales : null,
  );
}

// Locale de Intl para fechas y montos en cada idioma.
export const INTL_LOCALE: Record<EmailLang, string> = { es: 'es-ES', en: 'en-US', pt: 'pt-BR', de: 'de-DE' };
