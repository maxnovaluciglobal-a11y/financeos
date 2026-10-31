// src/components/PrivacySeal.jsx
// El Sello — la privacidad de FinanceOS como artefacto: un tampón de notario.
// Los datos viven en el dispositivo; la sincronización opcional viaja cifrada
// y el servidor nunca puede leerla en claro. Puro SVG, sin dependencias.
// Se estampa una vez al montar (respeta reduced-motion).
// Desde la ola 2 (21-oct-2026) sin texto curvo: el lema iba en un textPath de
// ~6 px reales, ilegible y bajo el piso de 11 px (REC-N6). Ahora el sello es solo
// el dibujo y el lema va debajo como texto normal de 12 px.

import { useT } from '../i18n/useT.js'
import { useAppOptional } from '../context/AppContext.jsx'
import { moduleOn } from '../utils/modules.js'

export default function PrivacySeal({ size = 72, label, title }) {
  const { t } = useT()
  // Con el módulo Inversiones, el portafolio se lee del servidor de Invest: el
  // sello dice exactamente qué sigue siendo local.
  const settings = useAppOptional()?.settings
  if (label === undefined) label = t(moduleOn(settings, 'investments') ? 'seal.labelInvest' : 'seal.label')
  if (title === undefined) title = t('seal.title')
  const c = 50
  return (
    <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }} title={title}>
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true"
      className="fos-seal" style={{ display: 'block', overflow: 'visible' }}>
      <g style={{ transformOrigin: '50px 50px' }} className="fos-seal-stamp">
        {/* anillos */}
        <circle cx={c} cy={c} r="47" fill="none" stroke="var(--brand, var(--grn))" strokeWidth="1.6" opacity="0.9" />
        <circle cx={c} cy={c} r="39.5" fill="none" stroke="var(--brand, var(--grn))" strokeWidth="0.8" opacity="0.55" />
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
      <figcaption style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500, lineHeight: 1.3, color: 'var(--tm)', textAlign: 'center' }}>{label}</figcaption>
    </figure>
  )
}
