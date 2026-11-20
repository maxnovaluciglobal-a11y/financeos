# Eventos de conversión (Vercel Web Analytics)

Auditoría 360 del 19-nov-2026: WEB-N1 (parte sin datos personales), BIZ-N3 y V-WEB-FN1. Código en `src/utils/webAnalytics.js`.

## Qué se manda

`trackEvent(name, detail)` llama a `window.va('event', { name, data })`. Solo existe `window.va` en `app.moyiq.app` y `demo.moyiq.app`. Con No rastrear, GPC, `va-disable` o una cuenta interna (`isOptedOut`, la misma condición que el `beforeSend` de las visitas) no se calcula ni se encola nada. Como mucho dos propiedades por evento (el tope del plan Pro):

| Evento | Dónde | Propiedades |
|---|---|---|
| `signup_start` | AuthGate, pestaña Crear cuenta (correo o Google), una sola vez por pantalla (los reintentos tras un error no suman) | `src`, `method` |
| `signup_done` | Correo: AuthGate, alta aceptada (no cuenta ya existente). Google: App, en la carga que vuelve del OAuth con una cuenta de Google creada hace menos de 10 min (una vez por carga) | `src`, `method` |
| `checkout_start` | LicenseGate, ProGate y Ajustes, solo hacia el Payment Link con prueba | `src`, `plan` (`annual_trial` / `monthly_trial`; en ProGate sale del enlace que realmente se abre) |
| `demo_click` | LicenseGate, enlace a la demo | `src`, `from` |
| `demo_gate_pass` | DemoGate, al entrar a la demo | `src` |

`src` es el origen de **esta visita**, solo en memoria mientras la página está abierta (no se guarda en el dispositivo): `ref`, si no `utm_source` (+ `_utm_campaign`), si no el dominio de origen externo (`web` si viene de la landing `moyiq.app`), si no `directo`. Son los mismos `ref`, `utm_*` y sitio de origen que ya registra la visita. Etiqueta corta `[a-z0-9._-]`, máximo 40 caracteres; un valor con `@` se descarta. Nunca va con el alta ni a la base, ni lleva email, id de cuenta o datos financieros.

Límites conocidos: el alta con Google iniciada desde la pestaña Iniciar sesión cuenta en `signup_done` pero no en `signup_start`; y el origen no sobrevive a otra carga (por ejemplo, abrir el enlace de confirmación del correo). Guardar el origen de la primera visita en el dispositivo (punto 2 de WEB-N1) queda pendiente del OK de Walter y de actualizar la política de privacidad.

## Excluir el tráfico interno

Abrir `https://app.moyiq.app/app/?interno=1` (y `https://demo.moyiq.app/app/?interno=1`) una vez en cada navegador de trabajo: guarda `va-disable` y ese navegador deja de contar. `?interno=0` lo revierte. La landing tiene el mismo parámetro en `moyiq.app/?interno=1` (cada dominio es otro origen: hay que activarlo en los tres).

Los eventos personalizados requieren el plan Pro del team en Vercel; con otro plan el panel no los muestra.
