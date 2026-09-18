// src/pages/MultiDolarAR/index.jsx
// Multi-dólar en vivo + comparador de rendimientos — Argentina. Sustituye al
// ajuste por IPC como tarjeta protagonista (el pain real no es "cuánto vale
// mi plata de hace 6 meses", es "a qué dólar la paso hoy y en qué la dejo
// mientras tanto"). Solo visible si settings.country === 'AR'.

import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { Card, CardHeader, FormRow, FormGroup, Alert, PageHeader } from '../../components/ui/index.jsx'
import ProGate from '../../components/ui/ProGate.jsx'
import { loadTasaAR } from '../../utils/tasaAR.js'
import { calcRendimiento, TNA_DEFAULTS } from '../../utils/rendimientosAR.js'
import { fmtFixed } from '../../utils/index.js'

const fmtARS = (n) => fmtFixed(n, 'es-AR')
const fmtUSD = (n) => `US$${(Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`

const DOLARES = [
  { key: 'blue', label: 'Blue' },
  { key: 'mep', label: 'MEP (Bolsa)' },
  { key: 'ccl', label: 'CCL' },
  { key: 'oficial', label: 'Oficial' },
  { key: 'cripto', label: 'Cripto (USDT)' },
  { key: 'tarjeta', label: 'Tarjeta' },
  { key: 'mayorista', label: 'Mayorista' },
]

export default function MultiDolarAR() {
  const { settings } = useApp()
  const { t } = useT()
  const country = (settings.country || 'CL').toUpperCase()

  if (country !== 'AR') {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--th)', fontFamily: 'var(--mono)', fontSize: 13 }}>
        {t('multidolarar.onlyAR')}
      </div>
    )
  }

  const [live, setLive] = useState(null)
  useEffect(() => { loadTasaAR().then(setLive) }, [])

  return (
    <ProGate feature={t('multidolarar.proFeature')}>
      <div className="stack">
        <PageHeader title={t('multidolarar.title')} sub={t('multidolarar.sub')} />

        <Alert type="info">⚠ {t('multidolarar.disclaimer')}</Alert>

        <Card>
          <CardHeader title={t('multidolarar.rates.title')} right={
            live && (
              <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: live.source === 'api' ? 'var(--accent)' : 'var(--th)' }}>
                {live.source === 'api' ? `● ${t('multidolarar.rates.live')}` : `○ ${t('multidolarar.rates.offline')}`}
              </span>
            )
          } />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
            {DOLARES.map(d => (
              <div key={d.key} style={{ background: 'var(--sur2)', border: '.5px solid var(--brd)', borderRadius: 'var(--r)', padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--th)', marginBottom: 4 }}>{d.label}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: 'var(--tx)' }}>
                  {live ? fmtARS(live[d.key]) : '—'}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {live && <RendimientosCard blue={live.blue} />}
      </div>
    </ProGate>
  )
}

function RendimientosCard({ blue }) {
  const { t } = useT()
  const [capital, setCapital] = useState('')
  const [dias, setDias] = useState('30')
  const [tnas, setTnas] = useState(TNA_DEFAULTS)

  function setTna(key, val) {
    setTnas(p => ({ ...p, [key]: val === '' ? 0 : Number(val) }))
  }

  const instrumentos = useMemo(() => {
    const c = Number(capital) || 0
    const d = Number(dias) || 0
    return [
      { key: 'plazoFijo', label: t('multidolarar.instrumentos.plazoFijo'), ...calcRendimiento(c, tnas.plazoFijo, d) },
      { key: 'cuentaRemunerada', label: t('multidolarar.instrumentos.cuentaRemunerada'), ...calcRendimiento(c, tnas.cuentaRemunerada, d) },
      { key: 'fciMoneyMarket', label: t('multidolarar.instrumentos.fciMoneyMarket'), ...calcRendimiento(c, tnas.fciMoneyMarket, d) },
    ]
  }, [capital, dias, tnas, t])

  return (
    <Card>
      <CardHeader title={t('multidolarar.rendimientos.title')} />
      <FormRow>
        <FormGroup label={t('multidolarar.rendimientos.montoLabel')}>
          <input type="number" inputMode="decimal" min="0" value={capital} placeholder="0"
            onChange={e => setCapital(e.target.value)} />
        </FormGroup>
        <FormGroup label={t('multidolarar.rendimientos.diasLabel')}>
          <input type="number" inputMode="decimal" min="1" max="365" value={dias}
            onChange={e => setDias(e.target.value)} />
        </FormGroup>
      </FormRow>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 12 }}>
        {instrumentos.map(inst => (
          <div key={inst.key} style={{ background: 'var(--sur2)', border: '.5px solid var(--brd)', borderRadius: 'var(--r)', padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)', marginBottom: 8 }}>{inst.label}</div>
            <FormGroup label={t('multidolarar.rendimientos.tnaLabel')}>
              <input type="number" inputMode="decimal" min="0" step="0.1" value={tnas[inst.key]}
                onChange={e => setTna(inst.key, e.target.value)} />
            </FormGroup>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: 'var(--accent)', marginTop: 10, lineHeight: 1 }}>
              {fmtARS(inst.final)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 4 }}>
              {t('multidolarar.rendimientos.interesNote', { interes: fmtARS(inst.interes), usd: blue ? fmtUSD(inst.final / blue) : '—' })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--th)', marginTop: 6, paddingTop: 6, borderTop: '.5px solid var(--brd)' }}>
              {t('multidolarar.rendimientos.teaNote', { pct: (inst.tea * 100).toFixed(1) })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--th)', lineHeight: 1.6, marginTop: 14, padding: '10px 12px', background: 'var(--sur2)', borderRadius: 8, border: '.5px solid var(--brd)' }}>
        {t('multidolarar.rendimientos.explainer1')}
        <br /><br />
        {t('multidolarar.rendimientos.explainer2')}
      </div>
    </Card>
  )
}
