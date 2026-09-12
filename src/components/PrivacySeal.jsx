// src/components/PrivacySeal.jsx
// El Sello — la privacidad de FinanceOS como artefacto: un tampón de notario.
// Los datos viven en el dispositivo; la sincronización opcional viaja cifrada
// y el servidor nunca puede leerla en claro. Puro SVG, sin dependencias.
// Se estampa una vez al montar (respeta reduced-motion).

export default function PrivacySeal({ size = 72, label = 'DATOS 100% LOCALES · MOY IQ · ', title = 'Cifrado de extremo a extremo' }) {
  const c = 50
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={title}
      className="fos-seal" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <path id="seal-text" d={`M ${c},${c} m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0`} />
      </defs>
      <g style={{ transformOrigin: '50px 50px' }} className="fos-seal-stamp">
        {/* anillos */}
        <circle cx={c} cy={c} r="47" fill="none" stroke="var(--brand, var(--grn))" strokeWidth="1.6" opacity="0.9" />
        <circle cx={c} cy={c} r="39.5" fill="none" stroke="var(--brand, var(--grn))" strokeWidth="0.8" opacity="0.55" />
        {/* texto circular de marca */}
        <text fontFamily="var(--mono)" fontSize="6.1" letterSpacing="1.7" fill="var(--brand, var(--grn))" opacity="0.85">
          <textPath href="#seal-text" startOffset="0">{label}</textPath>
        </text>
        {/* candado central */}
        <g stroke="var(--brand, var(--grn))" fill="none" strokeWidth="2.4" strokeLinecap="round" opacity="0.9">
          <path d="M 42 47 v-5 a 8 8 0 0 1 16 0 v5" />
        </g>
        <rect x="39" y="47" width="22" height="17" rx="3.5" fill="var(--brand, var(--grn))" opacity="0.9" />
        <circle cx={c} cy="54.5" r="2.2" fill="var(--sur)" />
        <rect x={c - 1} y="55" width="2" height="4.5" rx="1" fill="var(--sur)" />
      </g>
      <style>{`
        @keyframes fos-stamp { 0% { transform: rotate(-14deg) scale(1.12); opacity: 0 } 60% { opacity: 1 } 100% { transform: rotate(-6deg) scale(1); opacity: 1 } }
        .fos-seal-stamp { transform: rotate(-6deg); animation: fos-stamp .5s cubic-bezier(.22,.61,.36,1) both; }
        @media (prefers-reduced-motion: reduce) { .fos-seal-stamp { animation: none; } }
      `}</style>
    </svg>
  )
}
