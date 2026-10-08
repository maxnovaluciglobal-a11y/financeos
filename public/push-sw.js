// public/push-sw.js
// Listeners de notificaciones push. Se inyecta al Service Worker que genera
// vite-plugin-pwa (vía workbox.importScripts) — NO reemplaza ni toca la lógica
// de caché/offline existente, solo agrega estos dos eventos.
//
// Privacidad: el "payload" que llega acá es SIEMPRE un recordatorio de sistema
// (texto fijo tipo "tu prueba vence en 3 días"), nunca datos financieros —
// esos siguen cifrados de extremo a extremo y el servidor no puede leerlos.

// Textos en el idioma del navegador. El servidor no sabe el idioma del usuario
// (push_subscriptions no lo guarda), así que manda `i18n: { key, ...vars }` y
// el texto se arma acá; `body` del payload queda como respaldo en español.
// El SW no puede leer los ajustes de la app (localStorage), por eso usa
// navigator.language — el mismo criterio del primer arranque.
const PUSH_TEXT = {
  es: { generic: 'Tienes una notificación nueva.', trialExpiring: (n) => `Tu prueba vence en ${n} ${n === 1 ? 'día' : 'días'}. Tus datos se quedan si decides continuar.` },
  en: { generic: 'You have a new notification.', trialExpiring: (n) => `Your trial ends in ${n} ${n === 1 ? 'day' : 'days'}. Your data stays if you decide to continue.` },
  pt: { generic: 'Você tem uma notificação nova.', trialExpiring: (n) => `Seu teste termina em ${n} ${n === 1 ? 'dia' : 'dias'}. Seus dados continuam se você decidir seguir.` },
  de: { generic: 'Sie haben eine neue Benachrichtigung.', trialExpiring: (n) => `Ihre Testphase endet in ${n} ${n === 1 ? 'Tag' : 'Tagen'}. Ihre Daten bleiben erhalten, wenn Sie weitermachen.` },
};
function pushLang() {
  const base = String((self.navigator && self.navigator.language) || 'es').slice(0, 2).toLowerCase();
  return PUSH_TEXT[base] ? base : 'es';
}

self.addEventListener('push', (event) => {
  const T = PUSH_TEXT[pushLang()];
  let data = { title: 'MOY IQ', body: T.generic };
  try { if (event.data) data = { ...data, ...event.data.json() } } catch {}
  if (data.i18n && data.i18n.key === 'trialExpiring' && Number(data.i18n.days) > 0) {
    data.body = T.trialExpiring(Number(data.i18n.days));
  }

  const options = {
    body: data.body,
    icon: '/app/icon-192.png',
    badge: '/app/icon-192.png',
    tag: data.tag || 'financeos-reminder',
    data: { url: data.url || '/app/' },
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/app/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/app/') && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
