// src/components/ui/index.jsx
// Shared UI primitives

import { useId, useRef, Children, cloneElement, isValidElement } from 'react'
import styles from './ui.module.css'
import LargeTitle from '../layout/LargeTitle.jsx'
import Money, { MONEY_MASK } from '../Money.jsx'
import Amount from '../Amount.jsx'
import CategoryIcon from '../CategoryIcon.jsx'
import SignalIcon from '../icons/SignalIcon.jsx'
import { useT } from '../../i18n/useT.js'
import { Pencil, Check } from 'lucide-react'
import { MINUS } from '../../utils/index.js'

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

// `alert`: palabra de estado (ej. "Sobregiro", "Excedido") que se dibuja con
// ícono en rojo. El rojo es solo para eso (UI-Q4): un gasto no es un error, así
// que una cifra de gasto va en tinta neutra y sin `alert`.
export function KPI({ label, value, sub, color = 'default', alert }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiLbl}>{label}</div>
      {/* value enmascarado (T13) → <Money> agrega el texto sr-only "Monto oculto" */}
      <div className={[styles.kpiVal, styles[`kpi_${color}`]].join(' ')} style={kpiFit(value)}>{value === MONEY_MASK ? <Money /> : value}</div>
      {alert && <div className={styles.kpiAlert}><SignalIcon kind="alert" size={13} />{alert}</div>}
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
  let fieldId = null
  const kids = Children.map(children, (child) => {
    if (!fieldId && isValidElement(child) && typeof child.type === 'string' &&
        ['input', 'select', 'textarea'].includes(child.type)) {
      // Un campo con id propio (p. ej. #budget-new-category) también queda
      // asociado a su etiqueta.
      fieldId = child.props.id || autoId
      return child.props.id ? child : cloneElement(child, { id: autoId })
    }
    return child
  })
  return (
    <div className={styles.fg}>
      {label && <label className={styles.fl} htmlFor={fieldId || undefined}>{label}</label>}
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
            fontFamily: 'var(--num)', fontSize: 12, fontWeight: 600,
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
    <div className={[styles.emptyState, compact ? styles.emptyStateCompact : ''].join(' ')} data-empty-guided={children ? '' : undefined}>
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

// name y meta pueden ser texto o nodos (ícono + texto); con nodos, `label`
// es el texto para los aria-label de editar/borrar. Lo usan Ingresos y
// Movimientos (REC-N5): una mejora de la fila llega a las dos listas.
// `value` + `sym`: el monto pasa por <Amount> (U+2212, ocultar montos, UI-M2);
// `amount` (texto ya formateado) queda por compatibilidad.
// `category`: ícono de categoría único (UI-M4) en vez del punto de color.
export function TxRow({ dot, category, name, label: labelProp, meta, amount, value, sym, isIncome, onDelete, onEdit }) {
  const { t } = useT()
  const label = labelProp || (typeof name === 'string' && name) || t('ui.transaction')
  return (
    <div className={styles.txRow}>
      {category != null ? <CategoryIcon category={category} /> : <div className={styles.txDot} style={{ background: dot }} />}
      <div className={styles.txInfo}>
        <div className={styles.txName}>{name}</div>
        {meta && <div className={styles.txMeta}>{meta}</div>}
      </div>
      <div className={[styles.txAmt, isIncome ? styles.txInc : styles.txExp].join(' ')}>
        {value != null
          ? <Amount value={isIncome ? Math.abs(value) : -Math.abs(value)} sym={sym} plus={isIncome} />
          : <>{isIncome ? '+' : MINUS}<Money>{amount}</Money></>}
      </div>
      {onEdit && (
        <button className={styles.delBtn} onClick={onEdit} title={t('ui.edit')} aria-label={t('ui.editItem', { name: label })} style={{marginRight:2,fontSize:11}}>
          <Pencil size={13} strokeWidth={1.7} aria-hidden="true" />
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

// Encabezado único de página (UI-M8, "pagehead" de Invest): un título grande
// (LargeTitle, con su barra compacta al hacer scroll en móvil) y UN subtítulo.
// La barra superior ya no repite el nombre de la página.
export function PageHead({ title, sub }) {
  return <LargeTitle title={title} sub={sub} />
}
export const PageHeader = PageHead

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

// Elección única entre pocas opciones (tema Sistema · Claro · Oscuro, N4).
// radiogroup del patrón APG: una sola parada de Tab (la opción elegida) y
// flechas, Inicio y Fin para moverse; cada flecha elige, como un radio nativo.
// Elegida = borde Navy/Papel + ✓ + peso 600 (estado = ícono + palabra), sin
// Latón: el Latón es para la acción primaria de la pantalla. 44 px de alto.
// `preview` (opcional) dibuja una miniatura decorativa antes de la palabra.
export function ChoiceGroup({ value, onChange, options, labelledBy, label, className }) {
  const refs = useRef([])
  const selected = options.findIndex(o => o.value === value)
  const focusable = selected >= 0 ? selected : 0
  function onKeyDown(e, i) {
    const n = options.length
    let next = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % n
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + n) % n
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    if (next === null) return
    e.preventDefault()
    refs.current[next]?.focus()
    if (options[next].value !== value) onChange(options[next].value)
  }
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : label}
      className={[styles.choiceGroup, className].filter(Boolean).join(' ')}>
      {options.map((o, i) => {
        const on = i === selected
        return (
          <button key={o.value} ref={el => { refs.current[i] = el }} type="button" role="radio"
            aria-checked={on} tabIndex={i === focusable ? 0 : -1}
            className={[styles.choice, on ? styles.choiceOn : ''].join(' ')}
            onClick={() => { if (!on) onChange(o.value) }} onKeyDown={e => onKeyDown(e, i)}>
            {o.preview && <span className={styles.choicePreview} data-preview={o.preview} aria-hidden="true" />}
            <span>{o.label}</span>
            {on && <Check size={14} strokeWidth={2.2} aria-hidden="true" className={styles.choiceCheck} />}
          </button>
        )
      })}
    </div>
  )
}
