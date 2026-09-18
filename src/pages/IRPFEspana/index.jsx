// src/pages/IRPFEspana/index.jsx
// Simulador IRPF — España. Sustituye al plan de pensiones como tarjeta
// protagonista (el plan de pensiones colapsó tras la reforma que bajó el
// tope deducible de €8.000 a €1.500 — ahorro fiscal medio real €285-705/año).
// El pain real es entender la retención mensual y la cuota anual. Dos modos:
// empleado (retención en nómina) y autónomo (Modelo 130 trimestral).
// Solo visible si settings.country === 'ES'.

import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { Card, CardHeader, FormRow, FormGroup, Alert, PageHeader } from '../../components/ui/index.jsx'
import ProGate from '../../components/ui/ProGate.jsx'
import { calcIRPFEmpleado, calcIRPFAutonomo, TRAMOS_IRPF_2026 } from '../../utils/irpfES.js'

const fmtEUR = (n) => `€${Math.round(Number(n) || 0).toLocaleString('es-ES')}`

export default function IRPFEspana() {
  const { settings } = useApp()
  const { t } = useT()
  const country = (settings.country || 'CL').toUpperCase()

  // Reglas de hooks: TODOS los hooks van antes de cualquier return condicional.
  // Si settings.country cambia con el componente montado, un hook después del
  // return hace que React renderice menos hooks de los esperados y la pantalla
  // queda en blanco. Referencia de estructura correcta: pages/Steuer/index.jsx.
  const [modo, setModo] = useState('empleado')

  if (country !== 'ES') {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--th)', fontFamily: 'var(--mono)', fontSize: 13 }}>
        {t('irpfes.onlyES')}
      </div>
    )
  }

  return (
    <ProGate feature={t('irpfes.proGateFeature')}>
      <div className="stack">
        <PageHeader title={t('irpfes.title')} sub={t('irpfes.sub')} />

        <Alert type="info">
          ⚠ {t('irpfes.disclaimer')}
        </Alert>

        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <button type="button" onClick={() => setModo('empleado')} aria-pressed={modo === 'empleado'} style={{
            flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
            border: modo === 'empleado' ? '1.5px solid var(--grn)' : '0.5px solid var(--brd2)',
            background: modo === 'empleado' ? 'var(--grn-bg)' : 'var(--sur2)',
            color: modo === 'empleado' ? 'var(--grn)' : 'var(--tx)',
          }}>{t('irpfes.mode.empleado')}</button>
          <button type="button" onClick={() => setModo('autonomo')} aria-pressed={modo === 'autonomo'} style={{
            flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
            border: modo === 'autonomo' ? '1.5px solid var(--grn)' : '0.5px solid var(--brd2)',
            background: modo === 'autonomo' ? 'var(--grn-bg)' : 'var(--sur2)',
            color: modo === 'autonomo' ? 'var(--grn)' : 'var(--tx)',
          }}>{t('irpfes.mode.autonomo')}</button>
        </div>

        {modo === 'empleado' ? <EmpleadoCard /> : <AutonomoCard />}

        <Card>
          <CardHeader title={t('irpfes.tramos.title')} />
          {TRAMOS_IRPF_2026.map((tr, i) => {
            const desde = i === 0 ? 0 : TRAMOS_IRPF_2026[i - 1].hasta
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', color: 'var(--tx)' }}>
                <span>{fmtEUR(desde)} — {tr.hasta === Infinity ? t('irpfes.tramos.enAdelante') : fmtEUR(tr.hasta)}</span>
                <span style={{ fontFamily: 'var(--mono)' }}>{(tr.tasa * 100).toFixed(0)}%</span>
              </div>
            )
          })}
        </Card>
      </div>
    </ProGate>
  )
}

function EmpleadoCard() {
  const { t } = useT()
  const [bruto, setBruto] = useState('')
  const [hijos, setHijos] = useState('0')

  const result = useMemo(() => calcIRPFEmpleado({ brutoAnual: bruto, numHijos: hijos }), [bruto, hijos])

  return (
    <Card>
      <CardHeader title={t('irpfes.empleado.title')} />
      <FormRow>
        <FormGroup label={t('irpfes.empleado.brutoLabel')}>
          <input type="number" inputMode="decimal" min="0" value={bruto} placeholder="0" onChange={e => setBruto(e.target.value)} />
        </FormGroup>
        <FormGroup label={t('irpfes.empleado.hijosLabel')}>
          <select value={hijos} onChange={e => setHijos(e.target.value)}>
            {[0, 1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </FormGroup>
      </FormRow>

      {result && (
        <>
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 34, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
              {fmtEUR(result.retencionMensual)}
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', marginTop: 6 }}>
              {t('irpfes.empleado.retencionSub', { pct: (result.tipoEfectivo * 100).toFixed(1) })}
            </div>
          </div>
          <div style={{ marginTop: 4, borderTop: '.5px solid var(--brd)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
              <span>{t('irpfes.empleado.netoMensual')}</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmtEUR(result.netoMensual)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
              <span>{t('irpfes.empleado.ssParte')}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{fmtEUR(result.seguridadSocialMensual)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
              <span>{t('irpfes.empleado.cuotaAnual')}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{fmtEUR(result.cuotaAnual)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
              <span>{t('irpfes.empleado.reduccionTrabajo')}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>−{fmtEUR(result.reduccionTrabajo)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
              <span>{t('irpfes.empleado.baseLiquidable')}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{fmtEUR(result.baseLiquidable)}</span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', lineHeight: 1.6, marginTop: 14, padding: '10px 12px', background: 'var(--sur2)', borderRadius: 8, border: '.5px solid var(--brd)' }}>
            {t('irpfes.empleado.footnote', { ss: fmtEUR(result.seguridadSocial), minimo: fmtEUR(result.minimoPersonalFamiliar) })}
          </div>
        </>
      )}
    </Card>
  )
}

function AutonomoCard() {
  const { t } = useT()
  const [ingresos, setIngresos] = useState('')
  const [gastos, setGastos] = useState('')

  const result = useMemo(() => calcIRPFAutonomo({ ingresosTrimestre: ingresos, gastosTrimestre: gastos }), [ingresos, gastos])

  return (
    <Card>
      <CardHeader title={t('irpfes.autonomo.title')} />
      <FormRow>
        <FormGroup label={t('irpfes.autonomo.ingresosLabel')}>
          <input type="number" inputMode="decimal" min="0" value={ingresos} placeholder="0" onChange={e => setIngresos(e.target.value)} />
        </FormGroup>
        <FormGroup label={t('irpfes.autonomo.gastosLabel')}>
          <input type="number" inputMode="decimal" min="0" value={gastos} placeholder="0" onChange={e => setGastos(e.target.value)} />
        </FormGroup>
      </FormRow>
      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 34, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
          {fmtEUR(result.pagoFraccionado)}
        </div>
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', marginTop: 6 }}>
          {t('irpfes.autonomo.pagarSub', { pct: (result.tasa * 100).toFixed(0) })}
        </div>
      </div>
      <div style={{ marginTop: 4, borderTop: '.5px solid var(--brd)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
          <span>{t('irpfes.autonomo.rendimientoNeto')}</span>
          <span style={{ fontFamily: 'var(--mono)' }}>{fmtEUR(result.rendimientoNeto)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
          <span>{t('irpfes.autonomo.gastosDificilJust')}</span>
          <span style={{ fontFamily: 'var(--mono)' }}>{fmtEUR(result.gastosDificilJust)}</span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', lineHeight: 1.6, marginTop: 14, padding: '10px 12px', background: 'var(--sur2)', borderRadius: 8, border: '.5px solid var(--brd)' }}>
        {t('irpfes.autonomo.footnote1')}
        <br /><br />
        {t('irpfes.autonomo.footnote2')}
      </div>
    </Card>
  )
}
