// src/pages/NetWorth/index.jsx
// Patrimonio neto — vista consolidada de lo que ya registras en la app:
// activos (ahorro en metas + flujo neto de propiedades) menos pasivos (deudas).
// No agrega datos nuevos: reutiliza Goals, Debts y Projects tal cual existen.

import { useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { Card, CardHeader, PageHeader, Empty } from '../../components/ui/index.jsx'
import { fmtMoney as fmtMoneyRaw, currencySymbol } from '../../utils/index.js'
import { calcNetWorth } from '../../utils/netWorth.js'
import CountUp from '../../components/CountUp.jsx'
import Money, { useMoney } from '../../components/Money.jsx'

export default function NetWorth() {
  const { goals, debts, incomes, expenses, settings } = useApp()
  const { t } = useT()
  const sym = currencySymbol(settings.currency, settings.language)
  // Ocultar montos (T13): fmtMoney enmascara cuando settings.hideAmounts está activo.
  const { m } = useMoney()
  const fmtMoney = (n, s) => m(fmtMoneyRaw(n, s))

  // Cálculo compartido (mismo que usa el resumen en Reportes/PDF)
  const { savedInGoals, propsValueTotal, propertiesNet, pendingDebt, totalActivos, totalPasivos, netWorth, hasData } =
    useMemo(() => calcNetWorth({ goals, debts, incomes, expenses, settings }),
      [goals, debts, incomes, expenses, settings])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageHeader title={t('networth.title')} sub={t('networth.sub')} />

      {!hasData ? (
        <Card>
          <Empty text={t('networth.empty')} />
          <div style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--mono)', lineHeight: 1.7, marginTop: 8 }}>
            {t('networth.emptyHint')}
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
              <div style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
                {t('networth.headline')}
              </div>
              <div className="num" style={{ fontSize: 36, fontWeight: 700, color: netWorth >= 0 ? 'var(--grn)' : '#e84142' }}>
                {netWorth >= 0 ? '' : '-'}<Money><CountUp value={Math.abs(netWorth)} format={(v) => fmtMoneyRaw(v, sym)} duration={750} /></Money>
              </div>
              <div style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', marginTop: 4 }}>
                {t('networth.formula', { a: fmtMoney(totalActivos, sym), p: fmtMoney(totalPasivos, sym) })}
              </div>
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
            <Card>
              <CardHeader title={t('networth.assets')} />
              <Row label={t('networth.savedInGoals')} value={savedInGoals} sym={sym} color="var(--grn)" />
              <Row label={t('networth.propsValue')} value={propsValueTotal} sym={sym} color="var(--grn)" />
              <Row label={t('networth.propsPositive')} value={Math.max(0, propertiesNet)} sym={sym} color="var(--grn)" />
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, marginTop: 6, borderTop: '.5px solid var(--brd)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)' }}>{t('networth.totalAssets')}</span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--grn)' }}><Money>{fmtMoney(totalActivos, sym)}</Money></span>
              </div>
            </Card>

            <Card>
              <CardHeader title={t('networth.liabilities')} />
              <Row label={t('networth.pendingDebts')} value={pendingDebt} sym={sym} color="#e84142" />
              <Row label={t('networth.propsNegative')} value={Math.max(0, -propertiesNet)} sym={sym} color="#e84142" />
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, marginTop: 6, borderTop: '.5px solid var(--brd)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)' }}>{t('networth.totalLiabilities')}</span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', color: '#e84142' }}><Money>{fmtMoney(totalPasivos, sym)}</Money></span>
              </div>
            </Card>
          </div>

          <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', lineHeight: 1.6, padding: '0 4px' }}>
            {t('networth.disclaimer')}{propsValueTotal > 0 ? ' ' + t('networth.propsValueNote') : ''}
          </div>
        </>
      )}
    </div>
  )
}

function Row({ label, value, sym, color }) {
  // Ocultar montos (T13): fmtMoney enmascara cuando settings.hideAmounts está activo.
  const { m } = useMoney()
  const fmtMoney = (n, s) => m(fmtMoneyRaw(n, s))
  if (!value) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0' }}>
      <span style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--mono)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--mono)', color }}><Money>{fmtMoney(value, sym)}</Money></span>
    </div>
  )
}
