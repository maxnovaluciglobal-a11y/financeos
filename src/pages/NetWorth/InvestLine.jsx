// src/pages/NetWorth/InvestLine.jsx — la línea "Inversiones" de Patrimonio neto.
// Es una estimación de Invest y se ve como tal: etiqueta, fecha y fuente de la
// tasa. Sin tasa con fecha va en US$, aparte, y no entra al total.
import Money from '../../components/Money.jsx'
import { StateTag } from '../../components/ledger/index.js'
import { useT } from '../../i18n/useT.js'
import { fmtMoney, fmtMoneyFor } from '../../utils/index.js'
import { fmtInvestAt } from '../../utils/investNetWorth.js'

export default function InvestLine({ inv, sym }) {
  const { t, lang } = useT()
  const inTotal = inv.amount != null
  const usd = fmtMoneyFor(inv.usd, 'USD', lang)
  const at = fmtInvestAt(inv.at)
  return (
    <div style={{ padding: '5px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--sans)' }}>{t('networth.investments')}</span>
        <span className="num" style={{ fontSize: 12, fontWeight: 600, color: inTotal ? 'var(--grn)' : 'var(--tm)' }}>
          <Money>{inTotal ? fmtMoney(inv.amount, sym) : usd}</Money>
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 8px', marginTop: 2 }}>
        <StateTag tone="muted" size={12} label={t('networth.investments.tag')} style={{ fontSize: 11, fontWeight: 500 }} />
        <span style={{ fontSize: 11, color: 'var(--th)', lineHeight: 1.5 }}>
          {inTotal ? t('networth.investments.note', { at }) : t('networth.investments.noRate', { at })}
        </span>
      </div>
    </div>
  )
}
