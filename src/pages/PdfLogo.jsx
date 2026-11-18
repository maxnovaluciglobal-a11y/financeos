// src/pages/PdfLogo.jsx — logotipo de moyiq para los PDF (react-pdf <Svg>).
// Mismos trazos que components/Logo.jsx (geometría del manual, sin modificar).
import { Svg, Path } from '@react-pdf/renderer'
import { LOGO_SVG } from '../components/logoPaths.js'

// height en puntos; el ancho sale de la proporción del manual (≈2,89:1).
export default function PdfLogo({ height = 18, color }) {
  return (
    <Svg viewBox={LOGO_SVG.viewBox} style={{ width: Math.round(height * LOGO_SVG.ratio * 10) / 10, height }}>
      {LOGO_SVG.paths.map((d, i) => <Path key={i} d={d} fill={color} />)}
    </Svg>
  )
}
