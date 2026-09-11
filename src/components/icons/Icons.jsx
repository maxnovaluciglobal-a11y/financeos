// src/components/icons/Icons.jsx
// Iconografía de marca — vocabulario arco + tick + pivote (brand book, geometría
// literal, no reinventada). viewBox 0 0 24 24.
//
// Regla: el ícono de IQ Score es el ÚNICO que reusa el arco completo de 270°;
// el resto usa arco de 90° (un tercio de esa escala). Los 14 documentados están
// acá tal cual; al final hay 3 construidos con la MISMA regla para conceptos de
// nav sin equivalente documentado (Ingresos, Propiedades, Modo Asesor).

const base = { width: 24, height: 24, viewBox: '0 0 24 24' }

export function IconInicio({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none" stroke="var(--grn)" strokeWidth="1.5" strokeLinecap="round">
      <path d="M6 12 A6 4 0 0 1 18 12" />
      <line x1="9" y1="16" x2="9" y2="20" />
      <line x1="15" y1="16" x2="15" y2="20" />
    </svg>
  )
}

export function IconTransacciones({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none" stroke="var(--grn)" strokeWidth="1.5" strokeLinecap="round">
      <path d="M6 8h10l-3-3M18 16H8l3 3" />
      <circle cx="12" cy="12" r="1.4" fill="var(--laton)" stroke="none" />
    </svg>
  )
}

export function IconAhorro({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none" stroke="var(--grn)" strokeWidth="1.5" strokeLinecap="round">
      <path d="M8 20 A6 8 0 0 1 8 5" />
      <line x1="8" y1="11" x2="12" y2="11" />
    </svg>
  )
}

// Único ícono que reusa el arco completo de 270°.
export function IconIQScore({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none" stroke="var(--laton)" strokeWidth="1.6" strokeLinecap="round">
      <path d="M6 16 A7 7 0 1 1 18 16" />
      <line x1="6" y1="16" x2="5" y2="18" />
      <line x1="12" y1="8" x2="12" y2="6.5" />
      <line x1="18" y1="16" x2="19" y2="18" />
      <path d="M12.4 12.6 L16 9 L11.4 11.2Z" fill="var(--laton)" stroke="none" />
    </svg>
  )
}

export function IconAlertas({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none" stroke="var(--grn)" strokeWidth="1.5" strokeLinecap="round">
      <path d="M7 15 A5 5 0 0 1 11 9" />
      <line x1="10.6" y1="9.2" x2="12.5" y2="7.7" stroke="var(--error)" />
      <circle cx="12.5" cy="7.7" r="1" fill="var(--error)" stroke="none" />
    </svg>
  )
}

export function IconTarjetas({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none" stroke="var(--grn)" strokeWidth="1.5">
      <rect x="4" y="7" width="16" height="11" rx="2" />
      <line x1="4" y1="11" x2="20" y2="11" />
    </svg>
  )
}

export function IconTransferencias({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none" stroke="var(--grn)" strokeWidth="1.5" strokeLinecap="round">
      <path d="M5 9 A5 5 0 0 1 10 5M19 15 A5 5 0 0 1 14 19" />
      <circle cx="12" cy="12" r="1.3" fill="var(--laton)" stroke="none" />
    </svg>
  )
}

export function IconMetas({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none" stroke="var(--grn)" strokeWidth="1.5" strokeLinecap="round">
      <line x1="9" y1="19" x2="9" y2="5" />
      <line x1="6" y1="15" x2="12" y2="15" />
      <line x1="6" y1="10" x2="12" y2="10" />
      <path d="M9 5 L11 8 L7 8 Z" fill="var(--verde)" stroke="none" />
    </svg>
  )
}

export function IconPresupuesto({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none" stroke="var(--grn)" strokeWidth="1.5">
      <path d="M4 16 A8 6 0 0 1 20 16" />
      <line x1="9.3" y1="16" x2="9.3" y2="10.5" />
      <line x1="14.7" y1="16" x2="14.7" y2="12" />
      <path d="M4 16 h5.3 v0 H4Z" fill="var(--grn)" stroke="none" />
    </svg>
  )
}

export function IconInversion({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none" stroke="var(--grn)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17 L10 12 L14 14 L19 7" />
      <circle cx="14" cy="14" r="1.4" fill="var(--laton)" stroke="none" />
    </svg>
  )
}

export function IconConfiguracion({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none" stroke="var(--grn)" strokeWidth="1.5">
      <circle cx="12" cy="12" r="7" />
      <line x1="12" y1="12" x2="12" y2="7" />
    </svg>
  )
}

export function IconNotificaciones({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none" stroke="var(--grn)" strokeWidth="1.5" strokeLinecap="round">
      <path d="M6 14 A5 5 0 0 1 11 9" />
      <circle cx="11" cy="9" r="1.2" fill="var(--grn)" stroke="none" />
    </svg>
  )
}

export function IconCuentas({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none" stroke="var(--grn)" strokeWidth="1.5" strokeLinecap="round">
      <line x1="5" y1="8" x2="17" y2="8" />
      <line x1="5" y1="12" x2="14" y2="12" />
      <line x1="5" y1="16" x2="11" y2="16" />
    </svg>
  )
}

export function IconEscanear({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none" stroke="var(--grn)" strokeWidth="1.6" strokeLinecap="round">
      <path d="M5 8V5h3M19 8V5h-3M5 16v3h3M19 16v3h-3" />
      <circle cx="12" cy="12" r="1.4" fill="var(--laton)" stroke="none" />
    </svg>
  )
}

// ── Construidos con la misma regla (arco 90° + tick + pivote) para conceptos
// de nav sin equivalente documentado en el set de 14. ──

export function IconIngresos({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none" stroke="var(--grn)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17 A9 9 0 0 1 14 7" />
      <path d="M14 7 h5 M19 7 v5" />
      <circle cx="14" cy="7" r="1.3" fill="var(--verde)" stroke="none" />
    </svg>
  )
}

export function IconPropiedades({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none" stroke="var(--grn)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11 L12 5 L20 11" />
      <path d="M6 10 V19 H18 V10" />
      <line x1="12" y1="19" x2="12" y2="14" />
      <circle cx="12" cy="16.3" r="1" fill="var(--laton)" stroke="none" />
    </svg>
  )
}

export function IconAsesor({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none" stroke="var(--grn)" strokeWidth="1.5" strokeLinecap="round">
      <path d="M6 15 A6 6 0 0 1 12 9" />
      <path d="M17 6 l1.2 2.4 L20.6 9.6 18.2 10.8 17 13.2 15.8 10.8 13.4 9.6 15.8 8.4Z" fill="var(--laton)" stroke="none" />
    </svg>
  )
}

// Mapa id de nav (Shell.jsx) → componente de ícono. Los tools país-específicos
// mantienen su bandera emoji (no son parte de este vocabulario) — ver Shell.jsx.
export const NAV_ICONS = {
  dashboard:  IconInicio,
  income:     IconIngresos,
  movements:  IconTransacciones,
  import:     IconEscanear,
  budgets:    IconPresupuesto,
  debts:      IconTarjetas,
  goals:      IconMetas,
  projects:   IconPropiedades,
  networth:   IconAhorro,
  coach:      IconAlertas,
  reports:    IconCuentas,
  cashflow:   IconInversion,
  advisor:    IconAsesor,
  settings:   IconConfiguracion,
}
