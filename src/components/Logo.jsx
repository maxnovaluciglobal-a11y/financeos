// src/components/Logo.jsx
// Wordmark + monograma de marca (MOY IQ) — geometría y reglas del brand book,
// se reutiliza literal, no se reinventa acá.
//
// Monograma: bisel (círculo r=40) + escala (arco 270°, 3 ticks) + aguja+pivote
// en Latón (única constante cromática del sistema, salvo variante 'mono').
// Wordmark: "MOY" Instrument Sans 600 mayúsculas tracking .08em + placa "IQ"
// (borde Latón, IBM Plex Mono 500, .58em del tamaño de "MOY", nunca superíndice).

export function Monogram({ size = 24, tone = 'brand', ticks = true, className, style }) {
  // tone: 'brand' (bisel/escala en --tx, aguja+pivote en Latón — uso normal)
  //       'mono'  (currentColor puro, sin Latón — superficies de un solo color)
  const stroke = tone === 'mono' ? 'currentColor' : 'var(--tx)'
  const needle = tone === 'mono' ? 'currentColor' : 'var(--laton)'
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="MOY IQ"
      className={className} style={{ display: 'block', flexShrink: 0, ...style }}>
      <circle cx="50" cy="50" r="40" fill="none" stroke={stroke} strokeWidth="3" />
      <path d="M 28.79 71.21 A 30 30 0 1 1 71.21 71.21" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
      {ticks && (
        <>
          <line x1="28.79" y1="71.21" x2="24.54" y2="75.46" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="50" y1="20" x2="50" y2="14" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="71.21" y1="71.21" x2="75.46" y2="75.46" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      <path d="M 52 53.46 L 72.52 37 L 48 46.54 Z" fill={needle} stroke="none" />
      <circle cx="50" cy="50" r="3.5" fill={needle} stroke="none" />
    </svg>
  )
}

export function Wordmark({ size = 15, style }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '.3em', lineHeight: 1, ...style }}>
      <span style={{
        fontFamily: 'var(--display)', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '.08em', fontSize: size, color: 'var(--tx)',
      }}>MOY</span>
      <span style={{
        fontFamily: 'var(--mono)', fontWeight: 500, fontSize: size * 0.58,
        color: 'var(--laton)', border: '1.5px solid var(--laton)', borderRadius: 'var(--r-plate)',
        padding: '.12em .32em', lineHeight: 1,
      }}>IQ</span>
    </span>
  )
}

// Lockup horizontal completo — respeta el mínimo de 24px de alto documentado
// en el brand book (size acá es la altura aproximada del lockup).
export default function Logo({ size = 24, showMonogram = true, style }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.35, ...style }}>
      {showMonogram && <Monogram size={size} />}
      <Wordmark size={size * 0.62} />
    </span>
  )
}
