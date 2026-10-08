// src/pages/Deducciones/index.jsx
// Motor 1 — Optimizador de gastos deducibles. Gated por país (EC/PE).
// Config-driven: toda particularidad vive en src/config/deducciones/{pais}.js

import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { Card, CardHeader, FormRow, FormGroup, ProgressBar, Alert, PageHeader } from '../../components/ui/index.jsx'
import ProGate from '../../components/ui/ProGate.jsx'
import { getDeduccionesConfig, autofillGastos, calcDeducciones } from '../../utils/deduccionesEngine.js'
import { currentMonth } from '../../utils/index.js'

export default function Deducciones() {
  const { settings, expenses, incomes } = useApp()
  const { t } = useT()
  const country = (settings.country || 'CL').toUpperCase()
  const config = getDeduccionesConfig(country)
  const activeMonth = settings.activeMonth || currentMonth()
  const year = activeMonth.slice(0, 4)

  // Reglas de hooks: TODOS los hooks van antes del guard de país. Si
  // settings.country cambia con el componente montado, un hook después del
  // return hace que React renderice menos hooks de los esperados y la pantalla
  // queda en blanco. Referencia de estructura correcta: pages/Steuer/index.jsx.

  // Autollenado de gastos del año desde lo ya registrado
  const autofilled = useMemo(
    () => (config ? autofillGastos(config, expenses, year) : {}),
    [config, expenses, year]
  )

  // Ingreso anual estimado desde ingresos del año (si el config lo necesita)
  const ingresoEstimado = useMemo(() => {
    if (!config?.needsIngreso) return 0
    return Math.round((incomes || [])
      .filter(r => String(r?.date || '').startsWith(year))
      .reduce((s, r) => s + (Number(r.amount) || 0), 0))
  }, [incomes, year, config?.needsIngreso])

  const [gastos, setGastos] = useState(autofilled)
  const [ingreso, setIngreso] = useState(ingresoEstimado || '')
  const [extra, setExtra] = useState(config?.extraInput?.default ?? '')

  function setGasto(key, val) {
    setGastos(p => ({ ...p, [key]: val === '' ? 0 : Number(val) }))
  }

  const result = useMemo(() => {
    if (!config) return null
    const inputs = { gastosPorCat: gastos }
    if (config.needsIngreso) inputs.ingresoAnual = Number(ingreso) || 0
    if (config.extraInput) inputs[config.extraInput.key] = Number(extra) || 0
    return calcDeducciones(config, inputs)
  }, [config, gastos, ingreso, extra])

  // Guard: país sin módulo
  if (!config) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--th)', fontFamily: 'var(--mono)', fontSize: 13 }}>
        {t('deducciones.notAvailable')}
      </div>
    )
  }

  const sym = config.sym

  const fmt = (n) => `${sym}${(Number(n) || 0).toLocaleString('es-' + (config.pais === 'EC' ? 'EC' : 'PE'), { maximumFractionDigits: 0 })}`

  return (
    <ProGate feature={t('deducciones.proGateFeature')}>
      <div className="stack">
        <PageHeader title={config.titulo} sub={config.subtitulo} />

        <Alert type="info">
          ⚠ {config.disclaimer} <strong>Cifras {config.vigencia} ({config.fuente}).</strong>
        </Alert>

        {/* Inputs */}
        <Card>
          <CardHeader title={t('deducciones.card.yourYearData')} right={<span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)' }}>{year}</span>} />

          {config.needsIngreso && (
            <FormRow>
              <FormGroup label={config.ingresoLabel || 'Ingreso anual'}>
                <input type="number" inputMode="decimal" min="0" value={ingreso} placeholder="0"
                  onChange={e => setIngreso(e.target.value)} />
              </FormGroup>
              {config.extraInput && (
                <FormGroup label={config.extraInput.label}>
                  <select value={extra} onChange={e => setExtra(e.target.value)}>
                    {config.extraInput.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </FormGroup>
              )}
            </FormRow>
          )}

          {!config.needsIngreso && config.extraInput && (
            <FormRow>
              <FormGroup label={config.extraInput.label}>
                <select value={extra} onChange={e => setExtra(e.target.value)}>
                  {config.extraInput.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </FormGroup>
            </FormRow>
          )}

          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '12px 0 8px' }}>
            {t('deducciones.deductibleExpenses')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {config.categorias.map(c => (
              <FormGroup key={c.key} label={c.label}>
                <input type="number" inputMode="decimal" min="0" value={gastos[c.key] ?? 0}
                  onChange={e => setGasto(c.key, e.target.value)} />
              </FormGroup>
            ))}
          </div>
        </Card>

        {/* Resultado */}
        {result && (
          <Card>
            <CardHeader title={result.tituloResultado} />
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 34, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
                {fmt(result.ahorro)}
              </div>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', marginTop: 6 }}>
                {result.resumen}
              </div>
            </div>

            {/* Progreso al tope */}
            <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)' }}>
              <span>{t('deducciones.capUsage')}</span>
              <span>{Math.round(result.topePct)}%</span>
            </div>
            <ProgressBar value={result.topePct} max={100} color={result.topePct >= 100 ? 'green' : 'amber'} height={6} />
            {result.faltaParaTope > 0 ? (
              <div style={{ fontSize: 12, color: 'var(--tm)', marginTop: 10, lineHeight: 1.5 }}>
                {t(config.needsIngreso ? 'deducciones.remainingWithIncome' : 'deducciones.remainingNoIncome', { amt: fmt(result.faltaParaTope) })}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 10, fontWeight: 600 }}>
                {t('deducciones.capReached')}
              </div>
            )}

            {/* Desglose */}
            <div style={{ marginTop: 16, borderTop: '.5px solid var(--brd)', paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>{t('deducciones.breakdown')}</div>
              {result.desglose.map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: 'var(--tx)' }}>
                  <span>{d.label}{d.rate ? <span style={{ color: 'var(--th)', fontFamily: 'var(--mono)', fontSize: 11 }}> · {t('deducciones.deductiblePct', { pct: Math.round(d.rate * 100) })}</span> : null}</span>
                  <span style={{ fontFamily: 'var(--mono)' }}>
                    {fmt(d.monto)}{d.aporta != null ? <span style={{ color: 'var(--accent)' }}> → {fmt(d.aporta)}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {config.eventos && <EventosCard config={config} fmt={fmt} />}
      </div>
    </ProGate>
  )
}

// Tarjeta genérica de "ingresos extra estacionales" (décimos, gratificación, CTS…).
// Config-driven igual que el resto: cada país declara sus items y su fórmula.
function EventosCard({ config, fmt }) {
  const ev = config.eventos
  const [sueldo, setSueldo] = useState('')
  const [extra, setExtra] = useState(ev.extraField?.default ?? '')
  const [regimen, setRegimen] = useState(ev.regimenField?.default ?? '')

  const s = Number(sueldo) || 0

  return (
    <Card>
      <CardHeader title={ev.titulo} />
      <div style={{ fontSize: 12, color: 'var(--tm)', lineHeight: 1.6, marginBottom: 14 }}>{ev.sub}</div>

      <FormRow>
        <FormGroup label={ev.sueldoLabel}>
          <input type="number" inputMode="decimal" min="0" value={sueldo} placeholder="0"
            onChange={e => setSueldo(e.target.value)} />
        </FormGroup>
        {ev.extraField && (
          <FormGroup label={ev.extraField.label}>
            <select value={extra} onChange={e => setExtra(e.target.value)}>
              {ev.extraField.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </FormGroup>
        )}
      </FormRow>

      {ev.regimenField && (
        <FormRow>
          <FormGroup label={ev.regimenField.label}>
            <select value={regimen} onChange={e => setRegimen(e.target.value)}>
              {ev.regimenField.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </FormGroup>
        </FormRow>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
        {ev.items.map(item => {
          const monto = s > 0 ? item.calc(s, extra, regimen) : 0
          return (
            <div key={item.key} style={{ background: 'var(--sur2)', border: '.5px solid var(--brd)', borderRadius: 'var(--r)', padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)', marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--th)', marginBottom: 10 }}>{item.when}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
                {fmt(monto)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 8, lineHeight: 1.5 }}>{item.info}</div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
