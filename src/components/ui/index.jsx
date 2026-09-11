// src/components/ui/index.jsx
// Shared UI primitives

import { useId, Children, cloneElement, isValidElement } from 'react'
import styles from './ui.module.css'

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

export function Card({ children, style, className }) {
  return (
    <div className={[styles.card, className].filter(Boolean).join(' ')} style={style}>
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

export function KPI({ label, value, sub, color = 'default' }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiLbl}>{label}</div>
      <div className={[styles.kpiVal, styles[`kpi_${color}`]].join(' ')}>{value}</div>
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

export function Alert({ children, type = 'warn' }) {
  // role="alert" ya implica aria-live="assertive" (errores: interrumpen);
  // role="status" implica "polite" (advertencias/info: esperan una pausa).
  const isDanger = type === 'danger'
  return (
    <div
      className={[styles.alert, styles[`alert_${type}`]].join(' ')}
      role={isDanger ? 'alert' : 'status'}
      aria-live={isDanger ? 'assertive' : 'polite'}
    >
      {children}
    </div>
  )
}

export function Empty({ text = 'Sin registros aún', cta, onCta }) {
  return (
    <div className={styles.empty}>
      {text}
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

export function TxRow({ dot, name, meta, amount, isIncome, onDelete, onEdit }) {
  return (
    <div className={styles.txRow}>
      <div className={styles.txDot} style={{ background: dot }} />
      <div className={styles.txInfo}>
        <div className={styles.txName}>{name}</div>
        {meta && <div className={styles.txMeta}>{meta}</div>}
      </div>
      <div className={[styles.txAmt, isIncome ? styles.txInc : styles.txExp].join(' ')}>
        {isIncome ? '+' : '-'}{amount}
      </div>
      {onEdit && (
        <button className={styles.delBtn} onClick={onEdit} title="Editar" aria-label={`Editar ${name || 'movimiento'}`} style={{marginRight:2,fontSize:11}}>
          <span aria-hidden="true">✏️</span>
        </button>
      )}
      {onDelete && (
        <button className={styles.delBtn} onClick={onDelete} title="Eliminar" aria-label={`Eliminar ${name || 'movimiento'}`}>
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
  return (
    <div className={styles.pageHeader}>
      <h1>{title}</h1>
      {sub && <p>{sub}</p>}
    </div>
  )
}
