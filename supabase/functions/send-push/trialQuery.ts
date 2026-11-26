// Licencias a las que send-push avisa "Tu prueba vence" (auditoría 360, BIZ-N4).
// Antes filtraba solo por expires_at, y desde T10 toda suscripción paga tiene
// expires_at = fin del período: el aviso de fin de prueba le iba a llegar a cada
// suscriptor pago antes de la renovación. Ahora: solo licencias de prueba
// (is_trial) cuya prueba termina (trial_ends_at) en las próximas `hours` horas.
// Una prueba que ya se convirtió en pago tiene trial_ends_at en el pasado, así
// que tampoco entra.
// Modelo A (26-nov-2026): la prueba de 14 días sin tarjeta (start_pro_trial) es
// una licencia is_trial sin suscripción de Stripe. A esa no se le manda este push
// ("tus datos se quedan si decides continuar" sugiere un cobro que no existe):
// sus avisos de los días 10 y 13 los muestra la app. Solo pruebas con tarjeta
// (stripe_subscription_id presente).
export function expiringTrialsPath(now: Date, hours = 72): string {
  const from = now.toISOString();
  const cutoff = new Date(now.getTime() + hours * 3600 * 1000).toISOString();
  return `licenses?select=key_hash,trial_ends_at&status=eq.active&is_trial=eq.true&stripe_subscription_id=not.is.null` +
    `&trial_ends_at=not.is.null&trial_ends_at=lte.${cutoff}&trial_ends_at=gt.${from}` +
    // Una licencia ya vencida (o revocada a mano con expires_at en el pasado) no recibe avisos.
    `&or=(expires_at.is.null,expires_at.gt.${from})`;
}

export function trialDaysLeft(trialEndsAt: string, now: Date): number {
  return Math.max(1, Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / 86400000));
}
