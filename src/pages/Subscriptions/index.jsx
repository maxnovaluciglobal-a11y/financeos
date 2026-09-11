// src/pages/Subscriptions/index.jsx
// Módulo de suscripciones y gastos recurrentes — FinanceOS v1.4
// Sin backend · Sin scraping · 100% local

import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { dbGetAll, dbAdd, dbDelete } from '../../core/db/index.js'
import { uid, subEmoji, subLabel, moneyLocale, dateLocale } from '../../utils/index.js'
import ChartCard from '../../components/charts/ChartCard.jsx'
import HorizontalBars from '../../components/charts/HorizontalBars.jsx'
import CategoryDonut from '../../components/charts/CategoryDonut.jsx'

// ── CONSTANTES ──────────────────────────────────────────────────────────────────
export const SUB_CATEGORIES = [
  'Streaming', 'Música', 'Productividad', 'Almacenamiento',
  'Software', 'Educación', 'Salud / Gimnasio', 'Seguros',
  'Telefonía / Internet', 'Otros',
]

export const FREQ_LABELS = {
  weekly:    'Semanal',
  monthly:   'Mensual',
  quarterly: 'Trimestral',
  annual:    'Anual',
}

// ── CÁLCULOS ────────────────────────────────────────────────────────────────────
export function toMonthly(amount, frequency) {
  switch (frequency) {
    case 'weekly':    return amount * 4.33
    case 'monthly':   return amount
    case 'quarterly': return amount / 3
    case 'annual':    return amount / 12
    default:          return amount
  }
}

export function toAnnual(amount, frequency) {
  switch (frequency) {
    case 'weekly':    return amount * 52
    case 'monthly':   return amount * 12
    case 'quarterly': return amount * 4
    case 'annual':    return amount
    default:          return amount * 12
  }
}

export function generateAlerts(subs, monthlyIncome, t = null) {
  const tr = (key, vars, fallback) => (t ? t(key, vars) : fallback)
  const alerts = []
  const active = Array.isArray(subs) ? subs.filter(s => s.status === 'active') : []

  // Duplicados por categoría
  const byCat = {}
  active.forEach(s => {
    byCat[s.category] = (byCat[s.category] || [])
    byCat[s.category].push(s)
  })
  Object.entries(byCat).forEach(([cat, items]) => {
    if (items.length >= 2) {
      alerts.push({
        type: 'duplicate',
        msg: tr('subs.alert.duplicate', { n: items.length, cat }, `Tienes ${items.length} suscripciones en "${cat}". Revisa si todas son necesarias.`),
      })
    }
  })

  // % del ingreso
  if (monthlyIncome > 0) {
    const totalMonthly = active.reduce((s, sub) => s + toMonthly(sub.amount, sub.frequency), 0)
    const pct = (totalMonthly / monthlyIncome) * 100
    if (pct > 15) {
      alerts.push({
        type: 'income',
        msg: tr('subs.alert.income', { pct: pct.toFixed(1) }, `Tus suscripciones representan el ${pct.toFixed(1)}% de tus ingresos mensuales.`),
      })
    }
  }

  // Sin fecha de próximo pago
  const noDate = active.filter(s => !s.nextPaymentDate)
  if (noDate.length > 0) {
    alerts.push({
      type: 'missing',
      msg: tr('subs.alert.missing', { n: noDate.length }, `${noDate.length} suscripción${noDate.length > 1 ? 'es' : ''} sin fecha de próximo pago registrada.`),
    })
  }

  // Subió de precio desde el último cambio registrado (ver priceHistory en save())
  active.forEach(s => {
    const hist = Array.isArray(s.priceHistory) ? s.priceHistory : []
    if (hist.length === 0) return
    const last = hist[hist.length - 1]
    const prevAmt = Number(last.amount) || 0
    const curAmt = Number(s.amount) || 0
    if (prevAmt > 0 && curAmt > prevAmt) {
      const pct = ((curAmt - prevAmt) / prevAmt) * 100
      alerts.push({
        type: 'priceIncrease',
        msg: tr('subs.alert.priceIncrease', { name: s.name, pct: pct.toFixed(0) }, `"${s.name}" subió ${pct.toFixed(0)}% desde el último registro.`),
      })
    }
  })

  // Próximo pago en los próximos 7 días
  const today = new Date()
  const in7   = new Date(today); in7.setDate(today.getDate() + 7)
  const upcoming = active.filter(s => {
    if (!s.nextPaymentDate) return false
    const d = new Date(s.nextPaymentDate)
    return d >= today && d <= in7
  })
  upcoming.forEach(s => {
    alerts.push({
      type: 'upcoming',
      msg: tr('subs.alert.upcoming', { name: s.name, date: new Date(s.nextPaymentDate).toLocaleDateString(dateLocale()) }, `"${s.name}" tiene un pago próximo el ${new Date(s.nextPaymentDate).toLocaleDateString(dateLocale())}.`),
    })
  })

  return alerts
}

// ── FORM vacío ──────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  name: '', category: 'Streaming', amount: '', currency: '',
  frequency: 'monthly', nextPaymentDate: '', paymentMethod: '',
  status: 'active', notes: '',
}

// ── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────────
export default function Subscriptions() {
  const { t } = useT()
  const { settings, incomes, subscriptions: ctxSubs, addSubscription, updateSubscription, deleteSubscription, deleteWithUndo, showToast } = useApp()
  const currency = settings.currency || 'CLP'
  const fmt = n => (n || 0).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })
  const isDemo = !!settings.isDemo

  const [dbSubs,   setDbSubs]  = useState([])
  const [loading,  setLoading] = useState(!isDemo)
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState(null)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [filter,   setFilter]   = useState('all')

  const subs = isDemo ? (ctxSubs || []) : dbSubs

  const monthlyIncome = useMemo(() => {
    if (!Array.isArray(incomes)) return 0
    const month = settings.activeMonth || new Date().toISOString().slice(0, 7)
    return incomes
      .filter(r => r.date?.startsWith(month))
      .reduce((s, r) => s + (r.amount || 0), 0)
  }, [incomes, settings.activeMonth])

  useEffect(() => {
    if (isDemo) return
    dbGetAll('subscriptions').then(data => {
      setDbSubs(data || [])
      setLoading(false)
    })
  }, [isDemo])

  const activeSubs    = subs.filter(s => s.status === 'active')
  const totalMonthly  = activeSubs.reduce((s, sub) => s + toMonthly(sub.amount, sub.frequency), 0)
  const totalAnnual   = activeSubs.reduce((s, sub) => s + toAnnual(sub.amount, sub.frequency), 0)
  const mostExpensive = activeSubs.length
    ? activeSubs.reduce((a, b) => toMonthly(a.amount, a.frequency) > toMonthly(b.amount, b.frequency) ? a : b)
    : null
  const nextSub = activeSubs
    .filter(s => s.nextPaymentDate)
    .sort((a, b) => new Date(a.nextPaymentDate) - new Date(b.nextPaymentDate))[0]
  const alerts = useMemo(() => generateAlerts(subs, monthlyIncome, t), [subs, monthlyIncome, settings.language])

  // Datos para gráficos
  // El "top" muestra el NOMBRE del servicio; el emoji viene de su categoría.
  const topRecords = useMemo(() =>
    activeSubs.map(s => ({
      category: [subEmoji(s.category), s.name].filter(Boolean).join(' '),
      amount: toMonthly(s.amount, s.frequency),
    })),
    [activeSubs]
  )

  const catRecords = useMemo(() =>
    activeSubs.map(s => ({
      category: subLabel(s.category) || 'Sin categoría',
      amount: toMonthly(s.amount, s.frequency),
    })),
    [activeSubs]
  )

  // CRUD
  async function save() {
    if (!form.name.trim() || !form.amount) return
    const now  = new Date().toISOString()
    const newAmount = parseFloat(form.amount) || 0
    // Guardamos el monto viejo antes de pisarlo — sin esto no hay forma de
    // detectar que una suscripción subió de precio (ver generateAlerts).
    const prev = editing ? dbSubs.find(s => s.id === editing) : null
    const priceHistory = prev && Number(prev.amount) !== newAmount
      ? [...(prev.priceHistory || []), { amount: Number(prev.amount) || 0, at: prev.updatedAt || prev.createdAt || now }].slice(-12)
      : (prev?.priceHistory || [])
    const item = {
      ...form,
      id:        editing || uid(),
      amount:    newAmount,
      currency:  form.currency || currency,
      createdAt: editing ? (prev?.createdAt || now) : now,
      updatedAt: now,
      status:    form.status || 'active',
      priceHistory,
    }
    if (isDemo) {
      setDbSubs(prev => editing
        ? prev.map(s => s.id === editing ? item : s)
        : [...prev, item]
      )
    } else {
      if (editing) {
        await updateSubscription(item)
        setDbSubs(prev => prev.map(s => s.id === editing ? item : s))
      } else {
        await addSubscription(item)
        setDbSubs(prev => [...prev, item])
      }
    }
    closeForm()
  }

  async function remove(id) {
    const sub = dbSubs.find(s => s.id === id)
    if (!sub) return
    setDbSubs(prev => prev.filter(s => s.id !== id))
    if (!isDemo) { try { await deleteSubscription(id) } catch {} }
    showToast(t('common.deleted'), 'ok', {
      label: t('common.undo'),
      onAction: async () => {
        setDbSubs(prev => prev.some(s => s.id === sub.id) ? prev : [...prev, sub])
        if (!isDemo) { try { await dbAdd('subscriptions', sub) } catch {} }
      },
    })
  }

  async function toggleStatus(sub) {
    const updated = { ...sub, status: sub.status === 'active' ? 'inactive' : 'active', updatedAt: new Date().toISOString() }
    if (!isDemo) await dbAdd('subscriptions', updated)
    setDbSubs(prev => prev.map(s => s.id === updated.id ? updated : s))
  }

  function openEdit(sub) {
    setEditing(sub.id)
    setForm({ ...sub, amount: String(sub.amount) })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  const displayed = filter === 'all' ? subs
    : filter === 'active' ? activeSubs
    : subs.filter(s => s.status === 'inactive')

  if (loading) return <div style={{ padding: 24, color: 'var(--th)', fontFamily: 'var(--mono)', fontSize: 12 }}>{t('subs.loading')}</div>

  return (
    <div>
      {/* HEADER */}
      <div style={{ marginBottom: 20 }}>
        <h2 className="display" style={{ fontSize: 24, fontWeight: 700, color: 'var(--tx)', marginBottom: 3 }}>
          {t('subs.title')}
        </h2>
        <p style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)' }}>
          {t('subs.sub')}
        </p>
      </div>

      {/* KPIs */}
      <div className="kpi-row" style={{ marginBottom: 16 }}>
        {[
          { label: t('subs.kpi.monthly'), value: `${currency} ${fmt(totalMonthly)}`,  color: 'var(--grn)' },
          { label: t('subs.kpi.annual'),   value: `${currency} ${fmt(totalAnnual)}`,   color: 'var(--tx)' },
          { label: t('subs.kpi.active'),       value: activeSubs.length,                   color: 'var(--tx)' },
          { label: t('subs.kpi.mostExpensive'),   value: mostExpensive ? mostExpensive.name : '—', color: 'var(--amb)' },
          { label: t('subs.kpi.nextPay'),  value: nextSub ? new Date(nextSub.nextPaymentDate).toLocaleDateString(dateLocale()) : '—', color: 'var(--tx)' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--sur)', border: '.5px solid var(--brd)', borderRadius: 'var(--rl)', padding: '14px 16px', boxShadow: 'var(--sh-1)' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--th)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: k.color, fontFamily: 'var(--display)', letterSpacing: '-.01em', fontFeatureSettings: "'tnum' 1", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* VISUAL INSIGHTS */}
      {activeSubs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <ChartCard title={t('subs.chart.top')} minHeight={160}>
            <HorizontalBars records={topRecords} sym={`${currency} `} maxItems={6} />
          </ChartCard>
          <ChartCard title={t('subs.chart.byCat')} minHeight={160}>
            <CategoryDonut records={catRecords} sym={`${currency} `} maxCategories={6} />
          </ChartCard>
        </div>
      )}

      {/* ALERTAS */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {alerts.map((a, i) => (
            <div key={i} style={{
              padding: '9px 12px', borderRadius: 'var(--r)', fontSize: 11,
              fontFamily: 'var(--mono)', lineHeight: 1.5,
              background: a.type === 'duplicate' || a.type === 'priceIncrease' ? 'var(--amb-bg)' : a.type === 'upcoming' ? 'var(--grn-bg)' : 'var(--sur2)',
              border: `.5px solid ${a.type === 'duplicate' || a.type === 'priceIncrease' ? 'var(--amb)' : a.type === 'upcoming' ? 'var(--grn)' : 'var(--brd)'}`,
              color: a.type === 'duplicate' || a.type === 'priceIncrease' ? 'var(--amb)' : a.type === 'upcoming' ? 'var(--grn)' : 'var(--tm)',
            }}>
              {a.type === 'duplicate' || a.type === 'priceIncrease' ? '⚠ ' : a.type === 'upcoming' ? '📅 ' : 'ℹ '}{a.msg}
            </div>
          ))}
        </div>
      )}

      {/* ACCIONES */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setShowForm(true)} style={{
          background: 'var(--laton)', color: 'var(--navy)', border: 'none', borderRadius: 'var(--r)',
          padding: '7px 14px', fontSize: 12, fontFamily: 'var(--sans)', fontWeight: 600, cursor: 'pointer',
        }}>{t('subs.addBtn')}</button>
        {['all', 'active', 'inactive'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? 'var(--sur2)' : 'transparent',
            border: `.5px solid ${filter === f ? 'var(--brd2)' : 'var(--brd)'}`,
            borderRadius: 'var(--r)', padding: '6px 12px', fontSize: 11,
            fontFamily: 'var(--mono)', cursor: 'pointer', color: filter === f ? 'var(--tx)' : 'var(--tm)',
          }}>{f === 'all' ? t('subs.filter.all') : f === 'active' ? t('subs.filter.active') : t('subs.filter.inactive')}</button>
        ))}
      </div>

      {/* FORM */}
      {showForm && (
        <div style={{ background: 'var(--sur)', border: '.5px solid var(--brd)', borderRadius: 'var(--r)', padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)', marginBottom: 12 }}>
            {editing ? t('subs.form.edit') : t('subs.form.new')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            {[
              { label: t('subs.form.name'), key: 'name', type: 'text', placeholder: t('subs.form.namePh') },
              { label: t('subs.form.amount'), key: 'amount', type: 'number', placeholder: '0' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{label}</div>
                <input type={type} value={form[key]} placeholder={placeholder}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  style={{ width: '100%', background: 'var(--sur2)', border: '.5px solid var(--brd2)', borderRadius: 6, padding: '7px 10px', color: 'var(--tx)', fontSize: 13, fontFamily: 'var(--mono)' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{t('subs.form.category')}</div>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                style={{ width: '100%', background: 'var(--sur2)', border: '.5px solid var(--brd2)', borderRadius: 6, padding: '7px 10px', color: 'var(--tx)', fontSize: 13, fontFamily: 'var(--mono)' }}>
                {SUB_CATEGORIES.map(c => <option key={c} value={c}>{subLabel(c)}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{t('subs.form.freq')}</div>
              <select value={form.frequency} onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))}
                style={{ width: '100%', background: 'var(--sur2)', border: '.5px solid var(--brd2)', borderRadius: 6, padding: '7px 10px', color: 'var(--tx)', fontSize: 13, fontFamily: 'var(--mono)' }}>
                {Object.keys(FREQ_LABELS).map(v => <option key={v} value={v}>{t('mov.freq.' + v)}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{t('subs.form.nextPay')}</div>
              <input type="date" value={form.nextPaymentDate} onChange={e => setForm(p => ({ ...p, nextPaymentDate: e.target.value }))}
                style={{ width: '100%', background: 'var(--sur2)', border: '.5px solid var(--brd2)', borderRadius: 6, padding: '7px 10px', color: 'var(--tx)', fontSize: 13, fontFamily: 'var(--mono)' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} style={{ background: 'var(--laton)', color: 'var(--navy)', border: 'none', borderRadius: 'var(--r)', padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {editing ? t('subs.form.saveChanges') : t('subs.form.submit')}
            </button>
            <button onClick={closeForm} style={{ background: 'var(--sur2)', color: 'var(--tx)', border: '.5px solid var(--brd2)', borderRadius: 'var(--r)', padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* LISTA vacía */}
      {displayed.length === 0 && (
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--th)', fontFamily: 'var(--mono)', marginBottom: 12 }}>
            {subs.length === 0 ? t('subs.empty.none') : t('subs.empty.filtered')}
          </div>
          {subs.length === 0 && (
            <button onClick={() => setShowForm(true)} style={{ background: 'var(--laton)', color: 'var(--navy)', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {t('subs.addBtn')}
            </button>
          )}
        </div>
      )}

      {/* TABLA */}
      {displayed.length > 0 && (
        <div style={{ background: 'var(--sur)', border: '.5px solid var(--brd)', borderRadius: 'var(--r)', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--sur2)', borderBottom: '.5px solid var(--brd)' }}>
                  {[t('subs.th.service'), t('subs.th.category'), t('subs.th.perMonth'), t('subs.th.perYear'), t('subs.th.freq'), t('subs.th.nextPay'), t('subs.th.status'), ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--th)', textTransform: 'uppercase', letterSpacing: '.8px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((sub, i) => {
                  const monthly  = toMonthly(sub.amount, sub.frequency)
                  const annual   = toAnnual(sub.amount, sub.frequency)
                  const isActive = sub.status === 'active'
                  return (
                    <tr key={sub.id} style={{ borderBottom: i < displayed.length - 1 ? '.5px solid var(--brd)' : 'none', opacity: isActive ? 1 : 0.5 }}>
                      <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: 'var(--tx)' }}>{sub.name}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', background: 'var(--sur2)', padding: '2px 7px', borderRadius: 20, color: 'var(--tm)', border: '.5px solid var(--brd)' }}>{subLabel(sub.category)}</span>
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--tx)' }}>{(sub.currency || currency)} {fmt(monthly)}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)' }}>{(sub.currency || currency)} {fmt(annual)}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)' }}>{FREQ_LABELS[sub.frequency] ? t('mov.freq.' + sub.frequency) : sub.frequency}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', whiteSpace: 'nowrap' }}>
                        {sub.nextPaymentDate ? new Date(sub.nextPaymentDate).toLocaleDateString(dateLocale()) : '—'}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <button onClick={() => toggleStatus(sub)} style={{
                          fontSize: 10, fontFamily: 'var(--mono)', padding: '2px 8px', borderRadius: 20, cursor: 'pointer',
                          background: isActive ? 'var(--grn-bg)' : 'var(--sur2)',
                          color: isActive ? 'var(--grn)' : 'var(--th)',
                          border: `.5px solid ${isActive ? 'var(--grn)' : 'var(--brd)'}`,
                        }}>{isActive ? t('subs.status.active') : t('subs.status.inactive')}</button>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => openEdit(sub)} style={{ background: 'none', border: 'none', color: 'var(--th)', fontSize: 11, cursor: 'pointer' }}>✎</button>
                          <button onClick={() => remove(sub.id)} aria-label={`Eliminar ${sub.name}`} title="Eliminar" style={{ background: 'none', border: 'none', color: 'var(--th)', fontSize: 11, cursor: 'pointer' }}><span aria-hidden="true">✕</span></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', lineHeight: 1.6 }}>
        {t('subs.disclaimer')}
      </div>
    </div>
  )
}
