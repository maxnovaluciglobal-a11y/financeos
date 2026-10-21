# Sistema visual compartido con Invest ("Honest Ledger")

Desde el 21-oct-2026 (UI-L1 de `04 - Marca y Diseno/investigacion-ui-2026-10/INFORME.md`, aprobado por Walter) la app sigue las reglas de `invest-web/DESIGN.md`. Este archivo dice qué reglas son, dónde vive cada pieza en la app y cómo se mantiene igual en los dos productos.

## Reglas

1. **Estructura por líneas, no por cajas.** Las secciones y las filas de KPI se separan con una línea fina arriba (`1px solid var(--brd2)`, Navy al 18 % en claro y Papel al 18 % en oscuro); las filas de una lista, con `var(--brd)` (10 %). Nada en la columna de contenido lleva sombra. Las tarjetas quedan para **una** cosa autocontenida: el héroe del Inicio ("Te queda este mes"), un formulario de alta, un estado vacío o un aviso tintado.
2. **Una cifra protagonista por pantalla**, en `.num-hero` / `<Amount hero>` (Plex Sans 600, símbolo y centavos al 65 %). Lo demás, subordinado en una fila debajo.
3. **Todo estado es ícono + palabra**, nunca solo color (`StateTag`). El rojo solo para excedido, sobregiro, pérdida o error.
4. **Latón hace dos trabajos:** la acción primaria (botón Latón con texto Navy) y "dónde estás" (barra de 3 px arriba de la pestaña activa en el celular, chip Latón al 18 % en el riel de escritorio). Los enlaces van en Slate Blue (`var(--blu)`), los gráficos en las variables `--chart-*`, nunca en Latón.
5. **Cifras:** `.num` (Plex Sans tabular), U+2212 para el menos, U+202F antes de "%" (`fmtPct`), ejes con `fmtAxis`.
6. **Oscuro en la familia Navy:** fondo `#0E1628`, superficie Navy `#14213D`; `--sur2` `#1A2A4A` y `--sur3` `#213357` son estados elevados (hover, pistas, chips), no un tercer nivel.

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
| Navegación | `src/components/layout/TabBar.jsx`, `shell.module.css` | Cinco destinos en el celular (Inicio · Movimientos · Presupuestos · Metas · Menú) con la barra Latón arriba del activo; chip Latón en el riel |

## Cómo se mantiene igual en los dos productos

- **Tokens:** `src/styles/tokens.css` es el origen. Se copia **idéntico** a `invest-web/tokens.css` y el bloque "Paleta de marca" a `financeos-landing/tokens.css` (ver `docs/tokens-de-diseno.md`). Las pruebas de cada repo fallan si la copia difiere (`invest-web/test/brd4-shared-tokens.test.js`; en la landing `APP_TOKENS=<ruta>/tokens.css npm test`).
- **Componentes:** Invest es un HTML con script inline, así que no importa los componentes de React: aplica las mismas reglas con sus clases (`.num`, `dirPct`, las tablas de hairlines, la barra Latón). Cuando una regla cambie, se cambia en `invest-web/DESIGN.md` y acá, en el mismo día.
- **Detector:** después de tocar UI, `impeccable detect` sobre los archivos cambiados, y axe en las 5 pantallas en claro y oscuro (scripts en `04 - Marca y Diseno/investigacion-ui-2026-10/implementacion/ola2/`).
