// src/components/ui/index.jsx
// Shared UI primitives

import { useId, Children, cloneElement, isValidElement } from 'react'
import styles from './ui.module.css'
import LargeTitle from '../layout/LargeTitle.jsx'
import Money, { MONEY_MASK } from '../Money.jsx'
import SignalIcon from '../icons/SignalIcon.jsx'
import { useT } from '../../i18n/useT.js'

export function Btn({ children, variant = 'ghost', size = 'md', onClick, disabled, style, ...rest }) {
  // ...rest: sin esto no había forma de pasarle aria-expanded/aria-pressed a un
  // <Btn> — se perdían en 9 disclosures/toggles distintos de la app que SÍ
  // necesitaban exponer su estado a un lector de pantalla.
  const cls = [styles.btn, styles[`btn_${variant}`], styles[`btn_${size}`]].join(' ')
  return (
    <button className={cls} onClick={onClick} disabled={disabled} style={style} {...rest}>
      {children}
    </button>
  )
}

export function Card({ children, style, className, ...rest }) {
  return (
    <div className={[styles.card, className].filter(Boolean).join(' ')} style={style} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({ title, right }) {
  // <h2>, no <span>: un usuario de lector de pantalla navega por headings (tecla
  // "H") para saltar entre secciones. Con <span> no había forma de hacerlo en
  // ninguna pantalla que use Card — todo el estilo se preserva a mano porque el
  // h2 del navegador trae su propio tamaño/peso/margen por defecto.
  return (
    <div className={styles.cardHd}>
      <h2 style={{ margin: 0, font: 'inherit', color: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit' }}>{title}</h2>
      {right && <span>{right}</span>}
    </div>
  )
}

// Montos largos (Bs. con millones) en una sola línea. El tamaño lo decide el
// CSS según el ANCHO de la tarjeta (container query en .kpi, `cqi`) y el largo
// del texto (--kpi-chars): a 1280 un total largo se ve grande, en una columna
// angosta de 375 se achica hasta 13px. Nunca se parte la cifra.
export function kpiFit(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const n = String(value).length
  return n <= 11 ? { '--kpi-chars': n } : { '--kpi-chars': n, whiteSpace: 'nowrap' }
}

export function KPI({ label, value, sub, color = 'default' }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiLbl}>{label}</div>
      {/* value enmascarado (T13) → <Money> agrega el texto sr-only "Monto oculto" */}
      <div className={[styles.kpiVal, styles[`kpi_${color}`]].join(' ')} style={kpiFit(value)}>{value === MONEY_MASK ? <Money /> : value}</div>
      {sub && <div className={styles.kpiSub}>{sub}</div>}
    </div>
  )
}

export function Badge({ children, color = 'green' }) {
  return <span className={[styles.badge, styles[`badge_${color}`]].join(' ')}>{children}</span>
}

export function ProgressBar({ value, max = 100, color = 'green', height = 5, label }) {
  const pct = Math.min(max > 0 ? (value / max) * 100 : 0, 100)
  return (
    <div className={styles.progBg} style={{ height }}
      role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}
      aria-label={label || undefined}>
      <div className={[styles.progFill, styles[`prog_${color}`]].join(' ')} style={{ transform: `scaleX(${pct / 100})` }} />
    </div>
  )
}

export function FormGroup({ label, children }) {
  const autoId = useId()
  let assigned = false
  const kids = Children.map(children, (child) => {
    if (!assigned && isValidElement(child) && typeof child.type === 'string' &&
        ['input', 'select', 'textarea'].includes(child.type) && !child.props.id) {
      assigned = true
      return cloneElement(child, { id: autoId })
    }
    return child
  })
  return (
    <div className={styles.fg}>
      {label && <label className={styles.fl} htmlFor={assigned ? autoId : undefined}>{label}</label>}
      {kids}
    </div>
  )
}

export function FormRow({ children }) {
  return <div className={styles.frow}>{children}</div>
}

// Ícono por tipo (T17): antes cada texto llevaba un "⚠ " o "◈ " pegado adelante
// dentro del string i18n; ahora lo dibuja el componente, igual para todos.
const ALERT_ICON = { warn: 'alert', warning: 'alert', danger: 'alert', info: 'info', ok: 'ok' }

export function Alert({ children, type = 'warn' }) {
  // role="alert" ya implica aria-live="assertive" (errores: interrumpen);
  // role="status" implica "polite" (advertencias/info: esperan una pausa).
  const isDanger = type === 'danger'
  const cls = type === 'warning' ? 'warn' : type   // 'warning' no tenía estilo propio
  return (
    <div
      className={[styles.alert, styles[`alert_${cls}`]].join(' ')}
      role={isDanger ? 'alert' : 'status'}
      aria-live={isDanger ? 'assertive' : 'polite'}
    >
      <SignalIcon kind={ALERT_ICON[type] || 'info'} size={14} style={{ marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

export function Empty({ text, cta, onCta }) {
  const { t } = useT()
  return (
    <div className={styles.empty}>
      {text ?? t('ui.empty')}
      {cta && onCta && (
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={onCta} style={{
            fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600,
            color: 'var(--navy)', background: 'var(--laton)', border: 'none',
            borderRadius: 'var(--r)', padding: '8px 16px', cursor: 'pointer',
          }}>{cta}</button>
        </div>
      )}
    </div>
  )
}

// Estado vacío uniforme (R10): ícono, título, una frase y UN botón (Latón,
// texto Navy). Opcional: una acción secundaria como enlace, con su aclaración.
// `compact` para usarlo dentro de una tarjeta que ya tiene título.
// `children`: la pregunta guiada de la primera entrada (opciones de Metas,
// sugerencias de Presupuestos), entre el texto y el botón.
export function EmptyState({ icon: Icon, title, text, cta, onCta, ctaDisabled = false, secondary, compact = false, children }) {
  return (
    <div className={[styles.emptyState, compact ? styles.emptyStateCompact : ''].join(' ')}>
      {Icon && <span className={styles.emptyIcon} aria-hidden="true"><Icon size={22} strokeWidth={1.7} /></span>}
      <h2 className={styles.emptyTitle}>{title}</h2>
      {text && <p className={styles.emptyText}>{text}</p>}
      {children}
      {cta && onCta && (
        <button type="button" className="fos-btn-primary" style={{ width: 'auto', marginTop: 4 }} onClick={onCta} disabled={ctaDisabled}>{cta}</button>
      )}
      {secondary && (
        <div className={styles.emptySecondary}>
          <button type="button" className="fos-link" onClick={secondary.onClick} disabled={secondary.busy}>{secondary.label}</button>
          {secondary.hint && <span className={styles.emptyHint}>{secondary.hint}</span>}
        </div>
      )}
    </div>
  )
}

// Opciones de la pregunta guiada (Metas: "¿Para qué quieres ahorrar?").
export function EmptyChoices({ label, children }) {
  return <div role="group" aria-label={label} className={styles.emptyChoices}>{children}</div>
}
export function EmptyChoice({ icon: Icon, label, sub, onClick }) {
  return (
    <button type="button" className={`fos-chip fos-chip--tall ${styles.emptyChoice}`} onClick={onClick}>
      <span className={styles.emptyChoiceTop}>{Icon && <Icon size={16} strokeWidth={1.7} aria-hidden="true" />}{label}</span>
      {sub && <span className={styles.emptyChoiceSub}>{sub}</span>}
    </button>
  )
}
// Lista de sugerencias con casilla (Presupuestos desde el mes anterior).
export function EmptyPickList({ label, items }) {
  return (
    <ul className={styles.emptyPick} aria-label={label}>
      {items.map(it => (
        <li key={it.key}>
          <label>
            <input type="checkbox" checked={it.checked} onChange={e => it.onChange(e.target.checked)} style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span className={styles.emptyPickCat}>{it.label}</span>
            <span className={styles.emptyPickAmt}>{it.amount}</span>
          </label>
        </li>
      ))}
    </ul>
  )
}

export function TxRow({ dot, name, meta, amount, isIncome, onDelete, onEdit }) {
  const { t } = useT()
  const label = name || t('ui.transaction')
  return (
    <div className={styles.txRow}>
      <div className={styles.txDot} style={{ background: dot }} />
      <div className={styles.txInfo}>
        <div className={styles.txName}>{name}</div>
        {meta && <div className={styles.txMeta}>{meta}</div>}
      </div>
      <div className={[styles.txAmt, isIncome ? styles.txInc : styles.txExp].join(' ')}>
        {isIncome ? '+' : '-'}<Money>{amount}</Money>
      </div>
      {onEdit && (
        <button className={styles.delBtn} onClick={onEdit} title={t('ui.edit')} aria-label={t('ui.editItem', { name: label })} style={{marginRight:2,fontSize:11}}>
          <span aria-hidden="true">✏️</span>
        </button>
      )}
      {onDelete && (
        <button className={styles.delBtn} onClick={onDelete} title={t('ui.delete')} aria-label={t('ui.deleteItem', { name: label })}>
          <span aria-hidden="true">✕</span>
        </button>
      )}
    </div>
  )
}

export function BarRow({ label, valueLabel, value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className={styles.barRow}>
      <div className={styles.barLbl}>
        <span>{label}</span>
        <span>{valueLabel}</span>
      </div>
      <div className={styles.barBg}>
        <div className={styles.barFill} style={{ transform: `scaleX(${pct / 100})`, background: color }} />
      </div>
    </div>
  )
}

export function SectionTitle({ children }) {
  return <div className={styles.sectionTitle}>{children}</div>
}

export function PageHeader({ title, sub }) {
  return <LargeTitle title={title} sub={sub} />
}

export function SegmentedControl({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
      {options.map(opt => {
        const active = value === opt.value
        return (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)} aria-pressed={active} style={{
            flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
            border: active ? '1.5px solid var(--grn)' : '0.5px solid var(--brd2)',
            background: active ? 'var(--grn-bg)' : 'var(--sur2)',
            color: active ? 'var(--grn)' : 'var(--tx)',
          }}>{opt.label}</button>
        )
      })}
    </div>
  )
}
