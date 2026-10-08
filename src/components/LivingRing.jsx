// src/components/LivingRing.jsx
// El Anillo Vivo — firma visual de FinanceOS (Ronda 3 del rediseño).
// Modo "pulse": responde "¿voy bien PARA ESTA ALTURA del mes?" de un vistazo.
// La distancia entre el arco de gasto y el tick de "dónde deberías estar hoy"
// ES la respuesta, sin leer un número. Centro = gasto seguro por día.
// El anillo de texto exterior ("DATOS 100% LOCALES") es la constante de marca.
//
// Puro SVG, sin dependencias. Respeta prefers-reduced-motion.

import { useMoney } from './Money.jsx'
import { useT } from '../i18n/useT.js'

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
      aria-label={ariaLabel || t('ring.aria', { spent: Math.round(spentRatio * 100), elapsed: Math.round(elapsedRatio * 100) })}
      style={{ display: 'block' }}>
      <defs>
        <path id="lr-textpath" d="M 100,100 m -90,0 a 90,90 0 1,1 180,0 a 90,90 0 1,1 -180,0" />
      </defs>

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

      {/* texto de marca circular */}
      <g style={{ transformOrigin: '100px 100px', animation: 'lr-spin 48s linear infinite' }}>
        <text fontFamily="var(--mono)" fontSize="7.4" letterSpacing="3" fill="var(--brand, var(--grn))" opacity="0.8">
          <textPath href="#lr-textpath" startOffset="0">{t('ring.brand')}</textPath>
        </text>
      </g>

      {/* centro */}
      <text x="100" y="94" textAnchor="middle" fontFamily="var(--mono)" fontSize="8"
        letterSpacing="1" fill="var(--th)">{centerLabel}</text>
      <text x="100" y="116" textAnchor="middle" fontFamily="var(--display)" fontSize="22"
        fontWeight="700" fill="var(--tx)">{centerValue ? m(centerValue) : ''}</text>
      {footLabel && (
        <text x="100" y="132" textAnchor="middle" fontFamily="var(--mono)" fontSize="8"
          fill="var(--th)">{footLabel}</text>
      )}

      <style>{`
        @keyframes lr-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          svg g { animation: none !important; }
          svg circle animate, svg text animate { display: none; }
        }
      `}</style>
    </svg>
  )
}
