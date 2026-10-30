// src/pages/Debts/Receivables.jsx — pestaña "Me deben" de Deudas (D2, rial #45–#47).
//
// Lo que otras personas me deben: un registro de la store `debts` con
// direction 'owed' (utils/debtDirection.js). Es un activo en el patrimonio,
// aparece como "Cobro" en Próximos pagos cuando tiene fecha y no entra en la
// carga de deuda del IQ Score. Un cobro (parcial o total) baja el saldo y, si
// se deja marcado "Registrar como ingreso", crea el ingreso con addIncome para
// que aparezca en Movimientos. Ese ingreso lleva receivableId + collectionId:
// al borrar el "me deben" se borra con él (un solo Deshacer).
//
// V2 (un primario por pantalla): el único botón Latón es "+ Nuevo por cobrar"
// (o "Guardar" con el formulario abierto); las acciones de cada fila son
// secundarias. Estructura por líneas: grupos con línea del 18 %, filas del 10 %.
import { useMemo, useState } from 'react'
import { KPI, Card, CardHeader, FormGroup, FormRow, Btn, Alert, Badge } from '../../components/ui/index.jsx'
import StateTag from '../../components/ledger/StateTag.jsx'
import Money, { useMoney } from '../../components/Money.jsx'
import { useT } from '../../i18n/useT.js'
import { fmtMoney, dateLocale, localDateStr, uid } from '../../utils/index.js'
import { applyCollection, groupReceivables, linkedCollectionIncomes, newReceivable, owedTotals, receivableState } from '../../utils/debtDirection.js'

const STATE_TONE = { pending: 'muted', late: 'warn', undated: 'muted', collected: 'ok' }
const EMPTY_FORM = { who: '', amount: '', date: '', notes: '' }

function shortDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  try { return new Date(y, m - 1, d).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) } catch { return iso }
}

const groupHead = { display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 0', paddingTop: 12, borderTop: '1px solid var(--brd2)', fontSize: 12, fontWeight: 600, color: 'var(--tm)', fontFamily: 'var(--sans)' }

export default function Receivables({ receivables, incomes, addDebt, updateDebt, addIncome, deleteWithUndo, settings, sym }) {
  const { t } = useT()
  const { m } = useMoney()
  const money = (v) => m(fmtMoney(v, sym))
  const [show, setShow] = useState(false)
  const [f, setF] = useState(EMPTY_FORM)
  const [err, setErr] = useState('')
  const [collectId, setCollectId] = useState(null)
  const [collectAmt, setCollectAmt] = useState('')
  const [asIncome, setAsIncome] = useState(true)
  const [msg, setMsg] = useState(null)
  const today = localDateStr()

  const totals = useMemo(() => owedTotals(receivables), [receivables])
  const groups = useMemo(() => groupReceivables(receivables), [receivables])

  async function submit() {
    if (!f.who.trim() || !(Number(f.amount) > 0)) { setErr(t('debts.owed.err.required')); return }
    setErr('')
    await addDebt(newReceivable(f))
    setF(EMPTY_FORM)
    setShow(false)
  }

  function openCollect(d) {
    setCollectId(d.id)
    setCollectAmt(String(Number(d.balance) || ''))
    setAsIncome(true)
  }

  async function confirmCollect(d) {
    const collectionId = uid()
    const { debt, amount } = applyCollection(d, collectAmt, { date: today, id: collectionId })
    if (amount <= 0) return
    await updateDebt(debt)
    if (asIncome && addIncome) {
      await addIncome({
        date: today,
        source: t('debts.owed.income.desc', { who: d.creditor }),
        amount,
        category: 'Otro',
        recurrence: 'Único',
        notes: d.notes || '',
        receivableId: d.id,
        collectionId,
      })
    }
    setCollectId(null)
    setMsg({ id: d.id, text: t('debts.owed.collect.done', { amt: money(amount) }) })
    setTimeout(() => setMsg(null), 3000)
  }

  // Borrar un "me deben" borra también los ingresos que crearon sus cobros
  // (solo los vinculados por receivableId) y "Deshacer" restaura todo junto.
  function remove(d) {
    const linked = linkedCollectionIncomes(d, incomes)
    const n = linked.length
    const text = n === 0 ? t('common.deleted') : t(n === 1 ? 'debts.owed.deletedWithIncome.one' : 'debts.owed.deletedWithIncome.many', { n })
    deleteWithUndo('debts', d, text, t('common.undo'), linked.map(item => ({ store: 'incomes', item })))
  }

  const renderRow = (d, i) => {
    const state = receivableState(d, today)
    const balance = Number(d.balance) || 0
    const initial = Number(d.initial) || 0
    const partial = balance > 0 && initial > balance
    const history = (Array.isArray(d.collections) ? d.collections : []).slice(-3)
    const entered = Number(collectAmt) || 0
    const isFull = entered >= balance
    const meta = [
      d.dueDate ? t('debts.owed.expected', { d: shortDate(d.dueDate) }) : '',
      d.notes || '',
    ].filter(Boolean).join(' · ')
    return (
      <li key={d.id} style={{ listStyle: 'none', padding: '12px 0', borderTop: i > 0 ? '1px solid var(--brd)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)', fontFamily: 'var(--sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.creditor}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 3, fontSize: 12, color: 'var(--th)', fontFamily: 'var(--sans)' }}>
              {/* En el grupo "Sin fecha" la fecha ya la dice el título: el estado es "Pendiente". */}
              <StateTag tone={STATE_TONE[state]} label={t(`debts.owed.state.${state === 'undated' ? 'pending' : state}`)} size={13} />
              {meta && <span style={{ minWidth: 0 }}>{meta}</span>}
            </div>
            {history.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--sans)', marginTop: 3 }}>
                {t('debts.owed.history', { list: history.map(c => `${shortDate(c.date)} +${money(c.amount)}`).join(' · ') })}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="num" style={{ fontSize: 14, fontWeight: 600, color: balance > 0 ? 'var(--pos)' : 'var(--th)' }}>
              {balance > 0 ? '+' : ''}<Money>{fmtMoney(balance > 0 ? balance : initial, sym)}</Money>
            </div>
            {partial && <div style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--sans)' }}>{t('debts.owed.ofTotal', { v: money(initial) })}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          {balance > 0 && collectId !== d.id && (
            <Btn variant="ghost" size="sm" onClick={() => openCollect(d)} style={{ color: 'var(--tx)', fontWeight: 600 }}>{t('debts.owed.collectBtn')}</Btn>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => remove(d)} aria-label={t('debts.owed.delete')}
            style={{ background: 'none', border: 'none', color: 'var(--th)', fontSize: 13, cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        {collectId === d.id && (
          <div style={{ marginTop: 6, padding: '10px 12px', borderRadius: 8, background: 'var(--sur2)', border: '0.5px solid var(--brd2)' }}>
            <FormRow>
              <FormGroup label={t('debts.owed.collect.amount')}>
                <input type="number" inputMode="decimal" min="0" step="0.01" max={balance} value={collectAmt} onChange={e => setCollectAmt(e.target.value)} />
              </FormGroup>
            </FormRow>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: 13, color: 'var(--tx)', fontFamily: 'var(--sans)', cursor: 'pointer' }}>
              <input type="checkbox" checked={asIncome} onChange={e => setAsIncome(e.target.checked)} style={{ width: 18, height: 18, flexShrink: 0 }} />
              <span>{t('debts.owed.collect.asIncome')} <span style={{ color: 'var(--th)', fontSize: 12 }}>{t('debts.owed.collect.asIncomeHint')}</span></span>
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn variant="ghost" size="sm" onClick={() => confirmCollect(d)} disabled={entered <= 0}
                style={{ color: 'var(--tx)', fontWeight: 600, borderColor: 'var(--tm)' }}>
                {t(isFull ? 'debts.owed.collect.full' : 'debts.owed.collect.partial')}
              </Btn>
              <Btn variant="ghost" size="sm" onClick={() => setCollectId(null)}>{t('common.cancel')}</Btn>
            </div>
          </div>
        )}
        {msg?.id === d.id && (
          <div role="status" style={{ marginTop: 6 }}><StateTag tone="ok" label={msg.text} size={13} /></div>
        )}
      </li>
    )
  }

  const hasAny = (receivables || []).length > 0

  return (
    <>
      <p style={{ fontSize: 12.5, color: 'var(--th)', fontFamily: 'var(--sans)', lineHeight: 1.5, margin: 0 }}>{t('debts.owed.intro')}</p>
      <div className="kpi-row" data-tour="debt-kpis">
        <KPI label={t('debts.owed.kpi.pending')} value={money(totals.pending)} color="green" />
        <KPI label={t('debts.owed.kpi.collected')} value={money(totals.collected)} />
        <KPI label={t('debts.owed.kpi.open')} value={totals.open} />
      </div>
      <div data-tour="debt-new">
        <Btn variant={show ? 'ghost' : 'primary'} onClick={() => setShow(s => !s)} aria-expanded={show}>
          {show ? t('debts.toggle.close') : t('debts.owed.toggle.new')}
        </Btn>
      </div>
      {show && (
        <Card>
          <CardHeader title={t('debts.owed.new')} />
          {err && <Alert type="danger">{err}</Alert>}
          <FormRow>
            <FormGroup label={t('debts.owed.form.who')}><input type="text" value={f.who} placeholder={t('debts.owed.form.whoPh')} onChange={e => setF(p => ({ ...p, who: e.target.value }))} /></FormGroup>
            <FormGroup label={t('debts.owed.form.amount', { currency: settings?.currency || '' })}><input type="number" inputMode="decimal" min="0" step="0.01" value={f.amount} placeholder="0" onChange={e => setF(p => ({ ...p, amount: e.target.value }))} /></FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label={t('debts.owed.form.date')}><input type="date" value={f.date} onChange={e => setF(p => ({ ...p, date: e.target.value }))} /></FormGroup>
            <FormGroup label={t('debts.owed.form.notes')}><input type="text" value={f.notes} placeholder={t('debts.owed.form.notesPh')} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} /></FormGroup>
          </FormRow>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="primary" onClick={submit}>{t('debts.owed.form.submit')}</Btn>
            <Btn variant="ghost" onClick={() => { setShow(false); setErr('') }}>{t('common.cancel')}</Btn>
          </div>
        </Card>
      )}
      {!hasAny && !show && (
        <Card>
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--tx)', fontFamily: 'var(--sans)', marginBottom: 6 }}>{t('debts.owed.empty')}</div>
            <div style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--sans)', lineHeight: 1.5 }}>{t('debts.owed.emptyHint')}</div>
          </div>
        </Card>
      )}
      {groups.dated.length > 0 && (
        <section aria-labelledby="rcv-dated">
          <h2 id="rcv-dated" style={groupHead}>{t('debts.owed.group.dated')}</h2>
          <ul style={{ margin: 0, padding: 0 }}>{groups.dated.map(renderRow)}</ul>
        </section>
      )}
      {groups.undated.length > 0 && (
        <section aria-labelledby="rcv-undated">
          <h2 id="rcv-undated" style={groupHead}>{t('debts.owed.group.undated')} <Badge color="amber">{groups.undated.length}</Badge></h2>
          <ul style={{ margin: 0, padding: 0 }}>{groups.undated.map(renderRow)}</ul>
        </section>
      )}
      {groups.done.length > 0 && (
        <section aria-labelledby="rcv-done">
          <h2 id="rcv-done" style={groupHead}>{t('debts.owed.group.done')}</h2>
          <ul style={{ margin: 0, padding: 0 }}>{groups.done.map(renderRow)}</ul>
        </section>
      )}
    </>
  )
}
