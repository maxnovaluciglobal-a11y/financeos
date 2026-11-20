// src/pages/Investments/portfolio/Sources.jsx — fuentes y atribución (INV-1),
// como en Invest: de dónde sale cada dato que se muestra, el enlace a "Datos y
// licencias", la atribución que exige CoinGecko, dónde se guardan los datos y
// el aviso legal. El ejemplo no se atribuye a ninguna fuente.
import { INVEST_ORIGIN } from '../../../core/investBridge.js'
import s from './portfolio.module.css'

// src: { yahoo, coingecko } (precios) · fx: se muestran cifras convertidas ·
// ars: se usa el dólar argentino · fundamentals: ['Finnhub', ...] (Dividendos).
export default function Sources({ t, src = {}, fx = false, ars = false, fundamentals = [] }) {
  const prices = [src.yahoo && 'Yahoo Finance', src.coingecko && 'CoinGecko'].filter(Boolean)
  return (
    <div className={s.notes}>
      {prices.length > 0 && <p className={s.note}>{t('pf.src.prices', { source: prices.join(', ') })}</p>}
      {fundamentals.length > 0 && <p className={s.note}>{t('pf.src.fundamentals', { source: fundamentals.join(', ') })}</p>}
      {fx && <p className={s.note}>{t('pf.src.fx')}{ars ? ` ${t('pf.src.ars')}` : ''}</p>}
      <div className={s.links}>
        <a href={`${INVEST_ORIGIN}/datos-y-licencias.html`} target="_blank" rel="noopener noreferrer">{t('pf.src.link')}</a>
        {src.coingecko && <a href="https://www.coingecko.com/en/api" target="_blank" rel="noopener noreferrer">Powered by CoinGecko API</a>}
      </div>
      <p className={s.note}>{t('pf.privacy')}</p>
      <p className={s.note}>{t('pf.legal')}</p>
    </div>
  )
}
