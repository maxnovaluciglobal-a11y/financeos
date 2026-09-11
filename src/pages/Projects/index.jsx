// src/pages/Projects/index.jsx
// Propiedades / proyectos — flujo NETO por unidad (renta − hipoteca − gastos).
// Agrupa ingresos y egresos que tengan un `project` asignado. NO depende del flag
// de inversión: muestra el panorama económico de cada propiedad/proyecto por separado.

import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { Card, PageHeader, Empty } from '../../components/ui/index.jsx'
import { fmtMoney } from '../../utils/index.js'
import { CURRENCY_SYMBOLS } from '../shared/constants.js'

export default function Projects() {
  const { incomes, expenses, debts, settings, updateSettings } = useApp()
  const { t } = useT()
  const sym = CURRENCY_SYMBOLS[settings.currency] || '$'

  const groups = useMemo(() => {
    const map = {}
    const push = (r, kind) => {
      const key = (r?.project || '').trim()
      if (!key) return
      if (!map[key]) map[key] = { name: key, ingresos: 0, egresos: 0, count: 0 }
      const amt = Number(r.amount) || 0
      if (kind === 'inc') map[key].ingresos += amt
      else map[key].egresos += amt
      map[key].count += 1
    }
    ;(incomes || []).forEach(r => push(r, 'inc'))
    ;(expenses || []).forEach(r => push(r, 'exp'))
    return Object.values(map)
      .map(g => ({ ...g, neto: g.ingresos - g.egresos }))
      .sort((a, b) => b.neto - a.neto)
  }, [incomes, expenses])

  const totalNeto = groups.reduce((s, g) => s + g.neto, 0)

  // Valor estimado por propiedad (mapa nombre → valor, guardado en settings) y
  // deudas vinculadas por nombre (campo `project` en Deudas) → equity por unidad.
  const propertyValues = settings.propertyValues || {}
  const mortgageOf = (name) => (debts || [])
    .filter(d => (d?.project || '').trim().toLowerCase() === name.trim().toLowerCase())
    .reduce((s, d) => s + (Number(d.balance) || 0), 0)

  const [editing, setEditing] = useState(null)   // nombre de la propiedad en edición
  const [draft, setDraft]     = useState('')

  function startEdit(name) {
    setEditing(name)
    setDraft(propertyValues[name] ? String(propertyValues[name]) : '')
  }
  async function saveValue(name) {
    const num = Number(draft)
    const next = { ...propertyValues }
    if (num > 0) next[name] = num
    else delete next[name]
    await updateSettings({ ...settings, propertyValues: next })
    setEditing(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageHeader title={t('projects.title')} sub={t('projects.sub')} />

      {groups.length === 0 ? (
        <Card>
          <Empty text={t('projects.empty')} />
          <div style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--mono)', lineHeight: 1.7, marginTop: 8 }}>
            {t('projects.emptyHint')}
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                {groups.length === 1 ? t('projects.totalNet.one', { n: groups.length }) : t('projects.totalNet.many', { n: groups.length })}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--mono)', color: totalNeto >= 0 ? 'var(--grn)' : '#e84142' }}>
                {totalNeto >= 0 ? '+' : ''}{fmtMoney(totalNeto, sym)}
              </div>
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
            {groups.map(g => (
              <Card key={g.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)' }}>{g.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)' }}>{t('projects.movCount', { n: g.count })}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  <Row label={t('projects.incomeRow')} value={`+${fmtMoney(g.ingresos, sym)}`} color="var(--grn)" />
                  <Row label={t('projects.expenseRow')} value={`-${fmtMoney(g.egresos, sym)}`} color="#e84142" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, borderTop: '.5px solid var(--brd)' }}>
                  <div style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{t('projects.netFlow')}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: g.neto >= 0 ? 'var(--grn)' : '#e84142' }}>
                    {g.neto >= 0 ? '+' : ''}{fmtMoney(g.neto, sym)}
                  </div>
                </div>

                {/* Valor estimado + equity (valor − hipoteca vinculada en Deudas) */}
                {(() => {
                  const val = Number(propertyValues[g.name]) || 0
                  const mort = mortgageOf(g.name)
                  if (editing === g.name) return (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '.5px solid var(--brd)' }}>
                      <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', marginBottom: 5 }}>{t('projects.valueHint')}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input type="number" inputMode="decimal" min="0" value={draft} autoFocus placeholder="0"
                          onChange={e => setDraft(e.target.value)}
                          style={{ flex: 1, minWidth: 0, padding: '6px 9px', borderRadius: 6, border: '.5px solid var(--brd2)', background: 'var(--sur2)', color: 'var(--tx)', fontFamily: 'var(--mono)', fontSize: 12 }} />
                        <button onClick={() => saveValue(g.name)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--laton)', color: 'var(--navy)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{t('projects.saveBtn')}</button>
                        <button onClick={() => setEditing(null)} style={{ padding: '6px 10px', borderRadius: 6, border: '.5px solid var(--brd2)', background: 'transparent', color: 'var(--th)', fontSize: 11, cursor: 'pointer' }}>{t('projects.cancelBtn')}</button>
                      </div>
                    </div>
                  )
                  return (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '.5px solid var(--brd)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--mono)' }}>{t('projects.estValue')}</span>
                        <span>
                          {val > 0 && <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--tx)', marginRight: 8 }}>{fmtMoney(val, sym)}</span>}
                          <button onClick={() => startEdit(g.name)} style={{ background: 'none', border: 'none', color: 'var(--grn)', fontSize: 11, fontFamily: 'var(--mono)', cursor: 'pointer', padding: 0 }}>
                            {val > 0 ? t('projects.editValue') : t('projects.setValue')}
                          </button>
                        </span>
                      </div>
                      {mort > 0 && <Row label={t('projects.linkedMortgage')} value={`-${fmtMoney(mort, sym)}`} color="#e84142" />}
                      {val > 0 && mort === 0 && (
                        <div style={{ fontSize: 10, color: 'var(--amb, #b45309)', fontFamily: 'var(--mono)', lineHeight: 1.5, padding: '6px 8px', background: 'rgba(245,166,35,.08)', border: '.5px solid rgba(245,166,35,.25)', borderRadius: 6 }}>
                          {t('projects.noMortgageHint')}
                        </div>
                      )}
                      {val > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{t('projects.equity')}</span>
                          <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--mono)', color: (val - mort) >= 0 ? 'var(--grn)' : '#e84142' }}>{fmtMoney(val - mort, sym)}</span>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </Card>
            ))}
          </div>

          <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', lineHeight: 1.6, padding: '0 4px' }}>
            {t('projects.disclaimer')}
          </div>
        </>
      )}
    </div>
  )
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--mono)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--mono)', color }}>{value}</span>
    </div>
  )
}
