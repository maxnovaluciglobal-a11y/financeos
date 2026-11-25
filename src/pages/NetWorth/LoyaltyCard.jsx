// src/pages/NetWorth/LoyaltyCard.jsx — Patrimonio › Puntos y millas
// (24-nov-2026). Saldos manuales de programas de puntos o millas (lógica en
// src/extras/loyalty.js). No son dinero: van en su tarjeta, fuera del total;
// con "Sumar al patrimonio" la tarjeta muestra además el patrimonio con ellos
// (el total de arriba y Reportes/PDF no cambian).
import { useRef, useState } from 'react'
import { Plus, ChevronRight } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { Card, CardHeader } from '../../components/ui/index.jsx'
import Sheet from '../../components/ui/Sheet.jsx'
import Money, { useMoney } from '../../components/Money.jsx'
import { fmtMoney, fmtAmount } from '../../utils/index.js'
import { ExtrasStringsGate } from '../../extras/strings.js'
import { loyaltyList, programValue, loyaltyTotal, includeInNetWorth, validateProgram, upsertProgram, removeProgram, withDemoLoyalty } from '../../extras/loyalty.js'
import { Switch } from '../Settings/settingsUi.jsx'

export default function LoyaltyCard(props) {
  return <ExtrasStringsGate><Inner {...props} /></ExtrasStringsGate>
}

const rowBtn = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 52, padding: '6px 0', border: 0, borderTop: '.5px solid var(--brd)', background: 'none', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }
const small = { fontSize: 'var(--t-footnote)', color: 'var(--th)', fontFamily: 'var(--sans)', lineHeight: 1.5 }

function Inner({ sym, netWorth = 0 }) {
  const { settings: raw, updateSettings, showToast } = useApp()
  const { t } = useT()
  const demo = !!raw?.isDemo
  // En el demo, los cambios quedan en la pantalla (como el resto del demo) y
  // nunca se guardan en los ajustes: los programas de ejemplo no se filtran.
  const [demoState, setDemoState] = useState(null) // { loyalty, loyaltyInNetWorth }
  const settings = demo ? { ...withDemoLoyalty(raw, t), ...(demoState || {}) } : raw
  const { m } = useMoney()
  const list = loyaltyList(settings)
  const total = loyaltyTotal(list)
  const include = includeInNetWorth(settings)
  const [editing, setEditing] = useState(null) // null | 'new' | id
  const money = (n) => m(fmtMoney(n, sym))

  function persist(patch) {
    if (demo) setDemoState(p => ({ ...(p || {}), ...patch }))
    else updateSettings({ ...raw, ...patch })
  }
  function save(nextList) { persist({ loyalty: nextList }) }

  return (
    <Card>
      <CardHeader title={t('loyalty.title')} />
      <p style={{ ...small, margin: '0 0 6px' }}>{t('loyalty.sub')}</p>
      {list.length === 0 && <p style={{ ...small, margin: '6px 0' }}>{t('loyalty.empty')}</p>}
      {list.map(p => {
        const v = programValue(p)
        return (
          <button key={p.id} type="button" style={rowBtn} onClick={() => setEditing(p.id)} aria-label={t('loyalty.edit', { name: p.program })}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 'var(--t-subhead)', fontWeight: 600, color: 'var(--tx)', overflowWrap: 'anywhere' }}>{p.program}</span>
              <span className="num" style={{ display: 'block', ...small }}>{t('loyalty.points', { n: fmtAmount(p.points, 0) })}</span>
            </span>
            <span className="num" style={{ fontSize: 'var(--t-footnote)', fontWeight: 600, color: v != null ? 'var(--tx)' : 'var(--th)' }}>
              {v != null ? <Money>{t('loyalty.approx', { amount: money(v) })}</Money> : t('loyalty.noValue')}
            </span>
            <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" style={{ color: 'var(--th)', flexShrink: 0 }} />
          </button>
        )
      })}
      {total > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '.5px solid var(--brd)' }}>
          <span style={{ fontSize: 'var(--t-footnote)', fontWeight: 600, color: 'var(--tx)' }}>{t('loyalty.estimated')}</span>
          <span className="num" style={{ fontSize: 'var(--t-subhead)', fontWeight: 700, color: 'var(--tx)' }}><Money>{money(total)}</Money></span>
        </div>
      )}
      {list.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 6, borderTop: '.5px solid var(--brd)', marginTop: 6 }}>
          <div style={{ minWidth: 0 }}>
            <div id="loyalty-include-label" style={{ fontSize: 'var(--t-subhead)', fontWeight: 600, color: 'var(--tx)' }}>{t('loyalty.include')}</div>
            <div style={small}>{t('loyalty.include.sub')}</div>
          </div>
          <Switch checked={include} labelledBy="loyalty-include-label" onChange={() => persist({ loyaltyInNetWorth: !include })} />
        </div>
      )}
      {include && total > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10 }}>
          <span style={{ fontSize: 'var(--t-footnote)', fontWeight: 600, color: 'var(--tx)' }}>{t('loyalty.withLoyalty')}</span>
          <span className="num" style={{ fontSize: 'var(--t-subhead)', fontWeight: 700, color: 'var(--tx)' }}><Money>{(netWorth + total) < 0 ? '−' : ''}{money(Math.abs(netWorth + total))}</Money></span>
        </div>
      )}
      <button type="button" className="fos-btn-secondary" onClick={() => setEditing('new')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, minHeight: 44 }}>
        <Plus size={16} strokeWidth={1.8} aria-hidden="true" />{t('loyalty.add')}
      </button>
      {editing && (
        <ProgramSheet item={editing === 'new' ? null : list.find(p => p.id === editing)} onClose={() => setEditing(null)}
          onSave={(item) => { save(upsertProgram(list, item, editing === 'new' ? null : editing)); setEditing(null) }}
          onDelete={editing !== 'new' ? () => { save(removeProgram(list, editing)); setEditing(null); showToast?.(t('loyalty.deleted')) } : null} />
      )}
    </Card>
  )
}

const label = { display: 'block', fontSize: 'var(--t-footnote)', fontWeight: 600, color: 'var(--tm)', margin: '12px 0 4px' }
const input = { width: '100%', boxSizing: 'border-box' }

function ProgramSheet({ item, onClose, onSave, onDelete }) {
  const { t } = useT()
  const first = useRef(null)
  const [program, setProgram] = useState(item?.program || '')
  const [points, setPoints] = useState(item ? String(item.points) : '')
  const [value, setValue] = useState(item?.valuePerPoint ? String(item.valuePerPoint) : '')
  const [err, setErr] = useState('')
  const title = t(item ? 'loyalty.form.titleEdit' : 'loyalty.form.titleNew')
  function submit(e) {
    e.preventDefault()
    const r = validateProgram({ program, points, valuePerPoint: value })
    if (!r.ok) { setErr(t(r.error)); return }
    onSave(r.item)
  }
  return (
    <Sheet open onClose={onClose} ariaLabel={title} maxWidth={440} initialFocusRef={first}>
      <h2 style={{ margin: 0, fontSize: 'var(--t-title-2)', fontWeight: 700, color: 'var(--tx)' }}>{title}</h2>
      <form onSubmit={submit} noValidate>
        <label htmlFor="lp-program" style={label}>{t('loyalty.form.program')}</label>
        <input id="lp-program" ref={first} type="text" maxLength={60} autoComplete="off" value={program}
          placeholder={t('loyalty.form.programPh')} onChange={e => setProgram(e.target.value)} style={input} />
        <label htmlFor="lp-points" style={label}>{t('loyalty.form.points')}</label>
        <input id="lp-points" className="num" type="text" inputMode="numeric" autoComplete="off" value={points}
          onChange={e => setPoints(e.target.value)} style={input} />
        <label htmlFor="lp-value" style={label}>{t('loyalty.form.value')}</label>
        <input id="lp-value" className="num" type="text" inputMode="decimal" autoComplete="off" value={value}
          aria-describedby="lp-value-hint" onChange={e => setValue(e.target.value)} style={input} />
        <p id="lp-value-hint" style={{ ...small, margin: '6px 0 0' }}>{t('loyalty.form.valueHint')}</p>
        {err && <p role="alert" style={{ fontSize: 'var(--t-footnote)', color: 'var(--neg)', margin: '10px 0 0' }}>{err}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <button type="submit" className="fos-btn-primary">{t('loyalty.form.save')}</button>
          {onDelete && <button type="button" className="fos-btn-secondary" onClick={onDelete} style={{ color: 'var(--red)' }}>{t('loyalty.form.delete')}</button>}
          <button type="button" className="fos-btn-secondary" onClick={onClose}>{t('loyalty.form.cancel')}</button>
        </div>
      </form>
    </Sheet>
  )
}
