// Licencias a las que send-push avisa "Tu prueba vence" (auditoría 360, BIZ-N4).
// Antes filtraba solo por expires_at, y desde T10 toda suscripción paga tiene
// expires_at = fin del período: el aviso de fin de prueba le iba a llegar a cada
// suscriptor pago antes de la renovación. Ahora: solo licencias de prueba
// (is_trial) cuya prueba termina (trial_ends_at) en las próximas `hours` horas.
// Una prueba que ya se convirtió en pago tiene trial_ends_at en el pasado, así
// que tampoco entra.
export function expiringTrialsPath(now: Date, hours = 72): string {
  const from = now.toISOString();
  const cutoff = new Date(now.getTime() + hours * 3600 * 1000).toISOString();
  return `licenses?select=key_hash,trial_ends_at&status=eq.active&is_trial=eq.true` +
    `&trial_ends_at=not.is.null&trial_ends_at=lte.${cutoff}&trial_ends_at=gt.${from}`;
}

export function trialDaysLeft(trialEndsAt: string, now: Date): number {
  return Math.max(1, Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / 86400000));
}
