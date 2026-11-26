// Botones de los correos hacia la app (auditoría 360, COM-2).
//
// La app vive bajo /app/ y no enruta por ruta: navega por estado y lee el
// destino de ?open= (src/utils/deepLink.js). Hasta el 19-oct-2026 los correos
// apuntaban a app.moyiq.app/import, /dashboard, /upgrade y /signup, rutas que
// no existen (404 de Vercel desde el borde, sin HTML). Un destino nuevo se agrega
// acá, en deepLink.js y en las redirecciones de vercel.json.
export const APP_URL = "https://app.moyiq.app/app/";

// "delete-account" (C-22): enlace público de borrado de cuenta que piden las tiendas.
// "plan" (26-nov-2026): Ajustes, donde está "Suscripción y plan" (aviso de los
// 10 días de la prueba de Pro sin tarjeta: elegir un plan). "upgrade" abre Modo
// Asesor, que para quien ya es Pro (en prueba) no muestra los planes.
export const APP_DESTINATIONS = ["import", "dashboard", "upgrade", "signup", "delete-account", "plan"] as const;

export type AppDestination = typeof APP_DESTINATIONS[number];

export function appLink(open: AppDestination, ref: string): string {
  return `${APP_URL}?open=${open}&ref=${encodeURIComponent(ref)}`;
}
