// public/push-sw.js
// Listeners de notificaciones push. Se inyecta al Service Worker que genera
// vite-plugin-pwa (vía workbox.importScripts) — NO reemplaza ni toca la lógica
// de caché/offline existente, solo agrega estos dos eventos.
//
// Privacidad: el "payload" que llega acá es un recordatorio de sistema (texto
// fijo tipo "tu prueba vence en 3 días") o una alerta de precio de Inversiones
// (invest-alerts-check: símbolo, nivel y precio de mercado; nunca posiciones,
// montos ni movimientos, que siguen cifrados o solo en el dispositivo).

// Textos en el idioma del navegador. El servidor no sabe el idioma del usuario
// (push_subscriptions no lo guarda), así que manda `i18n: { key, ...vars }` y
// el texto se arma acá; `body` del payload queda como respaldo en español.
// El SW no puede leer los ajustes de la app (localStorage), por eso usa
// navigator.language — el mismo criterio del primer arranque.
const PUSH_TEXT = {
  es: {
    generic: 'Tienes una notificación nueva.',
    trialExpiring: (n) => `Tu prueba vence en ${n} ${n === 1 ? 'día' : 'días'}. Tus datos se quedan si decides continuar.`,
    alertTitle: (t) => `Alerta de precio · ${t}`,
    above: (t, p, l) => `${t} subió a ${p}. Tu nivel: ${l}.`,
    below: (t, p, l) => `${t} bajó a ${p}. Tu nivel: ${l}.`,
    pctMove: (t, pct, l) => `${t} se movió ${pct} % hoy. Tu aviso: ${l} % o más.`,
  },
  en: {
    generic: 'You have a new notification.',
    trialExpiring: (n) => `Your trial ends in ${n} ${n === 1 ? 'day' : 'days'}. Your data stays if you decide to continue.`,
    alertTitle: (t) => `Price alert · ${t}`,
    above: (t, p, l) => `${t} rose to ${p}. Your level: ${l}.`,
    below: (t, p, l) => `${t} fell to ${p}. Your level: ${l}.`,
    pctMove: (t, pct, l) => `${t} moved ${pct}% today. Your alert: ${l}% or more.`,
  },
  pt: {
    generic: 'Você tem uma notificação nova.',
    trialExpiring: (n) => `Seu teste termina em ${n} ${n === 1 ? 'dia' : 'dias'}. Seus dados continuam se você decidir seguir.`,
    alertTitle: (t) => `Alerta de preço · ${t}`,
    above: (t, p, l) => `${t} subiu para ${p}. Seu nível: ${l}.`,
    below: (t, p, l) => `${t} caiu para ${p}. Seu nível: ${l}.`,
    pctMove: (t, pct, l) => `${t} se moveu ${pct}% hoje. Seu alerta: ${l}% ou mais.`,
  },
  de: {
    generic: 'Sie haben eine neue Benachrichtigung.',
    trialExpiring: (n) => `Ihre Testphase endet in ${n} ${n === 1 ? 'Tag' : 'Tagen'}. Ihre Daten bleiben erhalten, wenn Sie weitermachen.`,
    alertTitle: (t) => `Preisalarm · ${t}`,
    above: (t, p, l) => `${t} ist auf ${p} gestiegen. Ihr Niveau: ${l}.`,
    below: (t, p, l) => `${t} ist auf ${p} gefallen. Ihr Niveau: ${l}.`,
    pctMove: (t, pct, l) => `${t} hat sich heute um ${pct} % bewegt. Ihr Alarm: ${l} % oder mehr.`,
  },
};
const PUSH_LOCALE = { es: 'es', en: 'en-US', pt: 'pt-BR', de: 'de-DE' };

// Alerta de precio (invest-alerts-check): { key: 'priceAlert', t, cond, level, price, pct, ccy }.
function priceAlertText(T, lang, i) {
  const t = String(i.t || '').slice(0, 15);
  if (!t) return null;
  const nf = (v, d = 2) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString(PUSH_LOCALE[lang] || 'es', { maximumFractionDigits: d }) : '—';
  };
  const ccy = i.ccy && i.ccy !== 'USD' ? ` ${String(i.ccy).slice(0, 5)}` : '';
  if (i.cond === 'above') return { title: T.alertTitle(t), body: T.above(t, nf(i.price) + ccy, nf(i.level) + ccy) };
  if (i.cond === 'below') return { title: T.alertTitle(t), body: T.below(t, nf(i.price) + ccy, nf(i.level) + ccy) };
  if (i.cond === 'pct_move') return { title: T.alertTitle(t), body: T.pctMove(t, nf(i.pct), nf(i.level)) };
  return null;
}
function pushLang() {
  const base = String((self.navigator && self.navigator.language) || 'es').slice(0, 2).toLowerCase();
  return PUSH_TEXT[base] ? base : 'es';
}

self.addEventListener('push', (event) => {
  const T = PUSH_TEXT[pushLang()];
  let data = { title: 'moyiq', body: T.generic };
  try { if (event.data) data = { ...data, ...event.data.json() } } catch {}
  if (data.i18n && data.i18n.key === 'trialExpiring' && Number(data.i18n.days) > 0) {
    data.body = T.trialExpiring(Number(data.i18n.days));
  }
  if (data.i18n && data.i18n.key === 'priceAlert') {
    const txt = priceAlertText(T, pushLang(), data.i18n);
    if (txt) { data.title = txt.title; data.body = txt.body; }
  }

  const options = {
    body: data.body,
    icon: '/app/icon-192.png',          // ícono de app: lupa blanca sobre morado
    badge: '/app/notification-96.png',  // barra de estado de Android: monocromo, blanco sobre transparente
    tag: data.tag || 'financeos-reminder',
    data: { url: data.url || '/app/' },
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Le pide a una ventana abierta de la app que vaya al destino del aviso SIN
// recargar (no se pierde lo que estaba a medio llenar). La app contesta por el
// MessageChannel (src/utils/swOpen.js); sin respuesta en 1 s, false.
function askClientToOpen(client, open) {
  return new Promise((resolve) => {
    if (typeof MessageChannel === 'undefined' || typeof client.postMessage !== 'function') { resolve(false); return; }
    const ch = new MessageChannel();
    const done = (ok) => { clearTimeout(timer); try { ch.port1.close(); } catch (e) { /* ya cerrado */ } resolve(ok); };
    const timer = setTimeout(() => done(false), 1000);
    ch.port1.onmessage = (e) => done(!!(e.data && e.data.ok));
    try { client.postMessage({ type: 'moyiq-open', open }, [ch.port2]); } catch (e) { done(false); }
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/app/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const target = new URL(url, self.location.origin);
      const open = target.searchParams.get('open');
      for (const client of clients) {
        if (!client.url.includes('/app/') || !('focus' in client)) continue;
        // App ya abierta (pestaña o PWA en segundo plano): se enfoca y, si el
        // aviso apunta a un lugar (?open=invest-alertas), se lleva ahí SIEMPRE,
        // aunque la URL de la ventana ya sea esa (la app navega por estado y no
        // la cambia). Primero sin recargar (mensaje); si la app no contesta,
        // navigate() como respaldo.
        return client.focus().then((c) => {
          const w = c || client;
          if (!open) return w;
          return askClientToOpen(w, open).then((ok) => (ok || !('navigate' in w) ? w : w.navigate(target.href).catch(() => w)));
        });
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
