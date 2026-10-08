// src/pages/Inflacion/index.jsx
// Motor 3 — Ajuste por inflación (Argentina). Gated por país (AR).
// Config-driven: serie IPC en src/config/inflacion/ar.js

import { useState, useMemo } from 'react'
import SignalIcon, { InlineIcon } from '../../components/icons/SignalIcon.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { Card, CardHeader, FormRow, FormGroup, Alert, PageHeader } from '../../components/ui/index.jsx'
import ProGate from '../../components/ui/ProGate.jsx'
import arConfig from '../../config/inflacion/ar.js'

const CONFIGS = { AR: arConfig }

export default function Inflacion() {
  const { settings } = useApp()
  const { t } = useT()
  const country = (settings.country || 'CL').toUpperCase()
  const config = CONFIGS[country]

  // Reglas de hooks: TODOS los hooks van antes de cualquier return condicional.
  // Si settings.country cambia con el componente montado, un hook después del
  // return hace que React renderice menos hooks de los esperados y la pantalla
  // queda en blanco. Referencia de estructura correcta: pages/Steuer/index.jsx.
  const [monto, setMonto] = useState('')
  const [desde, setDesde] = useState(config?.primero ?? '')
  const [hasta, setHasta] = useState(config?.ultimo ?? '')

  const result = useMemo(() => {
    if (!config) return null
    if (desde > hasta) return null
    return config.calcular({ monto: Number(monto) || 0, desde, hasta })
  }, [config, monto, desde, hasta])

  if (!config) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--th)', fontFamily: 'var(--mono)', fontSize: 13 }}>
        {t('inflacion.notAvailable')}
      </div>
    )
  }

  const sym = config.sym

  const fmt = (n) => `${sym}${(Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
  const fmtMes = (ym) => {
    const [y, m] = ym.split('-')
    const N = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    return `${N[Number(m)]}-${y}`
  }

  return (
    <ProGate feature={t('inflacion.proGateFeature')}>
      <div className="stack">
        <PageHeader title={config.titulo} sub={config.subtitulo} />

        <Alert type="info">
          {config.disclaimer} <strong>Datos hasta {config.vigencia} ({config.fuente}).</strong>
        </Alert>

        <Card>
          <CardHeader title={t('inflacion.card1.title')} />
          <FormRow>
            <FormGroup label={t('inflacion.form.amount')}>
              <input type="number" inputMode="decimal" min="0" value={monto} placeholder="0" onChange={e => setMonto(e.target.value)} />
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label={t('inflacion.form.from')}>
              <select value={desde} onChange={e => setDesde(e.target.value)}>
                {config.meses.map(m => <option key={m} value={m}>{fmtMes(m)}</option>)}
              </select>
            </FormGroup>
            <FormGroup label={t('inflacion.form.to')}>
              <select value={hasta} onChange={e => setHasta(e.target.value)}>
                {config.meses.map(m => <option key={m} value={m}>{fmtMes(m)}</option>)}
              </select>
            </FormGroup>
          </FormRow>
          {desde > hasta && (
            <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>{t('inflacion.form.dateError')}</div>
          )}
        </Card>

        {result && Number(monto) > 0 && (
          <Card>
            <CardHeader title={t('inflacion.result.title', { from: fmtMes(desde), to: fmtMes(hasta) })} />
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 30, fontWeight: 700, color: 'var(--accent)', lineHeight: 1.1 }}>
                {fmt(result.valorAjustado)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--tm)', marginTop: 8, lineHeight: 1.5 }}>
                {t('inflacion.result.equivalencePre', { amt: fmt(monto), from: fmtMes(desde) })}{' '}
                <strong>{fmt(result.valorAjustado)}</strong>{' '}
                {t('inflacion.result.equivalencePost', { to: fmtMes(hasta) })}
              </div>
            </div>
            <div style={{ borderTop: '.5px solid var(--brd)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Row label={t('inflacion.result.cumulativeInflation')} value={`${result.inflacionAcumPct.toFixed(1)}%`} color="var(--red)" />
              <Row label={t('inflacion.result.purchasingPowerLost')} value={`−${result.poderPerdidoPct.toFixed(1)}%`} color="var(--red)" />
              <Row label={t('inflacion.result.cashBuysLikePre')} value={`${fmt(result.poderHoy)} de ${fmtMes(desde)}`} color="var(--th)" />
            </div>
          </Card>
        )}
      </div>
    </ProGate>
  )
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
      <span>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color }}>{value}</span>
    </div>
  )
}
