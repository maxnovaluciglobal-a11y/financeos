// src/pages/Investments/InvestLimitSheet.jsx — aviso contextual cuando Starter
// llega a un límite de Inversiones (utils/investLimits.js). Hoy los límites están
// apagados (config.features.investStarterLimits = false), así que esta hoja no
// aparece. Siempre dice el camino gratis; "Ver Pro" solo en la web (en la app de
// tienda no hay precios ni enlaces de compra, native/storePolicy.js).
import { useEffect, useState } from 'react'
import Sheet from '../../components/ui/Sheet.jsx'
import { useT } from '../../i18n/useT.js'
import { INVEST_LIMIT_EVENT, STARTER_INVEST_LIMITS } from '../../utils/investLimits.js'
import { canShowWebCheckout, canShowProMarketing } from '../../native/storePolicy.js'
import { requestSettingsSub } from '../Settings/settingsIndex.js'

const LIMIT_N = { positions: STARTER_INVEST_LIMITS.positions, watchlist: STARTER_INVEST_LIMITS.watchlist, tramos: STARTER_INVEST_LIMITS.tramos }

export default function InvestLimitSheet({ setPage }) {
  const { t } = useT()
  const [kind, setKind] = useState(null)
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const on = (e) => setKind(e?.detail?.kind || null)
    window.addEventListener(INVEST_LIMIT_EVENT, on)
    return () => window.removeEventListener(INVEST_LIMIT_EVENT, on)
  }, [])
  if (!kind) return null
  const n = LIMIT_N[kind]
  const web = canShowWebCheckout() && canShowProMarketing()
  const close = () => setKind(null)
  return (
    <Sheet open onClose={close} ariaLabel={t('invest.limit.title')} maxWidth={460}>
      <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--display)', fontSize: 'var(--t-title)', lineHeight: 'var(--t-title-lh)', fontWeight: 700, color: 'var(--tx)' }}>{t('invest.limit.title')}</h2>
      <p style={{ fontSize: 'var(--t-body)', color: 'var(--tm)', lineHeight: 1.55, margin: '0 0 10px' }}>{t(`invest.limit.${kind}`, { n })}</p>
      <p style={{ fontSize: 'var(--t-body)', color: 'var(--tx)', lineHeight: 1.55, margin: '0 0 10px' }}>{t(`invest.limit.free.${kind}`, { n })}</p>
      {web && <p style={{ fontSize: 'var(--t-subhead)', color: 'var(--tm)', lineHeight: 1.5, margin: '0 0 16px' }}>{t('invest.limit.pro')}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: web ? '1fr 1fr' : '1fr', gap: 8 }}>
        <button type="button" className="fos-btn-secondary" onClick={close}>{t('invest.limit.close')}</button>
        {web && (
          <button type="button" className="fos-btn-primary" onClick={() => { close(); requestSettingsSub('plan'); setPage?.('settings') }}>{t('invest.limit.cta')}</button>
        )}
      </div>
    </Sheet>
  )
}
