# Política de privacidad: propuesta de cambios por Inversiones (para revisión legal)

Fecha: 23-nov-2026. Origen: revisión final de F7 (Ajustes › Inversiones).
Estado: **propuesta, sin aplicar**. `src/pages/legal/privacyContent.jsx` no se
tocó. Lo aplica quien revise el texto legal (es + en; pt y de se traducen
después a partir del texto aprobado).

## Por qué

La política dice hoy que en Inversiones solo las **posiciones** se guardan en
nuestro servidor y que "tus movimientos siguen en tu dispositivo". No es así
desde la versión web de Inversiones y F7: en la cuenta de la persona, en
nuestro servidor (Supabase, us-east-2), se guardan también los movimientos, los
activos que sigue, las alertas de precio, el capital de referencia y los planes
guardados. El texto de la app (`invest.privacy`, la Ayuda `hlp.a.where`) ya se
corrigió el 23-nov-2026 por delegación de Walter; la política tiene que decir lo
mismo.

Qué hay y dónde vive (según el código de este repo):

| Dato | Dónde |
|---|---|
| Posiciones | tabla `portfolio_holdings` |
| Movimientos (compras, ventas, depósitos, dividendos) | tabla `invest_operations` |
| Activos que sigues | tabla `watchlist` |
| Alertas de precio | tabla `invest_alerts` |
| Capital de referencia, regla de riesgo, planes guardados, perfil de inversionista | metadatos de la cuenta (servicio de autenticación) |
| Totales de Panorama y aporte del mes | solo en el dispositivo (`fos_invest_snapshot_v1`, `fos_invest_aporte_monthly`) |
| Objetivos de Portafolio | solo en memoria mientras la app está abierta (van en la copia JSON si se exporta) |
| Finanzas personales | en el dispositivo; solo salen con la sincronización (punto 5, sin cambios) |

Todas las filas tienen RLS por `user_id`: solo la persona, con su sesión, las
lee o las cambia. Se pueden exportar (CSV/JSON) y borrar desde Ajustes ›
Inversiones sin borrar la cuenta; eliminar la cuenta también las borra.

## Cambio 1: Resumen (recuadro inicial)

**es**, reemplazar:

> Las posiciones de Inversiones, si se usa esa sección, se guardan en nuestro servidor (punto 4).

por:

> Lo que se registra en Inversiones, si se usa esa sección (posiciones, movimientos, activos que se siguen, alertas, capital de referencia y planes), se guarda en la cuenta, en nuestro servidor (punto 4).

**en**, reemplazar:

> Investments positions, if you use that section, are stored on our server (section 4).

por:

> What you record in Investments, if you use that section (holdings, transactions, the assets you follow, alerts, reference capital and plans), is stored in your account on our server (section 4).

## Cambio 2: punto 4, viñeta "Inversiones"

**es**, reemplazar la viñeta completa por:

> **Inversiones (opcional, apagado por defecto):** lo que registras en moyiq · Inversiones (en la app o en invest.moyiq.app) se guarda en nuestro servidor, asociado a tu cuenta, para que puedas verlo en cualquier dispositivo: tus posiciones, tus movimientos (compras, ventas, depósitos y dividendos), los activos que sigues, tus alertas de precio, tu capital de referencia, tu regla de riesgo y tus planes guardados. Solo tú, con tu sesión iniciada, puedes verlos o cambiarlos. Para obtener las cotizaciones, la app envía a la API de Inversiones solo los símbolos de los activos. En tu dispositivo quedan solo los totales que muestra Panorama y el aporte del mes. Tus finanzas personales siguen en tu dispositivo (ver el punto 5 sobre la sincronización). Puedes descargar una copia (CSV o JSON) o eliminar estos datos desde Más › Ajustes › Inversiones sin eliminar tu cuenta; eliminar la cuenta también los borra. Base: ejecución de lo que pides.

**en**, reemplazar la viñeta completa por:

> **Investments (optional, off by default):** what you record in moyiq · Investments (in the app or at invest.moyiq.app) is stored on our server, linked to your account, so you can see it on any device: your holdings, your transactions (purchases, sales, deposits and dividends), the assets you follow, your price alerts, your reference capital, your risk rule and your saved plans. Only you, signed in, can see or change them. To get quotes, the app sends only the asset symbols to the Investments API. Only the totals shown in Overview and this month's contribution stay on your device. Your personal finances stay on your device (see section 5 about sync). You can download a copy (CSV or JSON) or delete this data from More › Settings › Investments without deleting your account; deleting the account also deletes it. Basis: performing what you ask for.

## Cambio 3: punto de derechos (eliminación de la cuenta)

**es**, después de "…incluido el perfil de inversionista." agregar:

> Los datos de Inversiones también se pueden borrar solos, sin eliminar la cuenta, desde Ajustes › Inversiones › Eliminar mis datos de Inversiones.

**en**, después de "…including the investor profile." agregar:

> Investments data can also be deleted on its own, without deleting the account, from Settings › Investments › Delete my Investments data.

## Para revisar

- Si la lista de encargados (punto de Supabase) debe nombrar "datos de Inversiones" en lugar de "posiciones de Inversiones".
- Si "apagado por defecto" sigue siendo cierto para la pestaña de Inversiones dentro de la app.
- Traducción pt y de una vez aprobado el texto.
