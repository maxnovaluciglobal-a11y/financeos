// src/components/Logo.jsx
// Logotipo e isotipo de moyiq (libro de marca de Descentric v2.1, D2). Geometría
// sin modificar: trazos de financeos-workspace/branding/rebrand-2026-11/
// derivados-svg/ (pdftocairo desde el PDF de la agencia), con fill="currentColor"
// para heredar el color. Reemplaza el dial + placa "IQ" de "El Instrumento" (D8).
//
// Color por defecto: --logo-fg (morado 700 sobre claro, blanco sobre grafito:
// versiones de color del manual, pág. 10). Sobre un degradado, pasar
// style={{ color: 'var(--on-grad-text)' }}. Nunca degradado sobre el logo.

import { LOGO_SVG, ISO_SVG } from './logoPaths.js'

// Proporción del logotipo (ancho / alto del recorte): 2,89:1 (manual 2,93:1).
export const LOGO_RATIO = LOGO_SVG.ratio

// Isotipo: la lupa sola (ícono de app, avatar, firma del splash). Mínimo 16 px.
export function Isotipo({ size = 24, title = 'moyiq', decorative = false, className, style }) {
  return (
    <svg
      width={Math.round(size * ISO_SVG.ratio * 100) / 100} height={size} viewBox={ISO_SVG.viewBox}
      fill="currentColor" className={className}
      style={{ display: 'block', flexShrink: 0, color: 'var(--logo-fg)', ...style }}
      {...(decorative ? { 'aria-hidden': true, focusable: 'false' } : { role: 'img', 'aria-label': title })}
    >
      {ISO_SVG.paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}

// Logotipo "moyiq". `size` = alto aproximado del bloque (como el lockup
// anterior): el dibujo mide size × 1,1 de alto. Mínimo legible: 18 px de alto.
export function Logotipo({ size = 24, title = 'moyiq', decorative = false, className, style }) {
  const h = Math.round(size * ISO_SVG.ratio * 100) / 100
  return (
    <svg
      width={Math.round(h * LOGO_RATIO * 100) / 100} height={h} viewBox={LOGO_SVG.viewBox}
      fill="currentColor" className={className}
      style={{ display: 'block', flexShrink: 0, color: 'var(--logo-fg)', ...style }}
      {...(decorative ? { 'aria-hidden': true, focusable: 'false' } : { role: 'img', 'aria-label': title })}
    >
      {LOGO_SVG.paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}

// Nombres anteriores, para no tocar a quien los importa: Monogram → isotipo,
// Wordmark → logotipo (su `size` era el cuerpo del texto, ~0,62 del lockup).
export const Monogram = ({ size = 24, ...rest }) => <Isotipo size={size} {...rest} />
export const Wordmark = ({ size = 15, ...rest }) => <Logotipo size={size / 0.62 * 0.8} {...rest} />

export default function Logo({ size = 24, style, ...rest }) {
  return <Logotipo size={size} style={style} {...rest} />
}
