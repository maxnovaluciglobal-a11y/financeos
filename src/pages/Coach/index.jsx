// src/pages/Coach/index.jsx
// FinanceOS Coach — Motor de señales orientativas local
// Sin IA externa · Sin backend · 100% offline
// Las sugerencias son orientativas y no constituyen asesoría financiera.

import { useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { evaluateCoach, calcCoachMetrics, COACH_CONFIG } from '../../data/coachRules.js'
import useSubscriptionMetrics from '../../hooks/useSubscriptionMetrics.js'
import { scoreLevel, SCORE_LEVELS } from '../../utils/financialScore.js'
import { ScoreState, ScoreStateIcon } from '../../components/ScoreState.jsx'
import SignalIcon, { InlineIcon } from '../../components/icons/SignalIcon.jsx'

// ── ICONO POR SEVERIDAD ────────────────────────────────────────────────────
// Íconos por severidad (T17): antes glifos ◈ ⚠ ⊗; ahora el mismo vocabulario de
// forma que el estado del IQ Score.
const SEV_ICON  = { info: 'info', attention: 'attention', warning: 'warning' }
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
        <SignalIcon kind={SEV_ICON[signal.severity]} size={14} color={color} />
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
            padding: '5px 11px', borderRadius: 'var(--rs)', fontSize: 11,
            background: 'var(--sur2)', border: `.5px solid ${color}40`,
            color: 'var(--tm)', fontFamily: 'var(--mono)',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <SignalIcon kind={SEV_ICON[dominant]} size={12} color={color} />
            {cat}
          </div>
        )
      })}
    </div>
  )
}

// ── KPI BAR ────────────────────────────────────────────────────────────────
// level: 'ok' | 'attention' | 'risk' (misma escala que el IQ Score, D3). El
// ícono junto al valor hace que el estado no dependa solo del color de la barra.
function KpiBar({ label, value, pct, level }) {
  const { t } = useT()
  const color = SCORE_LEVELS[level]?.color
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: 'var(--tm)', fontFamily: 'var(--mono)' }}>{label}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: color || 'var(--tx)', fontFamily: 'var(--mono)' }}>
          {level && <ScoreStateIcon level={level} size={13} />}
          {value}
          {level && <span className="sr-only">{t(SCORE_LEVELS[level].key)}</span>}
        </span>
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
  const fmtP = n => ((n || 0) * 100).toFixed(1) + '%'

  // Score orientativo 0-100 — misma escala de 3 estados que el IQ Score (D3):
  // Bien ≥70 · Atención 40–69 · Riesgo <40 (antes tenía sus propios cortes 80/60).
  const score = Math.max(0, 100 - warnings.length * 20 - attentions.length * 8)
  const level = scoreLevel(score)
  const scoreColor = SCORE_LEVELS[level].color
  // Umbrales de cada KPI → nivel (los mismos cortes de color que ya tenía cada barra)
  const lvl3 = (good, mid) => good ? 'ok' : mid ? 'attention' : 'risk'

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
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--th)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('coach.score.label')}</div>
          <div style={{ fontSize: 42, fontWeight: 800, color: scoreColor, fontFamily: 'var(--mono)', lineHeight: 1, letterSpacing: '-2px' }}>
            {score}
          </div>
          <div style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--mono)', marginTop: 2 }}>/100</div>
          <ScoreState level={level} label={t(SCORE_LEVELS[level].key)} size={14} style={{ fontSize: 13, marginTop: 6, justifyContent: 'center' }} />
          <div style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--mono)', marginTop: 3, lineHeight: 1.4, textAlign: 'center' }}>{t('coach.score.note')}</div>
        </div>

        {/* KPIs */}
        <div>
          <KpiBar
            label={t('coach.kpi.savingRate')}
            value={fmtP(metrics.savingsRate)}
            pct={Math.max(0, metrics.savingsRate)}
            level={lvl3(metrics.savingsRate >= 0.20, metrics.savingsRate >= 0.10)}
          />
          <KpiBar
            label={t('coach.kpi.subsRatio')}
            value={fmtP(metrics.subscriptionRatio)}
            pct={metrics.subscriptionRatio}
            level={lvl3(metrics.subscriptionRatio < 0.07, metrics.subscriptionRatio < 0.12)}
          />
          <KpiBar
            label={t('coach.kpi.debtLoad')}
            value={fmtP(metrics.debtLoad)}
            pct={metrics.debtLoad}
            level={lvl3(metrics.debtLoad < 0.30, metrics.debtLoad < 0.50)}
          />
          {metrics.monthlyExpense > 0 && (
            <KpiBar
              label={t('coach.kpi.emergency')}
              value={t('coach.kpi.months', { n: metrics.emergencyFundMonths.toFixed(1) })}
              pct={metrics.emergencyFundMonths / 3}
              level={lvl3(metrics.emergencyFundMonths >= 3, metrics.emergencyFundMonths >= 1)}
            />
          )}
        </div>
      </div>

      {/* Resumen de señales */}
      {signals.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {warnings.length > 0 && (
            <div style={{ padding: '6px 12px', background: 'var(--red-bg, #fdf0ee)', border: '.5px solid var(--red)', borderRadius: 'var(--rs)', fontSize: 12, color: 'var(--red)', fontFamily: 'var(--mono)' }}>
              <InlineIcon kind="warning" size={13} />{t('coach.badge.review', { n: warnings.length })}
            </div>
          )}
          {attentions.length > 0 && (
            <div style={{ padding: '6px 12px', background: 'var(--amb-bg, #faeeda)', border: '.5px solid var(--amb)', borderRadius: 'var(--rs)', fontSize: 12, color: 'var(--amb)', fontFamily: 'var(--mono)' }}>
              <InlineIcon kind="attention" size={13} />{t('coach.badge.attention', { n: attentions.length })}
            </div>
          )}
          {infos.length > 0 && (
            <div style={{ padding: '6px 12px', background: 'var(--grn-bg)', border: '.5px solid var(--grn)', borderRadius: 'var(--rs)', fontSize: 12, color: 'var(--grn)', fontFamily: 'var(--mono)' }}>
              <InlineIcon kind="info" size={13} />{t('coach.badge.info', { n: infos.length })}
            </div>
          )}
        </div>
      )}

      {/* Categorías activas */}
      {signals.length > 0 && <CategorySummary signals={signals} />}

      {/* Señales por prioridad */}
      {signals.length === 0 ? (
        <div style={{ background: 'var(--sur)', border: '.5px solid var(--brd)', borderRadius: 'var(--r)', padding: '28px', textAlign: 'center' }}>
          <div style={{ marginBottom: 8, color: 'var(--pos)', display: 'flex', justifyContent: 'center' }}><SignalIcon kind="ok" size={22} /></div>
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
                <InlineIcon kind="warning" size={12} />{t('coach.section.review')}
              </div>
              {warnings.map(s => <SignalCard key={s.id} signal={s} />)}
            </div>
          )}
          {attentions.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--amb)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                <InlineIcon kind="attention" size={12} />{t('coach.section.attention')}
              </div>
              {attentions.map(s => <SignalCard key={s.id} signal={s} />)}
            </div>
          )}
          {infos.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--grn)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                <InlineIcon kind="info" size={12} />{t('coach.section.info')}
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
