// src/pages/Advisor/index.jsx
// Modo Asesor — FinanceOS v1.2
// Vista profesional para diagnóstico, seguimiento y preparación de reuniones
// AVISO: Las alertas y señales son orientativas. No constituyen asesoría financiera certificada.

import { useState, useMemo } from 'react'
import useSubscriptionMetrics from '../../hooks/useSubscriptionMetrics.js'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { Card, CardHeader, Alert } from '../../components/ui/index.jsx'
import { fmtMoney, fmtPct, moneyLocale, dateLocale } from '../../utils/index.js'
import ProGate from '../../components/ui/ProGate.jsx'
import { FinancialDisclaimer } from '../../components/legal/MicroCopy.jsx'
import { downloadReportePDF } from './ReportePDF.jsx'
import TemplateSelector from '../../components/templates/TemplateSelector.jsx'
import config from '../../config.js'
import { calcNetWorth } from '../../utils/netWorth.js'
import { countBudgetsExceeded } from '../../utils/budgets.js'
import { personalDebtRatio, personalDebts } from '../../utils/personal.js'
import { findEmergencyGoal } from '../../utils/emergencyGoal.js'
import { CURRENCY_SYMBOLS } from '../shared/constants.js'

// ── SEMÁFORO — reglas de cálculo ─────────────────────────────────────────────
// Verde:    condición saludable
// Amarillo: atención recomendada
// Rojo:     riesgo detectado
function calcTrafficLight(metrics, t) {
  const signals = []

  // 1. Tasa de ahorro
  if (metrics.savingRate >= 0.20) {
    signals.push({ id: 'saving', label: t('adv.tl.saving'), status: 'green',  value: fmtPct(metrics.savingRate), note: t('adv.tl.saving.green', { pct: fmtPct(metrics.savingRate) }) })
  } else if (metrics.savingRate >= 0.10) {
    signals.push({ id: 'saving', label: t('adv.tl.saving'), status: 'yellow', value: fmtPct(metrics.savingRate), note: t('adv.tl.saving.yellow', { pct: fmtPct(metrics.savingRate) }) })
  } else {
    signals.push({ id: 'saving', label: t('adv.tl.saving'), status: 'red',    value: fmtPct(metrics.savingRate), note: t('adv.tl.saving.red', { pct: fmtPct(metrics.savingRate) }) })
  }

  // 2. Ratio deuda / ingreso anual — ya viene calculado en metrics.debtRatio
  // (personalDebtRatio, utils/personal.js): con ingreso $0 y deuda, es carga
  // máxima (1), no 0 — antes este semáforo decía "Saludable" en verde
  // exactamente cuando el score daba 0 de 20 puntos para la misma situación.
  const debtRatio = metrics.debtRatio ?? 0
  if (debtRatio <= 0.30) {
    signals.push({ id: 'debt', label: t('adv.tl.debt'), status: 'green',  value: fmtPct(debtRatio), note: t('adv.tl.debt.green', { pct: fmtPct(debtRatio) }) })
  } else if (debtRatio <= 0.60) {
    signals.push({ id: 'debt', label: t('adv.tl.debt'), status: 'yellow', value: fmtPct(debtRatio), note: t('adv.tl.debt.yellow', { pct: fmtPct(debtRatio) }) })
  } else {
    signals.push({ id: 'debt', label: t('adv.tl.debt'), status: 'red',    value: fmtPct(debtRatio), note: t('adv.tl.debt.red', { pct: fmtPct(debtRatio) }) })
  }

  // 3. Flujo neto del mes
  if (metrics.mBalance > 0) {
    signals.push({ id: 'flow', label: t('adv.tl.flow'), status: 'green',  value: fmtMoney(metrics.mBalance, metrics.sym), note: t('adv.tl.flow.green') })
  } else if (metrics.mBalance === 0) {
    signals.push({ id: 'flow', label: t('adv.tl.flow'), status: 'yellow', value: fmtMoney(0, metrics.sym), note: t('adv.tl.flow.yellow') })
  } else {
    signals.push({ id: 'flow', label: t('adv.tl.flow'), status: 'red',    value: fmtMoney(metrics.mBalance, metrics.sym), note: t('adv.tl.flow.red') })
  }

  // 4. Metas con progreso
  const goalsOk = metrics.goals.filter(g => g.saved / g.target >= 0.25).length
  const goalsTotal = metrics.goals.length
  if (goalsTotal === 0) {
    signals.push({ id: 'goals', label: t('adv.tl.goals'), status: 'yellow', value: t('adv.tl.goals.none'), note: t('adv.tl.goals.noneNote') })
  } else if (goalsOk >= goalsTotal * 0.5) {
    signals.push({ id: 'goals', label: t('adv.tl.goals'), status: 'green',  value: `${goalsOk}/${goalsTotal}`, note: t('adv.tl.goals.okNote', { ok: goalsOk, total: goalsTotal }) })
  } else {
    signals.push({ id: 'goals', label: t('adv.tl.goals'), status: 'yellow', value: `${goalsOk}/${goalsTotal}`, note: t('adv.tl.goals.lowNote', { ok: goalsOk, total: goalsTotal }) })
  }

  // 5. Presupuestos excedidos
  const overBudget = metrics.overBudgetCount
  if (overBudget === 0 && metrics.budgets.length > 0) {
    signals.push({ id: 'budgets', label: t('adv.tl.budgets'), status: 'green',  value: t('adv.tl.budgets.ok'), note: t('adv.tl.budgets.okNote') })
  } else if (overBudget > 0) {
    signals.push({ id: 'budgets', label: t('adv.tl.budgets'), status: overBudget >= 2 ? 'red' : 'yellow', value: t('adv.tl.budgets.over', { n: overBudget }), note: t('adv.tl.budgets.overNote', { n: overBudget }) })
  }

  return signals
}

// ── ALERTAS AUTOMÁTICAS ──────────────────────────────────────────────────────
function calcAlerts(metrics, t) {
  const alerts = []

  if (metrics.savingRate < 0.10 && metrics.mIncome > 0)
    alerts.push({ type: 'danger', text: t('adv.alert.savingCritical', { pct: fmtPct(metrics.savingRate) }) })

  if (metrics.mBalance < 0)
    alerts.push({ type: 'danger', text: t('adv.alert.negativeFlow', { v: fmtMoney(metrics.mBalance, metrics.sym) }) })

  const highRateDebt = metrics.debts.filter(d => d.rate > 15)
  if (highRateDebt.length > 0)
    alerts.push({ type: 'warn', text: t('adv.alert.highRate', { n: highRateDebt.length, names: highRateDebt.map(d => d.creditor).join(', ') }) })

  if (metrics.overBudgetCount >= 2)
    alerts.push({ type: 'warn', text: t('adv.alert.overBudget', { n: metrics.overBudgetCount }) })

  const deseos = metrics.monthExpenses.filter(e => e.type === 'Deseo').reduce((s, e) => s + e.amount, 0)
  const deseosRatio = metrics.mIncome > 0 ? deseos / metrics.mIncome : 0
  if (deseosRatio > 0.35 && metrics.mIncome > 0)
    alerts.push({ type: 'warn', text: t('adv.alert.wants', { pct: fmtPct(deseosRatio) }) })

  const urgentDebts = metrics.debts.filter(d => {
    if (!d.dueDate) return false
    const days = (new Date(d.dueDate) - new Date()) / (1000 * 60 * 60 * 24)
    return days >= 0 && days <= 10
  })
  if (urgentDebts.length > 0)
    alerts.push({ type: 'warn', text: t('adv.alert.dueSoon', { n: urgentDebts.length, names: urgentDebts.map(d => d.creditor).join(', ') }) })

  const emergencyGoal = findEmergencyGoal(metrics.goals)
  if (!emergencyGoal)
    alerts.push({ type: 'info', text: t('adv.alert.noEmergency') })
  else if (emergencyGoal.saved / emergencyGoal.target < 0.5)
    alerts.push({ type: 'info', text: t('adv.alert.emergencyLow', { pct: fmtPct(emergencyGoal.saved / emergencyGoal.target) }) })

  if (metrics.goals.length === 0)
    alerts.push({ type: 'info', text: t('adv.alert.noGoals') })

  return alerts
}

// ── SEMÁFORO VISUAL ──────────────────────────────────────────────────────────
function TrafficLight({ signals }) {
  const { t } = useT()
  const colors = { green: '#1aa368', yellow: '#d4982a', red: '#e05a4a' }
  const bg     = { green: '#e4f5ec', yellow: '#faeeda', red: '#fdf0ee' }
  const labels = { green: t('adv.status.green'), yellow: t('adv.status.yellow'), red: t('adv.status.red') }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {signals.map(s => (
        <div key={s.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 8,
          background: bg[s.status], border: `0.5px solid ${colors[s.status]}22`,
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: colors[s.status], flexShrink: 0,
            boxShadow: `0 0 6px ${colors[s.status]}66`,
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)', marginBottom: 1 }}>{s.label}</div>
            <div style={{ fontSize: 12, color: 'var(--tm)', fontFamily: 'var(--sans)', lineHeight: 1.5 }}>{s.note}</div>
          </div>
          <div style={{
            fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 600,
            color: colors[s.status], flexShrink: 0,
            background: `${colors[s.status]}18`, padding: '2px 8px', borderRadius: 20,
          }}>
            {labels[s.status]}
          </div>
        </div>
      ))}
      <p style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', marginTop: 4, lineHeight: 1.5 }}>
        {t('adv.tl.disclaimer')}
      </p>
    </div>
  )
}

// ── KPI CARD SIMPLE ──────────────────────────────────────────────────────────
function AdvisorKPI({ label, value, sub, color = 'var(--tx)' }) {
  // Fuente adaptativa: números largos (patrimonios/deudas en millones) se achican
  // para no desbordar la caja en móvil (375px). Además overflowWrap por seguridad.
  const len = String(value).length
  const valSize = len > 13 ? 12 : len > 11 ? 14 : len > 9 ? 16 : 20
  return (
    <div style={{
      background: 'var(--sur2)', border: '0.5px solid var(--brd)',
      borderRadius: 8, padding: '12px 14px', minWidth: 0, overflow: 'hidden',
    }}>
      <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: valSize, fontWeight: 700, color, fontFamily: 'var(--mono)', letterSpacing: '-0.5px', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', marginTop: 3, overflowWrap: 'anywhere' }}>{sub}</div>}
    </div>
  )
}

// ── ADVISOR NOTES — comentarios y próximos pasos ─────────────────────────────
function AdvisorNotes({ notes, onSave }) {
  const { t } = useT()
  const [comments, setComments] = useState(notes.comments || '')
  const [nextSteps, setNextSteps] = useState(notes.nextSteps || '')
  const [meetingDate, setMeetingDate] = useState(notes.meetingDate || '')
  const [clientName, setClientName] = useState(notes.clientName || '')
  const [saved, setSaved] = useState(false)

  function handleSave() {
    onSave({ comments, nextSteps, meetingDate, clientName, updatedAt: new Date().toISOString() })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const ta = {
    width: '100%', minHeight: 80, resize: 'vertical',
    background: 'var(--sur)', border: '0.5px solid var(--brd2)',
    borderRadius: 6, padding: '10px 12px', fontSize: 12,
    color: 'var(--tx)', fontFamily: 'var(--syne, sans-serif)',
    lineHeight: 1.6,
  }
  const inp = {
    width: '100%', background: 'var(--sur)', border: '0.5px solid var(--brd2)',
    borderRadius: 6, padding: '8px 12px', fontSize: 12,
    color: 'var(--tx)', fontFamily: 'var(--syne, sans-serif)',
  }
  const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--tx)', marginBottom: 5, display: 'block' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={lbl}>{t('adv.notes.clientName')}</label>
          <input style={inp} value={clientName} onChange={e => setClientName(e.target.value)} placeholder={t('adv.notes.clientNamePh')} />
        </div>
        <div>
          <label style={lbl}>{t('adv.notes.nextMeeting')}</label>
          <input style={{ ...inp }} type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} />
        </div>
      </div>

      <div>
        <label style={lbl}>{t('adv.notes.comments')}</label>
        <textarea
          style={ta}
          value={comments}
          onChange={e => setComments(e.target.value)}
          placeholder={t('adv.notes.commentsPh')}
        />
      </div>

      <div>
        <label style={lbl}>{t('adv.notes.nextSteps')}</label>
        <textarea
          style={{ ...ta, minHeight: 70 }}
          value={nextSteps}
          onChange={e => setNextSteps(e.target.value)}
          placeholder="1. Revisar gastos de entretenimiento&#10;2. Definir meta de fondo de emergencia&#10;3. Evaluar refinanciamiento tarjeta BancoEstado"
        />
        <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', marginTop: 4 }}>
          {t('adv.notes.nextStepsHint')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={handleSave}
          style={{
            background: 'var(--grn)', color: '#fff', border: 'none',
            borderRadius: 6, padding: '9px 20px', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--syne, sans-serif)',
          }}
        >
          {saved ? t('adv.notes.saved') : t('adv.notes.save')}
        </button>
        {notes.updatedAt && (
          <span style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)' }}>
            {t('adv.notes.updated', { d: new Date(notes.updatedAt).toLocaleDateString(dateLocale()) })}
          </span>
        )}
      </div>

      <div style={{
        fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)',
        padding: '8px 10px', background: 'var(--sur2)',
        borderRadius: 6, borderLeft: '2px solid var(--brd2)', lineHeight: 1.5,
      }}>
        {t('adv.notes.local')}
      </div>
    </div>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function Advisor() {
  const { t } = useT()
  const { incomes: _incAll, expenses: _expAll, budgets, debts, goals, settings, updateSettings } = useApp()
  const incomes = (_incAll || []).filter(r => !r?.inv)   // Modo Asesor personal: excluye inversión
  const expenses = (_expAll || []).filter(r => !r?.inv)
  const sym = CURRENCY_SYMBOLS[settings.currency] || '$'

  // Leer y guardar notas del asesor en settings (local)
  const advisorNotes = settings.advisorNotes || {}
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError]     = useState(null)

  function saveNotes(notes) {
    updateSettings({ ...settings, advisorNotes: notes })
  }

  async function handleExportPDF() {
    setPdfLoading(true)
    setPdfError(null)
    try {
      const expByCat = {}
      monthExpenses.forEach(e => { expByCat[e.category] = (expByCat[e.category] || 0) + e.amount })
      await downloadReportePDF({
        brandName:        config.app.name,
        clientName:       advisorNotes.clientName || 'Cliente',
        activeMonth,
        sym,
        mIncome, mExpense, mBalance, savingRate,
        totalDebt, totalMinPayments,
        signals, alerts, goals, debts,
        overBudgetCount, score, scoreLabel, scoreColor,
        advisorNotes,
        expByCategory:    expByCat,
        subMonthly, subAnnual, subCount,
        subAlerts:        subAlerts.slice(0, 3),
        subByCategory:    subMetrics?.byCategory || [],
        netWorth:         nw.hasData ? nw : null,
      })
    } catch (e) {
      console.error('PDF error:', e)
      setPdfError(t('adv.pdf.error'))
    } finally {
      setPdfLoading(false)
    }
  }

  // Mes activo
  const activeMonth = settings.activeMonth || new Date().toISOString().slice(0, 7)
  const monthLabel = (m) => {
    const [y, mo] = m.split('-')
    return `${['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][+mo]} ${y}`
  }

  // Métricas del mes activo
  const monthIncomes  = useMemo(() => incomes.filter(r => r.date?.startsWith(activeMonth)),  [incomes,  activeMonth])
  const monthExpenses = useMemo(() => expenses.filter(r => r.date?.startsWith(activeMonth)), [expenses, activeMonth])
  const mIncome  = monthIncomes.reduce((s, r) => s + r.amount, 0)
  const mExpense = monthExpenses.reduce((s, r) => s + r.amount, 0)
  const mBalance = mIncome - mExpense
  const savingRate = mIncome > 0 ? mBalance / mIncome : 0
  // Solo deuda del ámbito personal (excluye propiedades de inversión) — mismo
  // cálculo que el score y el Coach, ver personalDebtRatio en utils/personal.js.
  const { totalDebt, ratio: debtRatio } = personalDebtRatio(debts, mIncome * 12)
  const totalMinPayments = personalDebts(debts).reduce((s, d) => s + (d.minPayment || 0), 0)

  // Presupuestos excedidos
  const expByCat = useMemo(() => {
    const m = {}
    monthExpenses.forEach(e => { m[e.category] = (m[e.category] || 0) + e.amount })
    return m
  }, [monthExpenses])

  const overBudgetCount = countBudgetsExceeded({ budgets, expenses: _expAll, activeMonth, settings })

  // Metas
  const goalsProgress = goals.map(g => ({ ...g, pct: g.target > 0 ? g.saved / g.target : 0 }))
  const avgGoalPct = goalsProgress.length > 0 ? goalsProgress.reduce((s, g) => s + g.pct, 0) / goalsProgress.length : 0

  const metrics = { savingRate, mIncome, mExpense, mBalance, totalDebt, debtRatio, goals, budgets, overBudgetCount, monthExpenses, debts, sym }
  const signals = useMemo(() => calcTrafficLight(metrics, t), [savingRate, mIncome, mBalance, totalDebt, debtRatio, overBudgetCount, goals.length, settings.language])
  const alerts  = useMemo(() => calcAlerts(metrics, t),       [savingRate, mIncome, mBalance, debts, monthExpenses, goals, overBudgetCount, settings.language])

  // Score general (0-100) basado en semáforos
  const scoreMap = { green: 100, yellow: 50, red: 0 }
  const score = signals.length > 0 ? Math.round(signals.reduce((s, sig) => s + scoreMap[sig.status], 0) / signals.length) : 0
  const scoreColor = score >= 70 ? '#1aa368' : score >= 40 ? '#d4982a' : '#e05a4a'
  const scoreLabel = score >= 70 ? t('adv.score.healthy') : score >= 40 ? t('adv.score.attention') : t('adv.score.risk')

  // Patrimonio neto (stock a hoy) — opcional: solo si hay datos que lo alimenten.
  // Usa movimientos SIN filtrar inversión (el flujo de propiedades vive en registros 💼).
  const nw = useMemo(() => calcNetWorth({ goals, debts, incomes: _incAll, expenses: _expAll, settings }),
    [goals, debts, _incAll, _expAll, settings])

  const noData = mIncome === 0 && mExpense === 0 && debts.length === 0

  // Suscripciones — hook compartido
  const subMetrics = useSubscriptionMetrics()
  const { monthly: subMonthly, annual: subAnnual, pct: subPct,
          count: subCount, alerts: subAlerts, activeSubs } = subMetrics

  return (
    <ProGate feature="Modo Asesor">{/* nombre de feature interno */}
    <div className="stack">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <h1 className="display" style={{ fontSize: 24, fontWeight: 700 }}>{t('adv.title')}</h1>
            <div style={{
              fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 600,
              background: 'var(--grn-bg)', color: 'var(--grn)',
              padding: '2px 8px', borderRadius: 20, letterSpacing: '0.5px',
            }}>
              {t('adv.badge')}
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)' }}>
            {t('adv.sub', { month: monthLabel(activeMonth) })}
          </p>
        </div>
        <select
          value={activeMonth}
          onChange={e => updateSettings({ ...settings, activeMonth: e.target.value })}
          style={{ width: 'auto', fontSize: 11, padding: '5px 8px' }}
        >
          {[...new Set([
            ...incomes.map(r => r.date?.slice(0,7)),
            ...expenses.map(r => r.date?.slice(0,7)),
          ].filter(Boolean))].sort().reverse().map(m => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>
      </div>

      {noData && (
        <div style={{
          padding: '20px 24px', background: 'var(--sur2)',
          border: '0.5px solid var(--brd)', borderRadius: 8,
          fontSize: 13, color: 'var(--tm)', lineHeight: 1.6, textAlign: 'center',
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>◈</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('adv.empty.title')}</div>
          <div style={{ fontSize: 12, color: 'var(--th)' }}>
            {t('adv.empty.sub')}
          </div>
        </div>
      )}

      {!noData && (
        <>
          {/* Score general */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                border: `4px solid ${scoreColor}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <div className="num" style={{ fontSize: 24, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{score}</div>
                <div style={{ fontSize: 8, color: 'var(--th)', fontFamily: 'var(--mono)' }}>/ 100</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: scoreColor, marginBottom: 3 }}>{scoreLabel}</div>
                <div style={{ fontSize: 12, color: 'var(--tm)', lineHeight: 1.5 }}>
                  {advisorNotes.clientName ? t('adv.score.client', { name: advisorNotes.clientName }) : ''}
                  {t('adv.score.summary', { g: signals.filter(s => s.status === 'green').length, y: signals.filter(s => s.status === 'yellow').length, r: signals.filter(s => s.status === 'red').length })}
                </div>
                {advisorNotes.meetingDate && (
                  <div style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', marginTop: 4 }}>
                    {t('adv.score.nextMeeting', { d: new Date(advisorNotes.meetingDate + 'T12:00').toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) })}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {[
                  { c: '#1aa368', l: t('adv.status.green') },
                  { c: '#d4982a', l: t('adv.status.yellow') },
                  { c: '#e05a4a', l: t('adv.status.red') },
                ].map(i => (
                  <div key={i.l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: i.c }} />
                    {i.l}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            <AdvisorKPI label={t('adv.kpi.income')} value={fmtMoney(mIncome, sym)} color="var(--grn)" />
            <AdvisorKPI label={t('adv.kpi.expense')} value={fmtMoney(mExpense, sym)} color={mExpense > mIncome ? '#e05a4a' : 'var(--tx)'} />
            <AdvisorKPI label={t('adv.kpi.flow')} value={fmtMoney(mBalance, sym)} color={mBalance >= 0 ? 'var(--grn)' : '#e05a4a'} />
            <AdvisorKPI label={t('adv.kpi.savingRate')} value={fmtPct(savingRate)} color={savingRate >= 0.2 ? 'var(--grn)' : savingRate >= 0.1 ? '#d4982a' : '#e05a4a'} sub={t('adv.kpi.savingGoal')} />
            <AdvisorKPI label={t('adv.kpi.debt')} value={fmtMoney(totalDebt, sym)} color={totalDebt > 0 ? '#d4982a' : 'var(--grn)'} sub={totalDebt > 0 ? t('adv.kpi.minPerMonth', { v: fmtMoney(totalMinPayments, sym) }) : t('adv.kpi.noDebts')} />
            <AdvisorKPI label={t('adv.kpi.goals')} value={goals.length} sub={t('adv.kpi.avgProgress', { pct: fmtPct(avgGoalPct) })} />
            <AdvisorKPI label={t('adv.kpi.budgets')} value={overBudgetCount > 0 ? t('adv.kpi.budgetsOver', { n: overBudgetCount }) : t('adv.kpi.budgetsOk')} color={overBudgetCount > 0 ? '#e05a4a' : 'var(--grn)'} />
            {nw.hasData && <AdvisorKPI label={t('adv.kpi.netWorth')} value={fmtMoney(nw.netWorth, sym)} color={nw.netWorth >= 0 ? 'var(--grn)' : '#e05a4a'} sub={t('adv.kpi.netWorthSub', { a: fmtMoney(nw.totalActivos, sym), p: fmtMoney(nw.totalPasivos, sym) })} />}
          </div>

          {/* Semáforo */}
          <Card>
            <CardHeader title={t('adv.trafficTitle')} />
            <TrafficLight signals={signals} />
          </Card>

          {/* Alertas automáticas */}
          {alerts.length > 0 && (
            <Card>
              <CardHeader title={t('adv.alertsTitle', { n: alerts.length })} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alerts.map((a, i) => (
                  <Alert key={i} type={a.type}>{a.text}</Alert>
                ))}
              </div>
              <p style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', marginTop: 8, lineHeight: 1.5 }}>
                {t('adv.alertsDisclaimer')}
              </p>
            </Card>
          )}

          {/* Desglose deudas */}
          {debts.length > 0 && (
            <Card>
              <CardHeader title={t('adv.debtsTitle')} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {debts.map(d => {
                  const pct = d.initial > 0 ? (d.initial - d.balance) / d.initial : 0
                  return (
                    <div key={d.id} style={{
                      padding: '10px 12px', background: 'var(--sur2)',
                      borderRadius: 8, border: '0.5px solid var(--brd)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)' }}>{d.creditor}</div>
                          <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)' }}>
                            {t('adv.debts.rateLine', { rate: d.rate, v: fmtMoney(d.minPayment || 0, sym) })}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#d4982a', fontFamily: 'var(--mono)' }}>{fmtMoney(d.balance, sym)}</div>
                          <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)' }}>{t('adv.debts.pending')}</div>
                        </div>
                      </div>
                      <div style={{ height: 4, background: 'var(--brd)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(pct * 100, 100)}%`, background: 'var(--grn)', borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--th)', fontFamily: 'var(--mono)', marginTop: 3 }}>
                        {t('adv.debts.paidDue', { pct: fmtPct(pct), d: d.dueDate || '—' })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Metas */}
          {goals.length > 0 && (
            <Card>
              <CardHeader title={t('adv.goalsTitle')} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {goals.map(g => {
                  const pct = g.target > 0 ? Math.min(g.saved / g.target, 1) : 0
                  return (
                    <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--tx)' }}>{g.name}</span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)' }}>
                          {fmtMoney(g.saved, sym)} / {fmtMoney(g.target, sym)}
                        </span>
                      </div>
                      <div style={{ height: 5, background: 'var(--brd)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct * 100}%`, background: g.color || 'var(--grn)', borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--th)', fontFamily: 'var(--mono)' }}>
                        {t('adv.goals.line', { pct: fmtPct(pct), d: g.targetDate || '—', p: g.priority || '—' })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Notas del asesor — siempre visible */}
      <Card>
        <CardHeader title={t('adv.notesTitle')} />
        <AdvisorNotes notes={advisorNotes} onSave={saveNotes} />
      </Card>

      {/* Plantilla del cliente */}
      <Card>
        <CardHeader title={t('adv.profileTitle')} />
        <TemplateSelector compact />
      </Card>

      {/* Preview PDF + CTA */}
      <div style={{border:'0.5px solid rgba(26,163,104,.2)',borderRadius:10,overflow:'hidden'}}>
        {/* Preview mini del reporte */}
        <div style={{background:'#fff',padding:'16px 20px',borderBottom:'0.5px solid rgba(0,0,0,.08)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:'#1a1a1a',letterSpacing:.5}}>{t('adv.pdf.preview')}</div>
            <div style={{fontSize:9,color:'#888',fontFamily:'monospace'}}>FinanceOS Pro</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
            {[
              {l:t('adv.pdf.income'),    v:fmtMoney(mIncome, sym), c:'#1a6b4a'},
              {l:t('adv.pdf.expense'),      v:fmtMoney(mExpense, sym), c:'#e05a4a'},
              {l:t('adv.pdf.savingRate'),  v:fmtPct(mIncome>0?(mIncome-mExpense)/mIncome:0), c:'#1a6b4a'},
            ].map((item,i) => (
              <div key={i} style={{background:'#f8f9fa',borderRadius:6,padding:'8px 10px',minWidth:0,overflow:'hidden'}}>
                <div style={{fontSize:8,color:'#888',marginBottom:2,textTransform:'uppercase',letterSpacing:.5}}>{item.l}</div>
                <div style={{fontSize: String(item.v).length>11?11:13,fontWeight:700,color:item.c,fontFamily:'monospace',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.v}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {t('adv.pdf.chips').split('|').map((chip,i) => (
              <span key={i} style={{fontSize:9,padding:'2px 8px',borderRadius:10,background:'rgba(26,107,74,.08)',color:'#1a6b4a',fontFamily:'monospace'}}>{chip}</span>
            ))}
          </div>
        </div>
        {/* CTA */}
        <div style={{padding:'14px 20px',background:'var(--grn-bg)',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:'var(--tx)',marginBottom:2}}>{t('adv.pdf.ctaTitle')}</div>
            <div style={{fontSize:11,color:'var(--th)',fontFamily:'var(--mono)'}}>{t('adv.pdf.ctaSub')}</div>
            {pdfError && <div style={{fontSize:11,color:'#e05a4a',fontFamily:'var(--mono)',marginTop:4}}>{pdfError}</div>}
          </div>
          <button
            onClick={handleExportPDF}
            disabled={pdfLoading || noData}
            style={{background:pdfLoading?'var(--sur)':'var(--grn)',color:pdfLoading?'var(--th)':'#fff',border:'none',borderRadius:6,padding:'10px 20px',fontSize:12,fontWeight:600,cursor:pdfLoading||noData?'not-allowed':'pointer',fontFamily:'var(--syne, sans-serif)',flexShrink:0,opacity:noData?0.5:1,transition:'all .15s'}}
          >
            {pdfLoading ? t('adv.pdf.generating') : t('adv.pdf.export')}
          </button>
        </div>
      </div>

      {/* ── SECCIÓN SUSCRIPCIONES EN MODO ASESOR ── */}
      {subCount > 0 && (
        <div style={{ background: 'var(--sur)', border: '.5px solid var(--brd)', borderRadius: 'var(--r)', padding: '16px', marginBottom: 0 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 2 }}>
            {t('adv.subs.title')}
          </div>
          <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--th)', marginBottom: 10 }}>
            {t('adv.subs.note')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8, marginBottom: 12 }}>
            {[
              { label: t('adv.subs.monthly'), value: `${sym}${subMonthly.toLocaleString(moneyLocale(), {maximumFractionDigits:0})}` },
              { label: t('adv.subs.annual'),   value: `${sym}${subAnnual.toLocaleString(moneyLocale(), {maximumFractionDigits:0})}` },
              { label: t('adv.subs.active'),       value: `${activeSubs.length}` },
              { label: t('adv.subs.pctIncome'), value: mIncome > 0 ? `${(subPct*100).toFixed(1)}%` : '—' },
            ].map(m => (
              <div key={m.label} style={{ background: 'var(--sur2)', borderRadius: 6, padding: '8px 10px', border: '.5px solid var(--brd)' }}>
                <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--th)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.5px' }}>{m.label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--tx)' }}>{m.value}</div>
              </div>
            ))}
          </div>
          {/* Alertas de suscripciones */}
          {subAlerts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {subAlerts.map((a, i) => (
                <div key={i} style={{ fontSize: 11, fontFamily: 'var(--mono)', color: a.type === 'duplicate' ? 'var(--amb)' : a.type === 'income' ? 'var(--amb)' : 'var(--th)', background: 'var(--sur2)', padding: '6px 10px', borderRadius: 6, borderLeft: `2px solid ${a.type === 'duplicate' || a.type === 'income' ? 'var(--amb)' : 'var(--brd)'}` }}>
                  {a.msg}
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--th)', marginTop: 10 }}>
            {t('adv.subs.disclaimer')}
          </div>
        </div>
      )}

      <FinancialDisclaimer />
    </div>
    </ProGate>
  )
}
