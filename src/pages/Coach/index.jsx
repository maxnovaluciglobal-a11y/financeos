// src/pages/Coach/index.jsx
// FinanceOS Coach — Motor de señales orientativas local
// Sin IA externa · Sin backend · 100% offline
// Las sugerencias son orientativas y no constituyen asesoría financiera.

import { useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { evaluateCoach, calcCoachMetrics, COACH_CONFIG } from '../../data/coachRules.js'
import useSubscriptionMetrics from '../../hooks/useSubscriptionMetrics.js'
import { moneyLocale } from '../../utils/index.js'

// ── ICONO POR SEVERIDAD ────────────────────────────────────────────────────
const SEV_ICON  = { info: '◈', attention: '⚠', warning: '⊗' }
// keys de traducción
const SEV_LABEL = { info: 'coach.sev.info', attention: 'coach.sev.attention', warning: 'coach.sev.warning' }

// ── TARJETA DE SEÑAL ───────────────────────────────────────────────────────
function SignalCard({ signal }) {
  const { t } = useT()
  const color = COACH_CONFIG.severityColors[signal.severity] || 'var(--th)'
  return (
    <div style={{
      background: 'var(--sur)', border: `.5px solid color-mix(in srgb, ${color} 35%, transparent)`,
      borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ color, fontSize: 13 }}>{SEV_ICON[signal.severity]}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          {t(SEV_LABEL[signal.severity])}
        </span>
        <span style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', marginLeft: 'auto' }}>
          {signal.category}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)', marginBottom: 4 }}>
        {signal.title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--tm)', lineHeight: 1.6 }}>
        {signal.msg}
      </div>
      {signal.action && (
        <div style={{
          marginTop: 8, fontSize: 11, fontFamily: 'var(--mono)',
          color: 'var(--grn)', background: 'var(--grn-bg)',
          padding: '5px 9px', borderRadius: 6,
          borderLeft: '2px solid var(--grn)',
        }}>
          → {signal.action}
        </div>
      )}
    </div>
  )
}

// ── RESUMEN DE CATEGORÍA ───────────────────────────────────────────────────
function CategorySummary({ signals }) {
  const cats = {}
  signals.forEach(s => {
    if (!cats[s.category]) cats[s.category] = { info: 0, attention: 0, warning: 0 }
    cats[s.category][s.severity]++
  })

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
      {Object.entries(cats).map(([cat, counts]) => {
        const dominant = counts.warning > 0 ? 'warning' : counts.attention > 0 ? 'attention' : 'info'
        const color = COACH_CONFIG.severityColors[dominant]
        return (
          <div key={cat} style={{
            padding: '5px 11px', borderRadius: 20, fontSize: 11,
            background: 'var(--sur2)', border: `.5px solid ${color}40`,
            color: 'var(--tm)', fontFamily: 'var(--mono)',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{ color, fontSize: 10 }}>{SEV_ICON[dominant]}</span>
            {cat}
          </div>
        )
      })}
    </div>
  )
}

// ── KPI BAR ────────────────────────────────────────────────────────────────
function KpiBar({ label, value, pct, color }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: 'var(--tm)', fontFamily: 'var(--mono)' }}>{label}</span>
        <span style={{ fontWeight: 600, color: color || 'var(--tx)', fontFamily: 'var(--mono)' }}>{value}</span>
      </div>
      <div style={{ height: 4, background: 'var(--sur2)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: '100%', transform: `scaleX(${Math.min(pct, 1)})`, transformOrigin: 'left', background: color || 'var(--grn)', borderRadius: 2, transition: 'transform .4s' }} />
      </div>
    </div>
  )
}

// ── COMPONENTE PRINCIPAL ───────────────────────────────────────────────────
export default function Coach() {
  const { t } = useT()
  const { incomes: _incAll, expenses: _expAll, budgets, debts, goals, settings } = useApp()
  const incomes = (_incAll || []).filter(r => !r?.inv)   // panorama personal: excluye inversión
  const expenses = (_expAll || []).filter(r => !r?.inv)
  const { subs } = useSubscriptionMetrics()

  const metrics = useMemo(() =>
    calcCoachMetrics({ incomes, expenses, budgets, debts, goals, subs, settings }),
    [incomes, expenses, budgets, debts, goals, subs, settings]
  )

  const signals = useMemo(() => evaluateCoach(metrics, t), [metrics, settings.language])

  const warnings    = signals.filter(s => s.severity === 'warning')
  const attentions  = signals.filter(s => s.severity === 'attention')
  const infos       = signals.filter(s => s.severity === 'info')

  const sym = metrics.sym
  const fmtN = n => (n || 0).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })
  const fmtP = n => ((n || 0) * 100).toFixed(1) + '%'

  // Score orientativo 0-100
  const score = Math.max(0, 100 - warnings.length * 20 - attentions.length * 8)
  const scoreColor = score >= 80 ? 'var(--grn)' : score >= 60 ? 'var(--amb)' : 'var(--red)'
  const scoreLabel = score >= 80 ? t('coach.score.few') : score >= 60 ? t('coach.score.some') : t('coach.score.many')

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--grn)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>
          {t('coach.kicker')}
        </div>
        <h1 className="display" style={{ fontSize: 24, fontWeight: 700, color: 'var(--tx)', marginBottom: 4 }}>
          {t('coach.title')}
        </h1>
        <p style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--mono)', marginBottom: 4 }}>
          {t('coach.sub', { month: metrics.activeMonth })}
          <span style={{display:'block',fontSize:10,color:'var(--th)',marginTop:4,fontFamily:'var(--mono)'}}>
            {t('coach.disclaimerShort')}
          </span>
        </p>
        <p style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', background: 'var(--sur2)', padding: '5px 9px', borderRadius: 6, display: 'inline-block' }}>
          {t('coach.localBadge')}
        </p>
      </div>

      {/* Score + KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, background: 'var(--sur)', border: '.5px solid var(--brd)', borderRadius: 'var(--r)', padding: '16px', marginBottom: 20, alignItems: 'center' }}>
        {/* Score circle */}
        <div style={{ textAlign: 'center', padding: '0 12px' }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: scoreColor, fontFamily: 'var(--mono)', lineHeight: 1, letterSpacing: '-2px' }}>
            {score}
          </div>
          <div style={{ fontSize: 9, color: 'var(--th)', fontFamily: 'var(--mono)', marginTop: 2 }}>/100</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: scoreColor, marginTop: 4 }}>{scoreLabel}</div>
          <div style={{ fontSize: 9, color: 'var(--th)', fontFamily: 'var(--mono)', marginTop: 3, lineHeight: 1.4, textAlign: 'center' }}>{t('coach.score.note')}</div>
        </div>

        {/* KPIs */}
        <div>
          <KpiBar
            label={t('coach.kpi.savingRate')}
            value={fmtP(metrics.savingsRate)}
            pct={Math.max(0, metrics.savingsRate)}
            color={metrics.savingsRate >= 0.20 ? 'var(--grn)' : metrics.savingsRate >= 0.10 ? 'var(--amb)' : 'var(--red)'}
          />
          <KpiBar
            label={t('coach.kpi.subsRatio')}
            value={fmtP(metrics.subscriptionRatio)}
            pct={metrics.subscriptionRatio}
            color={metrics.subscriptionRatio < 0.07 ? 'var(--grn)' : metrics.subscriptionRatio < 0.12 ? 'var(--amb)' : 'var(--red)'}
          />
          <KpiBar
            label={t('coach.kpi.debtLoad')}
            value={fmtP(metrics.debtLoad)}
            pct={metrics.debtLoad}
            color={metrics.debtLoad < 0.30 ? 'var(--grn)' : metrics.debtLoad < 0.50 ? 'var(--amb)' : 'var(--red)'}
          />
          {metrics.monthlyExpense > 0 && (
            <KpiBar
              label={t('coach.kpi.emergency')}
              value={t('coach.kpi.months', { n: metrics.emergencyFundMonths.toFixed(1) })}
              pct={metrics.emergencyFundMonths / 3}
              color={metrics.emergencyFundMonths >= 3 ? 'var(--grn)' : metrics.emergencyFundMonths >= 1 ? 'var(--amb)' : 'var(--red)'}
            />
          )}
        </div>
      </div>

      {/* Resumen de señales */}
      {signals.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {warnings.length > 0 && (
            <div style={{ padding: '6px 12px', background: 'var(--red-bg, #fdf0ee)', border: '.5px solid var(--red)', borderRadius: 20, fontSize: 11, color: 'var(--red)', fontFamily: 'var(--mono)' }}>
              {t('coach.badge.review', { n: warnings.length })}
            </div>
          )}
          {attentions.length > 0 && (
            <div style={{ padding: '6px 12px', background: 'var(--amb-bg, #faeeda)', border: '.5px solid var(--amb)', borderRadius: 20, fontSize: 11, color: 'var(--amb)', fontFamily: 'var(--mono)' }}>
              {t('coach.badge.attention', { n: attentions.length })}
            </div>
          )}
          {infos.length > 0 && (
            <div style={{ padding: '6px 12px', background: 'var(--grn-bg)', border: '.5px solid var(--grn)', borderRadius: 20, fontSize: 11, color: 'var(--grn)', fontFamily: 'var(--mono)' }}>
              {t('coach.badge.info', { n: infos.length })}
            </div>
          )}
        </div>
      )}

      {/* Categorías activas */}
      {signals.length > 0 && <CategorySummary signals={signals} />}

      {/* Señales por prioridad */}
      {signals.length === 0 ? (
        <div style={{ background: 'var(--sur)', border: '.5px solid var(--brd)', borderRadius: 'var(--r)', padding: '28px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>◈</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)', marginBottom: 4 }}>{t('coach.empty.title')}</div>
          <div style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--mono)' }}>
            {t('coach.empty.sub')}
          </div>
        </div>
      ) : (
        <>
          {warnings.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                {t('coach.section.review')}
              </div>
              {warnings.map(s => <SignalCard key={s.id} signal={s} />)}
            </div>
          )}
          {attentions.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--amb)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                {t('coach.section.attention')}
              </div>
              {attentions.map(s => <SignalCard key={s.id} signal={s} />)}
            </div>
          )}
          {infos.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--grn)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                {t('coach.section.info')}
              </div>
              {infos.map(s => <SignalCard key={s.id} signal={s} />)}
            </div>
          )}
        </>
      )}

      {/* Checklist mensual */}
      {signals.length >= 0 && (() => {
        const items = [
          { done: (incomes.filter(r => r?.date?.startsWith(settings?.activeMonth || '')).length > 0), label: t('coach.check.incomes') },
          { done: (expenses.filter(r => r?.date?.startsWith(settings?.activeMonth || '')).length > 0), label: t('coach.check.expenses') },
          { done: (budgets.length > 0), label: t('coach.check.budget') },
          { done: (goals.length > 0), label: t('coach.check.goal') },
          { done: (signals.filter(s => s.severity === 'warning').length === 0), label: t('coach.check.noWarnings') },
        ]
        const doneCount = items.filter(i => i.done).length
        return (
          <div style={{ background: 'var(--sur)', border: '.5px solid var(--brd)', borderRadius: 'var(--r)', padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--th)', textTransform: 'uppercase', letterSpacing: '.8px' }}>{t('coach.check.title')}</div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: doneCount === items.length ? 'var(--accent)' : 'var(--th)' }}>{doneCount}/{items.length}</span>
            </div>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < items.length - 1 ? '.5px solid var(--brd)' : 'none' }}>
                <span style={{ fontSize: 13, color: it.done ? 'var(--accent)' : 'var(--brd2)', flexShrink: 0 }}>{it.done ? '✓' : '○'}</span>
                <span style={{ fontSize: 12, color: it.done ? 'var(--tx)' : 'var(--th)' }}>{it.label}</span>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Disclaimer completo al pie */}
      <div style={{ padding: '10px 12px', background: 'var(--sur2)', border: '.5px solid var(--brd)', borderRadius: 'var(--r)', fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', lineHeight: 1.6, marginTop: 8 }}>
        {t('coach.disclaimerFull')}
      </div>
    </div>
  )
}

// ── EXPORT HOOK PARA INTEGRACIÓN ──────────────────────────────────────────
export function useCoachSignals() {
  const { t } = useT()
  const { incomes: _incAll, expenses: _expAll, budgets, debts, goals, settings } = useApp()
  const incomes = (_incAll || []).filter(r => !r?.inv)   // panorama personal: excluye inversión
  const expenses = (_expAll || []).filter(r => !r?.inv)
  const { subs } = useSubscriptionMetrics()
  const metrics = useMemo(() =>
    calcCoachMetrics({ incomes, expenses, budgets, debts, goals, subs, settings }),
    [incomes, expenses, budgets, debts, goals, subs, settings]
  )
  const signals = useMemo(() => evaluateCoach(metrics, t), [metrics, settings.language])
  return { signals, metrics }
}
