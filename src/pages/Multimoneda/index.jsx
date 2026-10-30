// src/pages/Multimoneda/index.jsx
// Motor 3 — Panel multimoneda (Venezuela). Gated por país (VE).
// Config-driven: src/config/multimoneda/ve.js
// Tasa consultada (BCV oficial + paralelo) a ve.dolarapi.com, cache 6h,
// fallback a constante FECHADA si no hay red. Por defecto se usa la oficial
// del BCV (decisión 08-oct-2026); el paralelo queda visible como opción y el
// campo sigue editable para quien tenga una referencia mejor (P2P, etc.).
// Toda tasa se muestra con su fuente y su fecha.
// B1 (una sola tasa): el panel arranca con la tasa de referencia del usuario
// (resolveRefRate, la misma del Inicio). Lo consultado en vivo se ofrece como
// opción (botones BCV/paralelo y "Hay una tasa más reciente… Usar"), nunca
// reemplaza la guardada sin un toque.

import { useState, useMemo, useEffect } from 'react'
import SignalIcon, { InlineIcon } from '../../components/icons/SignalIcon.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { Card, CardHeader, FormRow, FormGroup, ProgressBar, Alert, PageHeader } from '../../components/ui/index.jsx'
import ProGate from '../../components/ui/ProGate.jsx'
import veConfig from '../../config/multimoneda/ve.js'
import { loadTasaVE, defaultFuenteVE, DEFAULT_FUENTE_VE } from '../../utils/tasaVE.js'
import Money, { useMoney } from '../../components/Money.jsx'
import { fmtRef, fmtDay, rateSourceText, FreshRate } from '../Dashboard/RefCurrency.jsx'
import { SOURCE_LABEL, resolveRefRate, rateOptions, fresherRate, ratePatch } from '../../utils/refRate.js'
import { fmtPctPoints, currencySymbol } from '../../utils/index.js'

const CONFIGS = { VE: veConfig }

export default function Multimoneda() {
  const { settings, updateSettings, showToast } = useApp()
  const { t, lang } = useT()
  const { m } = useMoney()
  const country = (settings.country || 'CL').toUpperCase()
  const config = CONFIGS[country]
  // Tasa de referencia del usuario (la misma que el Inicio y Ajustes).
  const ref = useMemo(() => resolveRefRate(settings, (k) => { try { return localStorage.getItem(k) } catch { return null } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo los campos de la tasa
    [settings.usdRate, settings.usdRateAt, settings.usdRateSource, settings.country, settings.currency])
  const refFuente = ref?.source === 'paralelo' ? 'paralelo' : ref?.source === 'bcv' ? 'oficial' : null

  const [bs, setBs] = useState('')
  const [usd, setUsd] = useState('')
  const [tasa, setTasa] = useState(ref?.rate ?? config?.tasaDefault ?? '')
  const [fuenteTasa, setFuenteTasa] = useState(ref ? refFuente : DEFAULT_FUENTE_VE)
  const [live, setLive] = useState(null)

  useEffect(() => {
    if (!config) return
    loadTasaVE().then(data => {
      setLive(data)
      // Con tasa de referencia, el panel la conserva: lo consultado queda como
      // opción. Sin ella, la oficial del BCV por defecto (el paralelo, a elección).
      if (ref) return
      const f = defaultFuenteVE(data)
      setFuenteTasa(f)
      setTasa(data[f])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- una consulta al abrir
  }, [config])

  const fresh = useMemo(() => (live ? fresherRate(ref, rateOptions(settings, { ve: live }), 'VE') : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live, ref])
  function usarFresh() {
    const patch = ratePatch(fresh)
    if (!patch) return
    updateSettings?.({ ...settings, ...patch })
    setTasa(fresh.rate)
    setFuenteTasa(fresh.source === 'paralelo' ? 'paralelo' : 'oficial')
    showToast?.(t('refcur.saved'))
  }

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
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--th)', fontFamily: 'var(--sans)', fontSize: 13 }}>
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
  const tasaEsLive = Boolean(live && live.source === 'api' && tasaValida && fuenteTasa && Number(live[fuenteTasa]) === tasaNum)
  const tasaEsRef = Boolean(ref && tasaValida && Number(ref.rate) === tasaNum)
  const paraleloNoDisponible = Boolean(live && !live.paraleloDisponible)

  const fmtUSD = (n) => fmtRef(n, lang, 'USD')
  const tasaMeta = tasaEsRef ? t('refcur.inUse', { desc: rateSourceText(ref, t) })
    : !live ? null
    : live.source !== 'api' ? t('multimoneda.tasa.offline', { date: fmtDay(live.at ?? live.ts) })
    : tasaEsLive ? `${t(SOURCE_LABEL[fuenteTasa === 'oficial' ? 'bcv' : 'paralelo'])} · ${t('multimoneda.tasa.live', { host: 've.dolarapi.com', date: fmtDay(live.at ?? live.ts, true) })}`
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
              {t('multimoneda.tasa.oficialBtn')}{live && <span style={{ display: 'block', fontFamily: 'var(--num)', fontSize: 14, fontWeight: 700, marginTop: 2 }}>{Number(live.oficial).toLocaleString('es-VE')}</span>}
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
                <span style={{ display: 'block', fontFamily: paraleloNoDisponible ? 'inherit' : 'var(--num)', fontSize: paraleloNoDisponible ? 11 : 14, fontWeight: paraleloNoDisponible ? 400 : 700, marginTop: 2 }}>
                  {paraleloNoDisponible ? t('multimoneda.tasa.noDisponible') : Number(live.paralelo).toLocaleString('es-VE')}
                </span>
              )}
            </button>
          </div>
          {tasaMeta && (
            <div style={{ fontSize: 12, color: 'var(--tm)', lineHeight: 1.5, marginBottom: 6 }}>
              <span aria-hidden="true" style={{ color: tasaEsLive || tasaEsRef ? 'var(--pos)' : 'var(--th)' }}>{tasaEsLive || tasaEsRef ? '● ' : '○ '}</span>{tasaMeta}
            </div>
          )}
          <FreshRate fresh={fresh} sym={currencySymbol('VES', lang)} onUse={usarFresh} />
          {fresh && <div style={{ height: 6 }} aria-hidden="true" />}
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
              <div style={{ fontFamily: 'var(--num)', fontSize: 32, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
                <Money>{fmtUSD(result.totalUSD)}</Money>
              </div>
              <div style={{ fontSize: 11, fontFamily: 'var(--sans)', color: 'var(--th)', marginTop: 6 }}>
                {t('multimoneda.result.breakdown', { bs: m(fmtUSD(result.bsEnUSD)), usd: m(fmtUSD(Number(usd) || 0)) })}
              </div>
            </div>

            <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--sans)', color: 'var(--th)' }}>
              <span>{t('multimoneda.result.exposicion')}</span>
              <span>{Math.round(result.exposicionBsPct)}%</span>
            </div>
            <ProgressBar value={result.exposicionBsPct} max={100} color={result.alerta ? 'red' : 'green'} height={6} label={t('multimoneda.result.exposicion')} />
            {result.alerta ? (
              <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 10, lineHeight: 1.5 }}>
                {t('multimoneda.result.alertaText', { pct: fmtPctPoints(Math.round(result.exposicionBsPct)), umbral: fmtPctPoints(config.umbralExposicion) })}
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
