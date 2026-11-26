// Textos de la prueba de 14 días de Pro sin tarjeta (modelo A, 26-nov-2026):
// oferta después del onboarding, recordatorios de los días 10 y 13 y vuelta a
// Starter. Fuera de src/i18n/es.js para no pesar en la carga inicial
// (scripts/bundleBudget.js): viajan con components/ProTrialNotices.jsx.
// Mismas claves en los 4 idiomas (investStrings.test.js, withSections.js).
export default {
  "proTrial.offer.title": "Empieza {days} días de Pro gratis, sin tarjeta",
  "proTrial.offer.body": "Usa todo Pro con tus datos. Al terminar vuelves a Starter: no se cobra nada y tus datos siguen aquí.",
  "proTrial.offer.includes": "Pro incluye",
  "proTrial.offer.starter": "Seguir con Starter",
  "proTrial.offer.later": "Si prefieres, puedes empezarla después desde Ajustes › Suscripción y plan.",
  "proTrial.feature.sync": "Sincronización cifrada entre tus dispositivos",
  "proTrial.feature.push": "Avisos en el navegador",
  "proTrial.feature.advisor": "Modo Asesor",
  "proTrial.feature.reports": "Reportes en PDF",
  "proTrial.feature.cashflow": "Proyección de flujo",
  "proTrial.feature.debtSim": "Simulador de deudas",
  "proTrial.feature.country": "Herramientas fiscales de tu país",
  "proTrial.feature.projects": "Propiedades",
  "proTrial.reminder.title": "Te quedan {n} días de Pro",
  "proTrial.reminder.titleOne": "Te queda 1 día de Pro",
  "proTrial.reminder.used": "Hasta ahora usaste: {list}.",
  "proTrial.reminder.none": "Todavía no has abierto ninguna herramienta de Pro. Puedes probar: {list}.",
  "proTrial.reminder.after": "El {date} vuelves a Starter sin perder nada. Para seguir con Pro, elige un plan.",
  "proTrial.reminder.buy": "Ver planes de Pro",
  "proTrial.reminder.close": "Seguir probando",
  "proTrial.ended.title": "Volviste a Starter; tus datos siguen aquí",
  "proTrial.ended.body": "Terminaron tus {days} días de Pro y no se cobró nada. Todo lo que anotaste sigue en la app y Starter es gratis para siempre.",
  "proTrial.ended.used": "Durante la prueba usaste: {list}.",
  "proTrial.ended.ok": "Entendido",
}
