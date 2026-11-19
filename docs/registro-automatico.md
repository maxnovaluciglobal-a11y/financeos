# Gastos que se registran solos — fase 1 (PWA, 19-nov-2026)

Interruptor: `UI_FLAGS.registroAutomatico` en `src/utils/uiFlags.js` (`false` lo apaga en producción; demo y `npm run dev` lo siguen mostrando).

| Pieza | Archivo |
|---|---|
| Contrato de URL, saneado, guardado en la pestaña | `src/utils/autoEntry.js` (+ `autoEntry.test.js`) |
| Captura antes del primer render y limpieza de la URL | `src/main.jsx` (`captureIntake`) |
| Apertura de la hoja con el alta escrita | `src/components/QuickAdd.jsx` → `QuickAddForm.jsx` (`prefill`) |
| Dictado: frase → línea | `src/utils/voiceEntry.js` (+ `voiceEntry.test.js`, 80 casos) |
| Web Speech API | `src/hooks/useSpeechEntry.js` |
| Guía | Ajustes › Registro automático (`src/pages/Settings/AutoEntryScreen.jsx`) |
| Micrófono permitido al propio origen | `vercel.json` → `Permissions-Policy: microphone=(self)` (test en `scripts/securityHeaders.test.js`) |

## Contrato de la URL (se reutiliza tal cual en la app nativa)

```
https://app.moyiq.app/app/?add=gasto&monto=12500&comercio=Lider&moneda=CLP&fuente=applepay
moyiq://add?add=gasto&monto=12500&comercio=Lider&moneda=CLP&fuente=applepay   (fase 2)
```

| Parámetro | Valores | Si no sirve |
|---|---|---|
| `add` (obligatorio) | `gasto` / `ingreso` (alias `expense`, `income`, `egreso`) | no hay alta (la URL igual se limpia) |
| `monto` | como lo escribe el Atajo: `12500`, `$12.500`, `12,50 €`, `CLP 12.500`, `US$ 5.99`. Máx. 40 caracteres | negativo → aviso "negativo"; cero, `NaN`, `1e5`, texto o > 1e11 → "no se entiende"; dos lecturas (`4.500` en MXN) → "escríbelo" |
| `comercio` | texto → descripción. Sin HTML, sin caracteres de control ni bidi, máx. 60 | vacío |
| `moneda` | ISO 4217 (3 letras). Manda sobre el símbolo del monto | se usa la del símbolo o la de la cuenta |
| `fuente` | `applepay`, `atajo`, `widget`, `app` | `otra` |
| `fecha` | `AAAA-MM-DD`, no futura | hoy |

Reglas: **nunca se guarda solo** (cualquiera puede armar el enlace: riesgo tipo CSRF); la persona ve "Desde Apple Pay · Revisa el monto y la categoría" y toca Guardar. La categoría sale de las reglas aprendidas y de las semillas (`findCategory` de `quickLine.js`; se sumaron marcas comunes: Lider, Jumbo, Copec, Starbucks…). Otra moneda que no sea la de la cuenta no se convierte (US$ solo con tasa guardada, en "Escribir en US$"). El alta se guarda en `sessionStorage` (`fnos_intake_pending`, 15 min, se lee una vez y se vuelve a sanear) para sobrevivir al login; la URL se limpia con `history.replaceState` antes del primer render, conservando `?demo=true` y el resto.

## Safari vs. la app instalada (hallazgo honesto)

En iOS, un Atajo con "Abrir URL" abre **Safari**, no la PWA de la pantalla de inicio, y iOS da a cada app web instalada **su propio almacenamiento** (IndexedDB, localStorage, cookies), separado del de Safari. Consecuencia:

- Quien usa moyiq **en Safari**: funciona de punta a punta.
- Quien usa moyiq **desde la pantalla de inicio** (la mayoría): la hoja se abre en Safari, con otra base (y probablemente sin sesión). Si guarda ahí, el gasto queda en los datos de Safari y **no aparece en la app**. La hoja lo avisa ("Esto se abrió en Safari…", detectado con `isIosSafariTab`) y ofrece **Copiar para pegarlo en la app** (texto "Lider $12.500", que la línea de "Más opciones" entiende).
- No hay forma, desde la web, de abrir la PWA instalada desde un Atajo. La solución robusta es la app nativa (fase 2).

## Atajo para compartir (TODO de Walter)

No se puede publicar un enlace de iCloud desde acá. Pasos, en el iPhone de la cuenta de empresa:

1. Atajos › Automatización › Nueva automatización › Transacción › elegir tarjetas › "Ejecutar inmediatamente" › Siguiente › "Nueva automatización en blanco".
2. Acción **URL**: `https://app.moyiq.app/app/?add=gasto&fuente=applepay&monto=` + variable **Importe** + `&comercio=` + variable **Comercio** (si falla con espacios, antes una acción **Codificar URL** sobre Comercio).
3. Acción **Abrir URL**. Probar con una compra real.
4. Las automatizaciones no se comparten por iCloud: crear además un **atajo** normal (pestaña Atajos) con las mismas acciones que reciba la entrada, compartirlo (Compartir › Copiar enlace de iCloud) y pegar el enlace en `SHORTCUT_ICLOUD_URL` de `src/pages/Settings/AutoEntryScreen.jsx`. La guía muestra "Instalar el Atajo" cuando no está vacío.

## Dictado

Botón "Dictar" junto a la fecha en el "+" (solo si el navegador tiene `SpeechRecognition`/`webkitSpeechRecognition`: Safari iOS 14.5+, Chrome). Tocar para empezar; se corta solo al callar o con "Listo" (no "mantener para hablar": en iOS el toque es el gesto que habilita el reconocimiento). Idioma: `speechLang(idioma, país)` (es-CL, en-US, pt-BR, de-DE…). La frase pasa por `spokenToLine` (números con palabras en es/en/pt/de, compuestos alemanes, "con 50"/"coma"/"Komma", "3 Euro 50", "medio palo", "una luca y media", "hace 3 días", "bucks", "bolos") y `parseVoiceLine` (quita "anota un gasto de…", "ich habe … für"). Si el monto no es claro se abre "Más opciones" con la pregunta. Nunca guarda.

Privacidad: Safari y Chrome pueden mandar el audio a Apple o Google para transcribirlo; moyiq recibe solo el texto y lo interpreta en el dispositivo. Se dice en la hoja y en la guía. En iPhone, si el Dictado del sistema está apagado, el error `service-not-allowed` muestra cómo activarlo.

## Fase 2 (app nativa con Capacitor)

- URL scheme `moyiq://add?…` con los mismos parámetros: el plugin `App` (`appUrlOpen`) navega el WKWebView a `https://app.moyiq.app/app/?<misma query>` y todo lo de arriba funciona igual, en el almacenamiento de la app.
- App Intent "Registrar gasto" (monto, comercio, moneda) para que el Atajo de Transacción lo llame sin abrir Safari; idealmente con confirmación dentro del Intent.
- Dictado nativo (`SFSpeechRecognizer` con `requiresOnDeviceRecognition`) para que el audio no salga del teléfono.
- Universal Links para `app.moyiq.app/app/` (abrir en la app en vez de Safari).
