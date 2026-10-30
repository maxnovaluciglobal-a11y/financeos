// src/pages/Dashboard/ProjectionCard.jsx — "Proyección de fin de mes".
// Antes vivía en la vista detallada del Inicio; desde la poda P1 está en
// Panorama y, si la persona la enciende en "Editar Inicio", también en el
// Inicio. Mismo cálculo que la página Proyección (utils/projection.js).
import { useT } from '../../i18n/useT.js'
import { Card, CardHeader } from '../../components/ui/index.jsx'
import { projectEndOfMonth } from '../../utils/projection.js'
import { fmtPctPoints } from '../../utils/index.js'

export default function ProjectionCard({ incomes, expenses, activeMonth, pending, kpis, money, dualOn, toUSD, setPage }) {
  const { t } = useT()
  if (!(kpis.totalInc > 0 || kpis.totalExp > 0)) return null
  const { today, daysInMonth, daysLeft, dailyExp, medianDaily, projExp, projBal, avgExp, avgExpMonths, pendingExp, pendingInc } =
    projectEndOfMonth({ incomes, expenses, activeMonth, pending })
  const pctMonth = (today / daysInMonth * 100).toFixed(0)
  const over = projBal < 0
  return (
    <Card style={{ border: over ? '.5px solid color-mix(in srgb, var(--neg) 32%, transparent)' : undefined, padding: '14px 16px' }}>
      <CardHeader
        title={t('dash.proj.title')}
        right={<span style={{ fontSize: 11, fontFamily: 'var(--sans)', color: 'var(--th)', textTransform: 'none', letterSpacing: 'normal' }}>{t('dash.proj.day', { d: today, n: daysInMonth, left: daysLeft })}</span>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
        {[
          { label: t('dash.proj.exp'),   value: money(projExp),           color: 'var(--tx)', rawVal: projExp },
          { label: t('dash.proj.bal'),   value: money(Math.abs(projBal)), color: over ? 'var(--red)' : 'var(--accent)', prefix: over ? '−' : '+', rawVal: projBal },
          { label: t('dash.proj.daily'), value: t('dash.proj.perDay', { v: money(dailyExp) }), color: 'var(--th)', rawVal: null },
        ].map(k => (
          <div key={k.label}>
            <div style={{ fontSize: 12, fontFamily: 'var(--sans)', fontWeight: 600, color: 'var(--th)', marginBottom: 3 }}>{k.label}</div>
            <div className="num" style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--num)', color: k.color }}>{k.prefix || ''}{k.value}</div>
            {dualOn && k.rawVal != null && (
              <div style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--sans)', opacity: .7, marginTop: 2 }}>{toUSD(k.rawVal)}</div>
            )}
          </div>
        ))}
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--brd2)', overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ height: '100%', width: '100%', transform: `scaleX(${pctMonth / 100})`, transformOrigin: 'left', background: over ? 'var(--red)' : 'var(--accent)', borderRadius: 2, transition: 'transform .3s' }} />
      </div>
      {avgExp > 0 && avgExpMonths > 0 && (
        <div style={{ fontSize: 11, fontFamily: 'var(--sans)', color: 'var(--th)', marginBottom: 4, opacity: .8 }}>
          {t('dash.proj.basis', { cur: money(kpis.totalExp), med: money(medianDaily), left: daysLeft, avg: money(avgExp) })}
        </div>
      )}
      {(pendingExp > 0 || pendingInc > 0) && (
        <div style={{ fontSize: 11, fontFamily: 'var(--sans)', color: 'var(--th)', marginBottom: 4, opacity: .8 }}>
          {t('dash.proj.pendingBasis', { exp: money(pendingExp), inc: money(pendingInc) })}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 11, fontFamily: 'var(--sans)', color: 'var(--th)' }}>
        <span>{t('dash.proj.elapsed', { pct: fmtPctPoints(pctMonth) })}</span>
        {setPage && <button type="button" onClick={() => setPage('cashflow')} style={{ minHeight: 44, color: 'var(--accent)', cursor: 'pointer', background: 'none', border: 0, padding: 0, font: 'inherit' }}>{t('dash.proj.viewFull')}</button>}
      </div>
      {over && setPage && (
        <button type="button" onClick={() => setPage('movements')}
          style={{ marginTop: 6, minHeight: 44, background: 'none', border: '.5px solid var(--red)', borderRadius: 8, padding: '0 12px', fontSize: 12, fontWeight: 600, color: 'var(--red)', cursor: 'pointer', fontFamily: 'var(--sans)' }}>
          {t('dash.proj.reviewExpenses')} →
        </button>
      )}
    </Card>
  )
}
