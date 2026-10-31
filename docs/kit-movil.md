# Kit móvil medido (V1): MOY IQ frente a rial

**Fecha:** 29/30-oct-2026 · **Segunda ronda** · Propuesta para `financeos-app/docs/kit-movil.md` (extiende `docs/sistema-visual.md`). **No se tocó código.** Cuando Walter lo apruebe, se copia al repo dentro del worktree de V2.

## Reglas vigentes (31-oct-2026, decisiones de Walter sobre la tercera ronda)

Mandan sobre lo que dicen las tablas de abajo, que son la medición de V1:
- **Radios:** 8–12 en tarjetas, botones y campos. **Píldora permitida** en segmentados, chips y etiquetas de monto o estado (`--r-pill`). Las hojas llevan 20 arriba (`--r-sheet`).
- **Trazos:** sin borde en lo que no se edita. Claro: sombra suave (`--box-sh`). Oscuro: escalón de superficie. El borde queda en los campos editables (WCAG 1.4.11).
- **Barra de pestañas:** ícono relleno y tinta en la activa, 82 % de opacidad con desenfoque, y el "+" de 44 × 44 dentro de la barra, a la derecha. El "+" flotante queda solo en Ingresos, que no tiene barra.
- **Barra superior:** sin fila propia; los botones flotan en la línea del título, y el título compacto se liga al scroll. El título arranca en la misma Y en las 5 raíces.
- **Hoja:** salida animada, arrastre desde el contenido, velocidad, dos alturas (56 % y entera) y resorte con `linear()`. Abre entera por defecto; las listas largas pueden abrir a media altura (`initialDetent`).
- **Selectores:** `SheetSelect` en el teléfono; un solo control de mes ‹ ›, y tocar el mes abre la lista.
- **Tipografía:** fila 15, metadato 13, 12 solo para rótulos. CSS en `rem`; los tamaños en JSX siguen en px (próxima etapa).
- **Gestos:** todo gesto tiene un equivalente visible. No hay "tirar para actualizar".

## Cómo se midió

- **MOY IQ:** demo de producción (`demo.moyiq.app/app/?demo=true&persona=ve`) en el navegador integrado, emulando 390×844 y 375×667. Se leyó con un script la caja (`getBoundingClientRect`) y el estilo calculado de cada elemento interactivo de las 5 pestañas, del alta rápida y de la hoja de tasa. En iOS, 1 px CSS = 1 pt, así que se comparan directo con rial. Se contrastó con la cuenta real en el iPhone de Walter por el espejo, sin guardar capturas.
- **rial:** 46 capturas de la primera ronda. La pantalla ocupa 338×734 px y equivale a un iPhone de 393×852 pt (1 px ≈ 1,16 pt), con un margen de ±5 %. Hoy se revisaron en vivo Menú, Configuración, Apariencia, Seguridad, Notificaciones, Novedades y la lista de compras.
- **Reglas fijas de MOY IQ que no se negocian:** objetivo táctil de 44 px (plan §5b), radios de 8 a 12 px (la regla de píldoras cambió, ver arriba), un primario Latón por pantalla (`sistema-visual.md`, regla 4), estado con ícono más palabra, y axe en 0.

## 1. Medidas

| Componente | MOY IQ hoy (medido) | rial (capturas, pt aprox.) | Brecha |
|---|---|---|---|
| Barra de pestañas | 63 px de alto, anclada de borde a borde, 5 destinos de 77×56 | Píldora flotante de 54×281, a 20 del borde, 3 destinos | MOY IQ cumple; la píldora flotante de rial **tapa contenido** (su "Soporte" queda debajo) |
| Botón "+" | 56×56, **radio 50 % (círculo)**, a 16 px sobre la barra | 58–60, círculo lima | El círculo **contradice la regla "nunca pill"** de la marca: hay que documentar la excepción o pasar a 12 px |
| Botón primario | 44 de alto, radio 8, Plex Sans 14/600, Latón con texto Navy | 48 de alto, píldora, ancho completo al pie | MOY IQ cumple; en hojas y formularios conviene **48 de alto y ancho completo al pie** (como "Guardar") |
| Primarios por pantalla | Movimientos 3 (Start de la demo, "+ Agregar salida", "+"); Metas 3 sobre el pliegue (Start, "+ Nueva meta", "Empezar con mis datos"); Ajustes (cuenta real) varios "Aplicar" | 1, salvo los banners Plus | **Incumple la regla 4.** Es el trabajo principal de V2 |
| Chip de filtro | 36 de alto, radio 4, 13/500 | ≈ 27 a 32 | Debajo de 44 en Movimientos (10 chips). Pasar a 44 de área táctil (puede mantener 36 de dibujo con relleno) |
| Control segmentado | Gasto/Ingreso 168×40, radio 4 · VES/USD **44×26**, en Plex Mono 11 | ≈ 27 | VES/USD es el control más chico de la app: llevar a 44 de alto |
| Teclado numérico | Propio, 3×4, teclas de 110×48, radio 8, 18 px; coma o "000" según moneda | Propio, 4 columnas, teclas de 41×84 (píldora), ✓ en la 4.ª columna, 2.ª fila | MOY IQ ya tiene teclado propio. **Falta el confirmar dentro del teclado** |
| Confirmar en el alta | "Guardar" de 346×48 **al final de la hoja**: y=889 con pantalla de 844 (fuera, hay que bajar 93 px); y=863 con 667 (196 px fuera) | ✓ dentro del teclado, con su centro a ≈ 161 pt del borde inferior | **Brecha principal de R2.** Ver la decisión 3 |
| Casilla "Se repite" | Casilla de 16×16; área de su texto 72×20 | Interruptor | Debajo de 44: toda la fila debe ser tocable |
| Fila de lista | Altura ≥ 44, separador fino, ícono de categoría de 28 | ≈ 56, tarjetas redondeadas | MOY IQ cumple y es más denso; mantener |
| Tarjeta | Solo el héroe: radio 10, borde de 0,5 px, relleno 14×16. El resto, sin caja (líneas finas) | Radio 16, sombra suave | No copiar: la regla 1 ("líneas, no cajas") es identidad |
| Cifra principal | `.num-hero` 36 px / 600 en 390 de ancho | 44–48 | Mantener. MOY IQ muestra decimales y símbolo al 65 % |
| Título grande | 34 / 700 "MOY Bullet", con barra compacta al hacer scroll | 30–32 | Equivalente |
| Hoja inferior | `Sheet.jsx` con asa, gesto de cierre y cierre al tocar afuera; el alta rápida ocupa todo el alto (844) | Hojas a media altura con ✓ arriba a la derecha | Equivalente; el alta rápida es la única demasiado alta |
| Barra superior | Botones de 44×44 (recorrido, ojo); contexto "MOY IQ · VES" en Plex Sans 12 | Botones de ≈ 30 | MOY IQ cumple; rial no |
| Enlaces legales del Menú | 27 a 42 de ancho × 44 | — | Debajo de 44 de ancho (Privacidad, Términos, Ayuda): agrandar el área |
| Tema | Claro u oscuro manual; **no sigue al sistema** (`config.js:31`, siempre `light` por defecto) | Sistema, Claro y Oscuro, con miniaturas | Replicar la opción "Sistema" |

## 2. Decisión por componente

| Componente | Decisión | Detalle |
|---|---|---|
| Teclado con confirmar integrado | **Replicar el patrón** | ✓ en una 4.ª columna o en lugar de una tecla, a la altura del pulgar, Latón. Mantener la coma o "000" por moneda (rial obliga a usar "00": no copiar eso) |
| Orden del alta | **Adaptar** | Monto → teclado con ✓ → "¿En qué?" y categoría en una fila desplegable. "Pegar SMS", "Repetir" y Hoy/Ayer se conservan |
| Un primario por pantalla | **Replicar** (ya es regla propia) | "+ Agregar salida" pasa a **secundario** y no desaparece: es la única entrada a subcategoría, tipo, inversión, proyecto y suscripción (ver la decisión 2). En Metas, "+ Nueva meta" queda como único primario cuando no hay datos de demo |
| Botón "+" | **Adaptar** | Mantenerlo (funciona), pero cuadrado con radio de 12 a 14 px para respetar "nunca pill", o documentar la excepción. Decide Walter |
| Barra de pestañas | **No copiar** la píldora flotante | La anclada de MOY IQ no tapa contenido |
| Chips y segmentados | **Adaptar** | 44 de área táctil; radio 4 a 8; sin píldora |
| Tarjetas grandes y redondeadas | **No copiar** | Identidad "Honest Ledger" |
| Recorrido "?" por pantalla | **Ya existe**; ampliar | Hoy está en Inicio, Movimientos y Presupuestos (`pageTours.js`); falta en Metas. rial lo tiene en 11 pantallas de sección |
| Pantalla "Novedades" por versión | **Adaptar** (más adelante) | Tras A11: aviso discreto primero, "qué cambió" en una hoja |
| Tema "Sistema" | **Replicar** | Tres opciones, como rial; por defecto "Sistema" para cuentas nuevas |
| Estado vacío con un botón | **Ya existe** (`EmptyState`) | Extender a las 5 pestañas (A9). Ni rial es uniforme |
| Exclamaciones, lima, degradados, prueba social | **No copiar** | `voz-de-producto.md`, marca |

## 3. Tres decisiones que este kit deja a Walter

1. **El "+" circular.** Mantener el círculo y documentarlo como única excepción a "nunca pill", o cuadrarlo con radio de 12 a 14 px. Mi recomendación: cuadrarlo, por coherencia con la marca. Es un cambio de una línea en `shell.module.css:244`.
2. **"+ Agregar salida" en Movimientos.** Abre un menú ("¿Qué tipo de salida…?") con dos formularios largos con `<select>`: gasto (`FormGasto`, `Movements/index.jsx:80`) y suscripción (`FormSub`). **El gasto largo tiene campos que el alta rápida no tiene:** subcategoría, tipo (necesidad o deseo), notas, la marca de **inversión** (`:216`) y el proyecto o propiedad (`:220`). Quitarlo o mandarlo al alta rápida **haría perder funciones**. Recomiendo: (c) dejarlo como botón **secundario** (no Latón), renombrado "+ Gasto detallado o suscripción", y agregar al alta rápida un enlace "Más detalles" que abra el mismo formulario con lo ya escrito. Así queda un solo primario y no se pierde nada.
3. **Dónde va confirmar en el alta.** (a) ✓ dentro del teclado, como rial; (b) "Guardar" fijo al pie de la hoja, siempre visible; (c) las dos. (d) Guardar al tocar la categoría, como Monefy, con "Deshacer" de 5 s. Recomiendo (b) más (a) solo con monto y categoría, porque (a) solo no deja revisar la categoría antes de guardar. (d) es la más rápida, pero cambia un hábito y choca con "Se repite" y "¿En qué?" si se llenan después de elegir la categoría. Si Walter la prefiere, conviene probarla con 3 personas antes de implementarla.

## 4. Zona del pulgar (iPhone de 844 y de 667 de alto)

Con el teléfono en una mano, la zona cómoda es el tercio inferior central, más o menos de y > 560 en 844 y de y > 445 en 667.

| Acción | 844 | 667 |
|---|---|---|
| Pestañas y "+" | Dentro | Dentro |
| Teclado del alta rápida (y 424–640 / 397–613) | Dentro | Dentro |
| "Guardar" del alta rápida | **Fuera** (bajo el pliegue) | **Fuera** (196 px bajo el pliegue) |
| "Editar tasa" y VES/USD del héroe (y ≈ 590–670) | En el borde de la zona | Fuera hacia arriba si hay franja demo |
| "+ Agregar salida" (Movimientos, y ≈ 370) | Fuera (arriba) | Fuera (arriba) |
| Recorrido "?" y ojo (barra superior) | Fuera (arriba): aceptable, se usan poco | Fuera |
| "Mostrar vista detallada" (al final del Inicio) | Necesita scroll: unas 2,9 pantallas | Unas 3,6 pantallas |

## 5. Lo que no se pudo medir

- Contraste con axe en esta pasada: los scripts del proyecto viven fuera del repo y no se corrieron.
- Modo oscuro de la demo: la app no sigue el tema del sistema y no lo cambié en Ajustes. Se midió el oscuro solo de forma visual, en la cuenta real.
- Texto grande del sistema: cambiarlo es un ajuste de iOS. Para el navegador falta probar el zoom de texto al 200 % (WCAG 1.4.4).
- Movimiento y transiciones (V4): el espejo y el navegador no los transmiten con fidelidad. Hacen falta los videos del BRIEF §10.
