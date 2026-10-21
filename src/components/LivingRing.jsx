// src/components/LivingRing.jsx
// El Anillo Vivo — firma visual de FinanceOS (Ronda 3 del rediseño).
// Modo "pulse": responde "¿voy bien PARA ESTA ALTURA del mes?" de un vistazo.
// La distancia entre el arco de gasto y el tick de "dónde deberías estar hoy"
// ES la respuesta, sin leer un número. Centro = gasto seguro por día.
// El texto curvo de marca ("DATOS 100% LOCALES") se dibujaba a ~3-7 px: se
// sacó del SVG (UI-Q8); quien lo use pone la leyenda afuera, a 11 px o más.
// Los textos del centro se escalan para no quedar nunca bajo 11 px reales.
//
// Puro SVG, sin dependencias. Respeta prefers-reduced-motion.

import { useMoney } from './Money.jsx'
import { useT } from '../i18n/useT.js'
import { fmtPctPoints } from '../utils/index.js'

const TAU = Math.PI * 2
const polar = (cx, cy, r, frac) => {
  const a = frac * TAU - Math.PI / 2 // arranca arriba (12 en punto)
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

export default function LivingRing({
  spentRatio = 0,      // gasto acumulado / referencia (0..1+)
  elapsedRatio = 0,    // día del mes / días del mes (0..1)
  color = 'var(--pos)',
  centerValue = '',    // p.ej. "$78k"
  centerLabel,         // sin prop: 'ring.center.safePerDay'
  footLabel = '',      // p.ej. "quedan 12 días"
  size = 220,
  ariaLabel,           // texto ya traducido; sin él se arma con 'ring.aria'
}) {
  const { t } = useT()
  if (centerLabel === undefined) centerLabel = t('ring.center.safePerDay')
  const { m } = useMoney() // centerValue es un monto: se enmascara (T13)
  // Unidades del viewBox (200) para que un texto mida `px` píxeles reales.
  const fs = (px) => (px * 200) / size
  const cx = 100, cy = 100
  const rArc = 62, wArc = 13
  const rDay = 78
  const circ = TAU * rArc
  const shownRatio = Math.max(0, Math.min(spentRatio, 1))
  const dash = shownRatio * circ

  // tick "dónde deberías estar hoy"
  const [tix1, tiy1] = polar(cx, cy, rArc - wArc / 2 - 3, elapsedRatio)
  const [tox1, toy1] = polar(cx, cy, rArc + wArc / 2 + 3, elapsedRatio)
  // dot pulsante = hoy, sobre la pista de días
  const [dx, dy] = polar(cx, cy, rDay, elapsedRatio)
  // porción de días transcurridos (pista fina)
  const dayDash = Math.max(0, Math.min(elapsedRatio, 1)) * TAU * rDay

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img"
      aria-label={ariaLabel || t('ring.aria', { spent: fmtPctPoints(Math.round(spentRatio * 100)), elapsed: fmtPctPoints(Math.round(elapsedRatio * 100)) })}
      style={{ display: 'block' }}>
      {/* pista de días (fina) */}
      <circle cx={cx} cy={cy} r={rDay} fill="none" stroke="var(--brd2)" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={rDay} fill="none" stroke="var(--th)" strokeWidth="2"
        strokeDasharray={`${dayDash} ${TAU * rDay}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} opacity="0.5" />

      {/* arco de gasto */}
      <circle cx={cx} cy={cy} r={rArc} fill="none" stroke="var(--sur3)" strokeWidth={wArc} />
      <circle cx={cx} cy={cy} r={rArc} fill="none" stroke={color} strokeWidth={wArc}
        strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
        transform={`rotate(-90 ${cx} ${cy})`}>
        <animate attributeName="stroke-dasharray" from={`0 ${circ}`} to={`${dash} ${circ}`}
          dur="0.7s" fill="freeze" calcMode="spline" keySplines="0.22 0.61 0.36 1" keyTimes="0;1" />
      </circle>

      {/* tick "dónde deberías estar hoy" */}
      <line x1={tix1} y1={tiy1} x2={tox1} y2={toy1} stroke="var(--tx)" strokeWidth="2.5" strokeLinecap="round" />

      {/* dot pulsante = hoy */}
      <circle cx={dx} cy={dy} r="4.5" fill={color}>
        <animate attributeName="opacity" values="0.55;1;0.55" dur="2.4s" repeatCount="indefinite" />
      </circle>

      {/* centro */}
      {centerLabel && <text x="100" y="94" textAnchor="middle" fontFamily="var(--sans)" fontSize={fs(11)}
        fontWeight="600" fill="var(--th)">{centerLabel}</text>}
      <text x="100" y="116" textAnchor="middle" fontFamily="var(--num)" fontSize="22"
        fontWeight="600" fill="var(--tx)">{centerValue ? m(centerValue) : ''}</text>
      {footLabel && (
        <text x="100" y="136" textAnchor="middle" fontFamily="var(--sans)" fontSize={fs(11)}
          fill="var(--th)">{footLabel}</text>
      )}

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          svg g { animation: none !important; }
          svg circle animate, svg text animate { display: none; }
        }
      `}</style>
    </svg>
  )
}
