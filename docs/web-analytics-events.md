# Eventos de conversión (Vercel Web Analytics)

Auditoría 360 del 19-nov-2026: WEB-N1 (parte sin datos personales), BIZ-N3 y V-WEB-FN1. Código en `src/utils/webAnalytics.js`.

## Qué se manda

`trackEvent(name, detail)` llama a `window.va('event', { name, data })`. Solo existe `window.va` en `app.moyiq.app` y `demo.moyiq.app`, y pasa por el mismo `beforeSend` que las visitas (No rastrear, GPC, `va-disable`, cuentas internas). Como mucho dos propiedades por evento (el tope del plan Pro):

| Evento | Dónde | Propiedades |
|---|---|---|
| `signup_start` | AuthGate, pestaña Crear cuenta (correo o Google) | `src`, `method` |
| `signup_done` | AuthGate, alta con correo aceptada (no cuenta ya existente) | `src`, `method` |
| `checkout_start` | LicenseGate, ProGate y Ajustes, solo hacia el Payment Link con prueba | `src`, `plan` (`annual_trial` / `monthly_trial`) |
| `demo_click` | LicenseGate, enlace a la demo | `src`, `from` |
| `demo_gate_pass` | DemoGate, al entrar a la demo | `src` |

`src` es el origen de la primera visita en este dispositivo (`localStorage['fnos_first_touch']`, 90 días, clave de dispositivo y no de cuenta): `ref`, si no `utm_source` (+ `_utm_campaign`), si no el dominio de origen externo, si no `directo`. Etiqueta corta `[a-z0-9._-]`, máximo 40 caracteres; un valor con `@` se descarta. Nunca va con el alta ni a la base, ni lleva email, id de cuenta o datos financieros.

## Excluir el tráfico interno

Abrir `https://app.moyiq.app/app/?interno=1` (y `https://demo.moyiq.app/app/?interno=1`) una vez en cada navegador de trabajo: guarda `va-disable` y ese navegador deja de contar. `?interno=0` lo revierte. La landing tiene el mismo parámetro en `moyiq.app/?interno=1` (cada dominio es otro origen: hay que activarlo en los tres).

Los eventos personalizados requieren el plan Pro del team en Vercel; con otro plan el panel no los muestra.
