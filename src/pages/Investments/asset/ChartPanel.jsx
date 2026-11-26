// Gráfico de la ficha: rangos 1M·3M·6M·1A·3A, velas con medias de 20, 50 y
// 200 días y bandas de Bollinger, volumen, y las capas RSI (14) y MACD
// (12, 26, 9) en SVG debajo (Invest: renderDrawerBody + drwRsiSvg/drwMacdSvg).
// El canvas lleva una descripción con las cifras del rango para lector de
// pantalla; las capas son decorativas y su lectura va en texto.
// Vista esencial (simple): solo los rangos y una línea con el cierre de cada
// día (LineChart.jsx); velas, medias, Bollinger, volumen, RSI y MACD quedan en
// Vista completa.
import { lazy, Suspense, useMemo } from 'react'
import { ASSET_RANGES, chartData, rangeSummary } from '../../../utils/investAsset.js'
import { rsiZone } from '../../../utils/investIndicators.js'
import { fmtPct } from '../../../utils/index.js'
import { useAssetT } from './assetDict.js'
import { fmtPx } from './format.js'
import LineChart from './LineChart.jsx'
import s from './asset.module.css'

const CandleChart = lazy(() => import('../../../components/charts/CandleChart.jsx'))

const LINE_TOKENS = { sma20: '--cat-4', sma50: '--cat-1', sma200: '--cat-7', bb: '--cat-5' }

export function RsiSvg({ values }) {
  const W = 400, H = 80, n = values.length
  const y = (v) => H - (v / 100) * H
  const pts = values.map((v, i) => (v == null ? null : `${((i / Math.max(n - 1, 1)) * W).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={s.subSvg} aria-hidden="true" focusable="false">
      <rect x="0" y={y(70)} width={W} height={y(30) - y(70)} fill="var(--pos-bg)" />
      <line x1="0" x2={W} y1={y(70)} y2={y(70)} stroke="var(--chart-prev)" strokeDasharray="4,3" vectorEffect="non-scaling-stroke" />
      <line x1="0" x2={W} y1={y(30)} y2={y(30)} stroke="var(--chart-prev)" strokeDasharray="4,3" vectorEffect="non-scaling-stroke" />
      {pts && <polyline points={pts} fill="none" stroke="var(--tx)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
    </svg>
  )
}

export function MacdSvg({ values }) {
  const W = 400, H = 70, n = values.length
  const mx = Math.max(...values.map(v => Math.abs(v || 0)), 0) || 1
  const bw = W / Math.max(n, 1)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={s.subSvg} aria-hidden="true" focusable="false">
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--chart-prev)" vectorEffect="non-scaling-stroke" />
      {values.map((v0, i) => {
        const v = v0 || 0
        const hh = (Math.abs(v) / mx) * (H / 2 - 2)
        return <rect key={i} x={(i * bw).toFixed(2)} y={(v >= 0 ? H / 2 - hh : H / 2).toFixed(2)} width={Math.max(bw - 0.6, 0.6).toFixed(2)} height={hh.toFixed(2)} fill={v >= 0 ? 'var(--pos)' : 'var(--neg)'} opacity=".75" />
      })}
    </svg>
  )
}

export default function ChartPanel({ ticker, ccy, rows, phase, range, onRange, layers, onLayer, demo, onRetry, simple = false, demoNoted = false }) {
  // demoNoted: la cabecera de la ficha ya dice "Datos de ejemplo" (un solo aviso).
  const { t } = useAssetT()
  const r = ASSET_RANGES.find(x => x.key === range) || ASSET_RANGES[2]
  const data = useMemo(() => (rows ? chartData(rows, r.n) : null), [rows, r.n])
  const lines = useMemo(() => (data ? [
    { key: 'bbU', data: data.bbUpper, color: LINE_TOKENS.bb, dashed: true, width: 1 },
    { key: 'bbL', data: data.bbLower, color: LINE_TOKENS.bb, dashed: true, width: 1 },
    { key: 'sma20', data: data.sma20, color: LINE_TOKENS.sma20 },
    { key: 'sma50', data: data.sma50, color: LINE_TOKENS.sma50 },
    { key: 'sma200', data: data.sma200, color: LINE_TOKENS.sma200 },
  ] : []), [data])
  const sum = data ? rangeSummary(data.candles) : null
  const rangeLong = t(`asset.range.long.${r.key}`)
  const label = sum
    ? t('asset.chart.label', { t: ticker, range: rangeLong, to: fmtPx(sum.to, ccy), pct: fmtPct(sum.pct, { signed: true }), low: fmtPx(sum.low, ccy), high: fmtPx(sum.high, ccy) })
    : t('asset.chart.labelShort', { t: ticker, range: rangeLong })
  const zone = data ? rsiZone(data.rsiNow) : 'na'
  const lineLabel = sum
    ? t('asset.line.label', { t: ticker, range: rangeLong, from: fmtPx(sum.from, ccy), to: fmtPx(sum.to, ccy), pct: fmtPct(sum.pct, { signed: true }) })
    : t('asset.line.labelShort', { t: ticker, range: rangeLong })

  if (simple) {
    // Nombre corto: la descripción completa la lee una sola vez el SVG de LineChart.
    return (
      <section className={s.chartSec} aria-label={t('asset.line.labelShort', { t: ticker, range: rangeLong })}>
        <div className={s.ctl}>
          <div role="group" aria-label={t('asset.range.group')} className={s.chips}>
            {ASSET_RANGES.map(x => (
              <button key={x.key} type="button" className={s.chip} aria-pressed={x.key === r.key} onClick={() => onRange(x.key)}>
                {t(`asset.range.${x.key}`)}<span className="sr-only"> ({t(`asset.range.long.${x.key}`)})</span>
              </button>
            ))}
          </div>
        </div>
        <div className={s.chartBox}>
          {phase === 'ready' && data?.candles.length > 1 ? (
            <LineChart closes={data.candles.map(c => c.close)} label={lineLabel} up={sum ? sum.pct >= 0 : false} height={220} />
          ) : phase === 'loading' || phase === 'idle' ? (
            <p className={s.note} role="status">{t('invest.chart.loading')}</p>
          ) : (
            <div className={s.stateBox}>
              <p className={s.note} role="alert">{t('invest.chart.error')}</p>
              {onRetry && <button type="button" className={s.btn} onClick={onRetry}>{t('asset.retry')}</button>}
            </div>
          )}
        </div>
        {data && data.candles.length > 1 && (
          <>
            {data.total < r.n && r.n > 21 && <p className={s.note}>{t('asset.chart.short', { n: data.total })}</p>}
            <p className={s.note}>{t('asset.line.legend')}{demo && demoNoted ? '' : ` · ${demo ? t('invest.chart.sample') : t('invest.card.source', { source: 'Yahoo Finance' })}`}</p>
          </>
        )}
      </section>
    )
  }

  return (
    <section className={s.chartSec} aria-label={t('asset.chart.labelShort', { t: ticker, range: rangeLong })}>
      <div className={s.ctl}>
        <div role="group" aria-label={t('asset.range.group')} className={s.chips}>
          {ASSET_RANGES.map(x => (
            <button key={x.key} type="button" className={s.chip} aria-pressed={x.key === r.key} onClick={() => onRange(x.key)}>
              {t(`asset.range.${x.key}`)}<span className="sr-only"> ({t(`asset.range.long.${x.key}`)})</span>
            </button>
          ))}
        </div>
        <div role="group" aria-label={t('asset.layer.group')} className={s.chips}>
          <button type="button" className={s.chip} aria-pressed={!!layers.rsi} onClick={() => onLayer('rsi')}>{t('asset.layer.rsi')}</button>
          <button type="button" className={s.chip} aria-pressed={!!layers.macd} onClick={() => onLayer('macd')}>{t('asset.layer.macd')}</button>
        </div>
      </div>

      <div className={s.chartBox}>
        {phase === 'ready' && data?.candles.length ? (
          <Suspense fallback={<p className={s.note} role="status">{t('invest.chart.loading')}</p>}>
            <CandleChart candles={data.candles} lines={lines} volume={data.volume} label={label} height={240} />
          </Suspense>
        ) : phase === 'loading' || phase === 'idle' ? (
          <p className={s.note} role="status">{t('invest.chart.loading')}</p>
        ) : (
          <div className={s.stateBox}>
            <p className={s.note} role="alert">{t('invest.chart.error')}</p>
            {onRetry && <button type="button" className={s.btn} onClick={onRetry}>{t('asset.retry')}</button>}
          </div>
        )}
      </div>

      {data && data.candles.length > 0 && (
        <>
          {data.total < r.n && r.n > 21 && <p className={s.note}>{t('asset.chart.short', { n: data.total })}</p>}
          <ul className={s.legend} aria-label={t('asset.layer.group')}>
            <li><i className={s.key} style={{ background: `var(${LINE_TOKENS.sma20})` }} aria-hidden="true" />{t('asset.legend.sma20')}</li>
            <li><i className={s.key} style={{ background: `var(${LINE_TOKENS.sma50})` }} aria-hidden="true" />{t('asset.legend.sma50')}</li>
            {data.has200 && <li><i className={s.key} style={{ background: `var(${LINE_TOKENS.sma200})` }} aria-hidden="true" />{t('asset.legend.sma200')}</li>}
            <li><i className={`${s.key} ${s.keyDash}`} style={{ borderColor: `var(${LINE_TOKENS.bb})` }} aria-hidden="true" />{t('asset.legend.bb')}</li>
            {data.volume.length > 0 && <li><i className={s.keyBar} aria-hidden="true" />{t('asset.legend.vol')}</li>}
          </ul>
          {!data.has200 && <p className={s.note}>{t('asset.legend.no200')}</p>}

          {layers.rsi && (
            <div className={s.sub}>
              <div className={s.subHead}><span>{t('asset.rsi.title')}</span>
                <span className={s.num}>{t('asset.rsi.now', { v: data.rsiNow == null ? '—' : Math.round(data.rsiNow), zone: t(`asset.rsi.zone.${zone}`) })}</span></div>
              <RsiSvg values={data.rsi} />
              <p className={s.note}>{t('asset.rsi.band')}</p>
            </div>
          )}
          {layers.macd && (
            <div className={s.sub}>
              <div className={s.subHead}><span>{t('asset.macd.title')}</span>
                <span>{data.macdNow == null ? '—' : data.macdNow >= 0 ? t('asset.macd.above') : t('asset.macd.below')}</span></div>
              <MacdSvg values={data.macdHist} />
            </div>
          )}
          <p className={s.note}>{t('asset.chart.attr')}{demo && demoNoted ? '' : ` ${demo ? t('invest.chart.sample') : t('invest.card.source', { source: 'Yahoo Finance' })}`}</p>
        </>
      )}
    </section>
  )
}
