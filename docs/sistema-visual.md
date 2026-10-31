# Sistema visual compartido con Invest ("Honest Ledger")

Desde el 21-oct-2026 (UI-L1 de `04 - Marca y Diseno/investigacion-ui-2026-10/INFORME.md`, aprobado por Walter) la app sigue las reglas de `invest-web/DESIGN.md`. Este archivo dice qué reglas son, dónde vive cada pieza en la app y cómo se mantiene igual en los dos productos.

## Reglas

1. **Estructura por líneas, no por cajas.** Las secciones y las filas de KPI se separan con una línea fina arriba (`1px solid var(--brd2)`, Navy al 18 % en claro y Papel al 18 % en oscuro); las filas de una lista, con `var(--brd)` (10 %). Las tarjetas quedan para **una** cosa autocontenida: el héroe del Inicio ("Te queda este mes"), un grupo de filas de Menú o Ajustes, un formulario de alta, un estado vacío o un aviso tintado.
   **Sin trazo en lo que no se edita (31-oct-2026, decisión de Walter).** Una tarjeta se separa con `--box-bg` y `--box-sh`: sombra suave en claro, escalón de superficie en oscuro (`--box-sh` es `none`: nunca depender solo de la sombra). Un control secundario es relleno (`--fill`, `--fill-2`), no contorno. El borde queda solo en los campos editables (`--field-brd`, WCAG 1.4.11).
2. **Una cifra protagonista por pantalla**, en `.num-hero` / `<Amount hero>` (Plex Sans 600, símbolo y centavos al 65 %). Lo demás, subordinado en una fila debajo.
3. **Todo estado es ícono + palabra**, nunca solo color (`StateTag`). El rojo solo para excedido, sobregiro, pérdida o error.
4. **Latón hace dos trabajos:** la acción primaria (botón Latón con texto Navy, también el "+" de la barra) y "dónde estás" en el riel de escritorio (chip Latón al 18 %). En la barra de pestañas del celular, "dónde estás" es el ícono relleno y la tinta (31-oct-2026): la barra de 3 px era un patrón de pestañas web. Los enlaces van en Slate Blue (`var(--blu)`), los gráficos en las variables `--chart-*`, nunca en Latón.
5. **Cifras:** `.num` (Plex Sans tabular), U+2212 para el menos, U+202F antes de "%" (`fmtPct`), ejes con `fmtAxis`.
6. **Oscuro en la familia Navy:** fondo `#0E1628`, superficie Navy `#14213D`; `--sur2` `#1A2A4A` y `--sur3` `#213357` son estados elevados (hover, pistas, chips), no un tercer nivel.
7. **Radios (31-oct-2026, decisión de Walter).** 8–12 en tarjetas, botones y campos. Píldora (`--r-pill`) solo en controles segmentados, chips y etiquetas de monto o estado. 20 (`--r-sheet`) en la parte superior de las hojas.

## Piezas

| Pieza | Dónde | Qué hace |
|---|---|---|
| `.num`, `.num-hero` | `src/styles/globals.css` | Cifras en Plex Sans con `tabular-nums lining-nums`; la protagonista en 600 y apenas apretada. Invest: `.num` en `app/index.html` |
| `Amount` | `src/components/Amount.jsx` | Un monto con jerarquía: U+2212, `plus`, variante `hero` (símbolo y centavos al 65 % en `--tm`), respeta "ocultar montos". Formato único en `fmtMoneyParts` |
| `Delta` | `src/components/ledger/Delta.jsx` | Variación con flecha (↑ ↓ =) y la frase completa; el color dice si es bueno o malo (`good`), la flecha dice la dirección. `DeltaLine` del Inicio lo usa ("+11 % vs. sept al día 21") |
| `StateTag` | `src/components/ledger/StateTag.jsx` | Estado en palabras con ícono: `ok` (check, `--pos`), `warn` ("!", `--warn`), `risk` (cruz, `--neg`), `muted` (punteado, `--th`) |
| `Meter` | `src/components/ledger/Meter.jsx` | Barra de avance con `role="meter"`, `aria-valuetext` con la frase completa; el exceso se dibuja rayado al final |
| `HairlineTable` | `src/components/ledger/HairlineTable.jsx` | Tabla sin marco: encabezado 12/600 con línea del 18 %, filas del 10 %, columnas de cifras a la derecha (`num: true`), fila destacada y pie opcional |
| `PageHead` | `src/components/ui/index.jsx` (alias `PageHeader`) | Encabezado único de página: título grande (`LargeTitle`, con barra compacta al hacer scroll en el celular) y **un** subtítulo. La barra superior no repite el título |
| `ChartTooltip` | `src/components/charts/ChartTooltip.jsx` | El único tooltip de los gráficos: fecha arriba; por serie, indicador, etiqueta y valor a la derecha en `.num`; el período anterior con indicador punteado. `PREV_LINE`, `AXIS_TICK` y `GRID` para el resto del gráfico |
| Tokens | `src/styles/tokens.css` | Paleta, oscuro Navy y `--chart-income`, `--chart-expense`, `--chart-net`, `--chart-prev`, `--chart-axis` |
| Navegación | `src/components/layout/TabBar.jsx`, `shell.module.css` | Cinco destinos en el celular (Inicio · Movimientos · Presupuestos · Metas · Menú) con ícono relleno en el activo y el "+" dentro de la barra; chip Latón en el riel |
| `Sheet`, `OptionSheet`, `SheetSelect` | `src/components/ui/` | Hoja inferior con salida animada, arrastre desde el contenido, velocidad, dos alturas y resorte; lista de opciones en hoja; `<select>` que en el teléfono se elige en hoja (mismos hijos y `onChange`). Física pura en `sheetPhysics.js` |
| `SwipeRow` | `src/components/ui/SwipeRow.jsx` | Deslizar una fila para editar o borrar. Siempre con equivalente visible; el borde izquierdo queda libre para "atrás" |
| Títulos | `src/components/layout/LargeTitle.jsx` | Un bloque en el flujo; la copia compacta va por portal a la barra superior, ligada al scroll (`animation-timeline`) |

## Cómo se mantiene igual en los dos productos

- **Tokens:** `src/styles/tokens.css` es el origen. Se copia **idéntico** a `invest-web/tokens.css` y el bloque "Paleta de marca" a `financeos-landing/tokens.css` (ver `docs/tokens-de-diseno.md`). Las pruebas de cada repo fallan si la copia difiere (`invest-web/test/brd4-shared-tokens.test.js`; en la landing `APP_TOKENS=<ruta>/tokens.css npm test`).
- **Componentes:** Invest es un HTML con script inline, así que no importa los componentes de React: aplica las mismas reglas con sus clases (`.num`, `dirPct`, las tablas de hairlines, la barra Latón). Cuando una regla cambie, se cambia en `invest-web/DESIGN.md` y acá, en el mismo día.
- **Detector:** después de tocar UI, `impeccable detect` sobre los archivos cambiados, y axe en las 5 pantallas en claro y oscuro (scripts en `04 - Marca y Diseno/investigacion-ui-2026-10/implementacion/ola2/`).
