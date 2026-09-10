// public/push-sw.js
// Listeners de notificaciones push. Se inyecta al Service Worker que genera
// vite-plugin-pwa (vía workbox.importScripts) — NO reemplaza ni toca la lógica
// de caché/offline existente, solo agrega estos dos eventos.
//
// Privacidad: el "payload" que llega acá es SIEMPRE un recordatorio de sistema
// (texto fijo tipo "tu prueba vence en 3 días"), nunca datos financieros —
// esos siguen cifrados de extremo a extremo y el servidor no puede leerlos.

self.addEventListener('push', (event) => {
  let data = { title: 'MOY IQ', body: 'Tenés una notificación nueva.' };
  try { if (event.data) data = { ...data, ...event.data.json() } } catch {}

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
