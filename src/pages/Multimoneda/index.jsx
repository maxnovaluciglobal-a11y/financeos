// src/pages/Multimoneda/index.jsx
// Motor 3 — Panel multimoneda (Venezuela). Gated por país (VE).
// Config-driven: src/config/multimoneda/ve.js
// Tasa consultada (BCV oficial + paralelo) a ve.dolarapi.com, cache 6h,
// fallback a constante FECHADA si no hay red. Por defecto se usa la oficial
// del BCV (decisión 08-oct-2026); el paralelo queda visible como opción y el
// campo sigue editable para quien tenga una referencia mejor (P2P, etc.).
// Toda tasa se muestra con su fuente y su fecha.

import { useState, useMemo, useEffect } from 'react'
import SignalIcon, { InlineIcon } from '../../components/icons/SignalIcon.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { Card, CardHeader, FormRow, FormGroup, ProgressBar, Alert, PageHeader } from '../../components/ui/index.jsx'
import ProGate from '../../components/ui/ProGate.jsx'
import veConfig from '../../config/multimoneda/ve.js'
import { loadTasaVE, defaultFuenteVE, DEFAULT_FUENTE_VE } from '../../utils/tasaVE.js'
import Money, { useMoney } from '../../components/Money.jsx'
import { fmtRef, fmtDay } from '../Dashboard/RefCurrency.jsx'
import { SOURCE_LABEL } from '../../utils/refRate.js'

const CONFIGS = { VE: veConfig }

export default function Multimoneda() {
  const { settings } = useApp()
  const { t, lang } = useT()
  const { m } = useMoney()
  const country = (settings.country || 'CL').toUpperCase()
  const config = CONFIGS[country]

  const [bs, setBs] = useState('')
  const [usd, setUsd] = useState('')
  const [tasa, setTasa] = useState(config?.tasaDefault ?? '')
  const [fuenteTasa, setFuenteTasa] = useState(DEFAULT_FUENTE_VE)
  const [live, setLive] = useState(null)

  useEffect(() => {
    if (!config) return
    loadTasaVE().then(data => {
      setLive(data)
      // Oficial del BCV por defecto; el paralelo solo si el usuario lo elige.
      const f = defaultFuenteVE(data)
      setFuenteTasa(f)
      setTasa(data[f])
    })
  }, [config])

  // La tasa vacía o inválida NO cae a un default silencioso: bloquea el cálculo.
  const tasaNum = Number(tasa)
  const tasaValida = String(tasa).trim() !== '' && Number.isFinite(tasaNum) && tasaNum > 0

  const result = useMemo(
    () => (config && tasaValida
      ? config.calcular({ saldoBsS: Number(bs) || 0, saldoUSD: Number(usd) || 0, tasa: tasaNum })
      : null),
    [config, bs, usd, tasaNum, tasaValida]
  )

  if (!config) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--th)', fontFamily: 'var(--mono)', fontSize: 13 }}>
        {t('multimoneda.onlyVE')}
      </div>
    )
  }

  function elegirFuente(f) {
    if (f === 'paralelo' && live && !live.paraleloDisponible) return
    setFuenteTasa(f)
    if (live && Number(live[f]) > 0) setTasa(live[f])
  }

  // "Consultada" solo si la tasa que se está usando ES la que vino de la API
  // (con su fecha de consulta). Si el usuario la editó, se dice que es propia.
  const tasaEsLive = Boolean(live && live.source === 'api' && tasaValida && Number(live[fuenteTasa]) === tasaNum)
  const paraleloNoDisponible = Boolean(live && !live.paraleloDisponible)

  const fmtUSD = (n) => fmtRef(n, lang)
  const tasaMeta = !live ? null
    : live.source !== 'api' ? t('multimoneda.tasa.offline', { date: fmtDay(live.ts) })
    : tasaEsLive ? `${t(SOURCE_LABEL[fuenteTasa === 'oficial' ? 'bcv' : 'paralelo'])} · ${t('multimoneda.tasa.live', { host: 've.dolarapi.com', date: fmtDay(live.ts, true) })}`
    : t('multimoneda.tasa.edited')

  return (
    <ProGate feature={t('multimoneda.proFeature')}>
      <div className="stack">
        <PageHeader title={t('multimoneda.titulo')} sub={t('multimoneda.subtitulo')} />

        <Alert type="info">
          {t('multimoneda.disclaimer')}
        </Alert>

        <Card>
          <CardHeader title={t('multimoneda.tasa.title')} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button type="button" aria-pressed={fuenteTasa === 'oficial'} onClick={() => elegirFuente('oficial')} style={{
              flex: 1, minHeight: 44, padding: '9px 12px', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 12,
              border: fuenteTasa === 'oficial' ? '1.5px solid var(--grn)' : '0.5px solid var(--brd2)',
              background: fuenteTasa === 'oficial' ? 'var(--grn-bg)' : 'var(--sur2)',
              color: fuenteTasa === 'oficial' ? 'var(--grn)' : 'var(--tx)',
            }}>
              {t('multimoneda.tasa.oficialBtn')}{live && <span style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, marginTop: 2 }}>{Number(live.oficial).toLocaleString('es-VE')}</span>}
            </button>
            <button type="button" aria-pressed={fuenteTasa === 'paralelo'} onClick={() => elegirFuente('paralelo')} disabled={paraleloNoDisponible} style={{
              flex: 1, minHeight: 44, padding: '9px 12px', borderRadius: 'var(--r)', fontSize: 12,
              cursor: paraleloNoDisponible ? 'not-allowed' : 'pointer',
              opacity: paraleloNoDisponible ? 0.55 : 1,
              border: fuenteTasa === 'paralelo' ? '1.5px solid var(--grn)' : '0.5px solid var(--brd2)',
              background: fuenteTasa === 'paralelo' ? 'var(--grn-bg)' : 'var(--sur2)',
              color: fuenteTasa === 'paralelo' ? 'var(--grn)' : 'var(--tx)',
            }}>
              {t('multimoneda.tasa.paraleloBtn')}{live && (
                <span style={{ display: 'block', fontFamily: paraleloNoDisponible ? 'inherit' : 'var(--mono)', fontSize: paraleloNoDisponible ? 11 : 14, fontWeight: paraleloNoDisponible ? 400 : 700, marginTop: 2 }}>
                  {paraleloNoDisponible ? t('multimoneda.tasa.noDisponible') : Number(live.paralelo).toLocaleString('es-VE')}
                </span>
              )}
            </button>
          </div>
          {tasaMeta && (
            <div style={{ fontSize: 12, color: 'var(--tm)', lineHeight: 1.5, marginBottom: 6 }}>
              <span aria-hidden="true" style={{ color: tasaEsLive ? 'var(--pos)' : 'var(--th)' }}>{tasaEsLive ? '● ' : '○ '}</span>{tasaMeta}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--th)', lineHeight: 1.5, marginBottom: 10 }}>
            {t('multimoneda.tasa.defaultNote')}
          </div>
          {paraleloNoDisponible && (
            <div style={{ fontSize: 11, color: 'var(--th)', lineHeight: 1.5, marginBottom: 10 }}>
              {t('multimoneda.tasa.paraleloWarn')}
            </div>
          )}
          <FormGroup label={t('multimoneda.tasa.inputLabel')}>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={tasa} onChange={e => setTasa(e.target.value)} />
          </FormGroup>
          {!tasaValida && (
            <div style={{ marginTop: 8, background: 'var(--warn-bg)', border: '.5px solid var(--warn)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--warn)', lineHeight: 1.5 }}>
              {t('multimoneda.tasa.invalidWarn')}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title={t('multimoneda.saldos.title')} />
          <FormRow>
            <FormGroup label={t('multimoneda.saldos.bsLabel')}>
              <input type="number" inputMode="decimal" min="0" value={bs} placeholder="0" onChange={e => setBs(e.target.value)} />
            </FormGroup>
            <FormGroup label={t('multimoneda.saldos.usdLabel')}>
              <input type="number" inputMode="decimal" min="0" value={usd} placeholder="0" onChange={e => setUsd(e.target.value)} />
            </FormGroup>
          </FormRow>
        </Card>

        {result && (
          <Card>
            <CardHeader title={t('multimoneda.result.title')} />
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 32, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
                <Money>{fmtUSD(result.totalUSD)}</Money>
              </div>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', marginTop: 6 }}>
                {t('multimoneda.result.breakdown', { bs: m(fmtUSD(result.bsEnUSD)), usd: m(fmtUSD(Number(usd) || 0)) })}
              </div>
            </div>

            <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)' }}>
              <span>{t('multimoneda.result.exposicion')}</span>
              <span>{Math.round(result.exposicionBsPct)}%</span>
            </div>
            <ProgressBar value={result.exposicionBsPct} max={100} color={result.alerta ? 'red' : 'green'} height={6} />
            {result.alerta ? (
              <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 10, lineHeight: 1.5 }}>
                {t('multimoneda.result.alertaText', { pct: Math.round(result.exposicionBsPct), umbral: config.umbralExposicion })}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 10, fontWeight: 600 }}>
                ✓ {t('multimoneda.result.okText')}
              </div>
            )}
          </Card>
        )}
      </div>
    </ProGate>
  )
}
