// src/pages/Dashboard/ScoreCard.jsx — IQ Score en el Inicio (M5, pieza 5).
// Número + estado de 3 niveles (ícono + palabra, D3) + variación vs. el mes
// anterior (desde fos_score_history) + el siguiente paso sugerido: el factor más
// débil (weakestFactor) con un botón a la página donde se trabaja.
// El historial semanal vive acá (antes en Dashboard/index.jsx); las entradas
// nuevas guardan además la fecha local (d) para saber a qué mes pertenecen.
import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import CountUp from '../../components/CountUp.jsx'
import { IconIQScore } from '../../components/icons/Icons.jsx'
import { ScoreState, ScoreStateIcon } from '../../components/ScoreState.jsx'
import { SCORE_LEVELS, weakestFactor } from '../../utils/financialScore.js'
import { useT } from '../../i18n/useT.js'
import { localDateStr } from '../../utils/index.js'
import { FACTOR_PAGE, prevMonthScore, prevMonthOf } from './dashboardModel.js'
import DeltaLine from './DeltaLine.jsx'
import s from './Home.module.css'

const SCORE_KEY = 'fos_score_history'

function weekKey(d = new Date()) {
  const jan1 = new Date(d.getFullYear(), 0, 1)
  return `${d.getFullYear()}-W${Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)}`
}

function Sparkline({ history, color }) {
  if (history.length < 2) return null
  const vals = history.map(e => e.s)
  // Escala honesta: ventana MÍNIMA de 20 pts (un ±1 no se dibuja como montaña),
  // centrada en los datos y acotada al rango real del score [0,100].
  const dataMin = Math.min(...vals), dataMax = Math.max(...vals)
  const span = Math.max(dataMax - dataMin, 20)
  const mid = (dataMin + dataMax) / 2
  const min = Math.max(0, mid - span / 2)
  const max = Math.min(100, min + span) || 100
  const W = 72, H = 24
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - min) / (max - min)) * H}`)
  const [lx, ly] = pts[pts.length - 1].split(',')
  return (
    <svg width={W} height={H} style={{ overflow: 'visible', display: 'block' }} aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <circle cx={lx} cy={ly} r="2.5" fill={color} />
    </svg>
  )
}

export default function ScoreCard({ healthScore, activeMonth, isCurrentMonth, setPage, compact = false }) {
  const { t } = useT()
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SCORE_KEY) || '[]') } catch { return [] }
  })

  useEffect(() => {
    if (!healthScore) return
    const w = weekKey()
    setHistory(prev => {
      const existing = prev.find(e => e.w === w)
      if (existing && existing.s === healthScore.score && existing.d) return prev
      const next = [...prev.filter(e => e.w !== w), { w, s: healthScore.score, d: localDateStr() }]
        .sort((a, b) => a.w.localeCompare(b.w))
        .slice(-8)
      try { localStorage.setItem(SCORE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [healthScore?.score])

  if (!healthScore) return null

  // Variación vs. el último puntaje de un mes anterior. Solo en el mes en curso:
  // el historial es del calendario real, no del mes que se esté mirando.
  const prev = isCurrentMonth ? prevMonthScore(history, activeMonth) : null
  let delta = null, valueText
  if (prev && Number.isFinite(prev.v)) {
    const diff = healthScore.score - prev.v
    delta = diff === 0 ? { dir: 'flat', good: null } : { dir: diff > 0 ? 'up' : 'down', good: diff > 0 }
    valueText = t('home.score.pts', { n: `${diff > 0 ? '+' : '−'}${Math.abs(diff)}` })
  }

  // Vista esencial del Inicio (R05): una fila — número, estado y "›" al
  // Diagnóstico. La tarjeta completa queda en la vista detallada.
  if (compact) {
    const Tag = setPage ? 'button' : 'div'
    return (
      <Tag type={setPage ? 'button' : undefined} className={`${s.card} ${s.scoreRow} rise`} data-tour="iq-score"
        onClick={setPage ? () => setPage('coach') : undefined}>
        <span className={`num ${s.scoreRowNum}`} style={{ color: healthScore.color }}>
          <CountUp value={healthScore.score} format={(v) => Math.round(v)} duration={900} overshoot />
        </span>
        <span className={s.scoreRowMeta}>
          <span className={s.scoreLabel}><IconIQScore size={14} />{t('dash.health.title')}</span>
          <ScoreState level={healthScore.level} label={healthScore.label} size={14} style={{ fontSize: 14, fontWeight: 600 }} />
        </span>
        {setPage && <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" style={{ color: 'var(--th)' }} />}
      </Tag>
    )
  }

  const weakest = weakestFactor(healthScore.breakdown)
  const allMax = !weakest || weakest.pts >= weakest.max
  const page = weakest && FACTOR_PAGE[weakest.key]

  return (
    <section className={`${s.card} rise`} data-tour="iq-score" aria-labelledby="home-score-title">
      <div className={s.scoreTop}>
        <div style={{ flexShrink: 0 }}>
          <div className={`num ${s.scoreNum}`} style={{ color: healthScore.color }}>
            {/* instrument-settle: barrido con resorte 900ms — nunca vuelve a cero al re-renderizar */}
            <CountUp value={healthScore.score} format={(v) => Math.round(v)} duration={900} overshoot />
          </div>
          <div className={s.scoreOf}>/ 100</div>
        </div>
        <div className={s.scoreMeta}>
          <h2 id="home-score-title" className={s.scoreLabel} style={{ margin: 0 }}>
            <IconIQScore size={14} />{t('dash.health.title')}
          </h2>
          <ScoreState level={healthScore.level} label={healthScore.label} size={16} style={{ fontSize: 15, fontWeight: 700 }} />
          {delta && <DeltaLine delta={delta} valueText={valueText} prevMonth={prev ? prev.m : prevMonthOf(activeMonth)} />}
        </div>
        <Sparkline history={history} color={healthScore.color} />
      </div>

      <div className={s.next}>
        <div className={s.nextText}>
          {allMax ? (
            <div className={s.nextTitle}>{t('home.score.allMax')}</div>
          ) : (
            <>
              <div className={s.nextTitle}>{t('home.score.next', { factor: weakest.label })}</div>
              <div className={s.nextSub}>{t(`onboarding.v2.next.${weakest.key}`)}</div>
            </>
          )}
        </div>
        {!allMax && page && setPage && (
          <button type="button" className={s.btnSecondary} onClick={() => setPage(page)}>
            {t(`home.score.cta.${weakest.key}`)} →
          </button>
        )}
      </div>

      <div className={s.factors}>
        {healthScore.breakdown.map(b => {
          // Cada factor: completo / parcial / en cero → mismo vocabulario de
          // ícono que el estado del score, para no depender solo del color.
          const lvl = b.pts >= b.max ? 'ok' : b.pts > 0 ? 'attention' : 'risk'
          return (
            <div key={b.key} className={s.factor}>
              <span className={s.factorPts} style={{ color: SCORE_LEVELS[lvl].color }}>
                <ScoreStateIcon level={lvl} size={13} />{b.pts}<small>/{b.max}</small>
              </span>
              <span className={s.factorLabel}>{b.label}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
