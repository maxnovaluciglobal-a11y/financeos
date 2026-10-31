// src/pages/Dashboard/HeroDetailSheet.jsx — todo lo que dejó la tarjeta "Te queda"
// al pasar de 12 a 5 elementos (causa 9, 31-oct-2026): a un toque, nada perdido.
// La variación contra el mes anterior, el ritmo, "Previsto pendiente · Revisar",
// la tasa con su fecha, el interruptor de moneda y "Editar tasa". El detalle
// completo sigue en Panorama.
import { ChevronRight } from 'lucide-react'
import Sheet from '../../components/ui/Sheet.jsx'
import Money from '../../components/Money.jsx'
import Amount from '../../components/Amount.jsx'
import LivingRing from '../../components/LivingRing.jsx'
import { ScoreState } from '../../components/ScoreState.jsx'
import { useT } from '../../i18n/useT.js'
import { fmtMoney, fmtPctPoints } from '../../utils/index.js'
import { toRef } from '../../utils/refRate.js'
import DeltaLine from './DeltaLine.jsx'
import { RefSwitch, RefRow, fmtRef } from './RefCurrency.jsx'
import s from './Home.module.css'
import r from '../../components/recurring/recurring.module.css'

export default function HeroDetailSheet({ open, onClose, free, hasData, sym, showRef, refc, delta, prevMonth, cutDay, deltaFormat, pulse, pending, onReviewPending, dual, sub, onPanorama }) {
  const { t, lang } = useT()
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t('home.detail.title')} maxWidth={440}>
      <h2 className={s.sheetTitle}>{t('home.detail.title')}</h2>
      <div className={s.detailHead}>
        <div className={s.kpiLabel}>{free < 0 ? t('home.kpi.short') : t('home.kpi.left')}</div>
        {hasData && (
          <div className="num-hero" style={{ fontSize: '1.75rem', lineHeight: 1.15, color: 'var(--tx)' }}>
            {showRef
              ? <span style={{ whiteSpace: 'nowrap' }}>{free < 0 ? '−' : free > 0 ? '+' : ''}<Money>{fmtRef(toRef(Math.abs(free), refc.rate.rate), lang)}</Money></span>
              : <Amount value={free} sym={sym} plus hero />}
          </div>
        )}
        {hasData && <DeltaLine delta={delta} prevMonth={prevMonth} untilDay={cutDay} sym={sym} formatAmount={deltaFormat} />}
        {hasData && <div className={s.kpiSub}>{sub}</div>}
        {dual && <div className={s.kpiDual}>{dual}</div>}
      </div>

      {pending && pending.count > 0 && (
        <div className={`${r.pending} ${s.detailBlock}`}>
          <span className={r.pendingLabel}>{t('rec.pending.line')}</span>
          <span className={r.pendingVals}>
            {pending.expense > 0 && <Money>−{fmtMoney(pending.expense, sym)}</Money>}
            {pending.expense > 0 && pending.income > 0 && ' · '}
            {pending.income > 0 && <Money>+{fmtMoney(pending.income, sym)}</Money>}
          </span>
          {onReviewPending && <button type="button" className={r.reviewLink} onClick={() => { onClose(); onReviewPending() }}>{t('rec.pending.review')} →</button>}
        </div>
      )}

      {hasData && pulse && (
        <div className={`${s.detailPulse} ${s.detailBlock}`}>
          <LivingRing spentRatio={pulse.spentRatio} elapsedRatio={pulse.elapsedRatio} color={pulse.color}
            centerValue="" centerLabel="" footLabel="" size={72}
            ariaLabel={t('pulse.aria', { spent: fmtPctPoints(Math.round(pulse.spentRatio * 100)), elapsed: fmtPctPoints(Math.round(pulse.elapsedRatio * 100)) })} />
          <div className={s.detailPulseText}>
            <ScoreState level={pulse.level} label={t(`pulse.${pulse.level}`)} size={14} style={{ fontSize: '.875rem' }} />
            <span className={s.detailLegend}>{t('ring.legend')}</span>
          </div>
        </div>
      )}

      {refc && (
        <RefRow refRate={refc.rate} mode={showRef ? 'ref' : 'local'} free={free} sym={sym} country={refc.country}
          showAmount={hasData} onEdit={refc.onEdit} tool={refc.tool} onTool={refc.onTool} fresh={refc.fresh} onUseFresh={refc.onUseFresh}
          switcher={refc.rate && hasData ? <RefSwitch mode={refc.mode} onChange={refc.setMode} localCode={refc.localCode} /> : null} />
      )}

      {onPanorama && (
        <button type="button" className={s.detailLink} onClick={() => { onClose(); onPanorama() }}>
          {t('home.detail.panorama')}
          <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
      )}
    </Sheet>
  )
}
