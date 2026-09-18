// src/pages/ResicoMX/index.jsx
// Planificador RESICO — México. Sustituye a Afore voluntario como tarjeta
// protagonista para MX (Afore voluntario solo lo usa 7.9% de los mexicanos;
// RESICO lo usa cada freelancer, arrendador y profesionista independiente
// que declara). Solo visible si settings.country === 'MX'.

import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { Card, CardHeader, FormRow, FormGroup, Alert, PageHeader } from '../../components/ui/index.jsx'
import ProGate from '../../components/ui/ProGate.jsx'
import { calcResico, TRAMOS_RESICO, TOPE_ANUAL_RESICO, RETENCION_PERSONA_MORAL } from '../../utils/resicoMX.js'
import { fmtFixed } from '../../utils/index.js'

const fmtMXN = (n) => fmtFixed(n, 'es-MX')

// RESICO personas físicas cubre actividad empresarial, profesional y
// arrendamiento (Art. 113-E LISR). El sueldo de nómina tributa por sueldos y
// salarios, y las ventas de activos / rendimientos de inversión van por su
// propio régimen — ninguno de los tres entra en esta base.
const CATEGORIAS_RESICO = ['Freelance', 'Negocio propio', 'Arriendo', 'Honorarios', 'Consultoría']

const esIngresoResico = (r) =>
  CATEGORIAS_RESICO.some(c => (r?.category || '').toLowerCase().includes(c.toLowerCase()))

export default function ResicoMX() {
  const { settings, incomes } = useApp()
  const { t } = useT()
  const country = (settings.country || 'CL').toUpperCase()

  const activeMonth = settings.activeMonth || new Date().toISOString().slice(0, 7)
  const activeYear = activeMonth.slice(0, 4)

  // Ingreso facturable del mes activo — solo categorías que tributan por RESICO.
  const ingresoEstimado = useMemo(() => Math.round((incomes || [])
    .filter(r => String(r?.date || '').startsWith(activeMonth) && esIngresoResico(r))
    .reduce((s, r) => s + (Number(r.amount) || 0), 0)), [incomes, activeMonth])

  // Ingresos RESICO acumulados del ejercicio en curso — esta es la base real
  // contra la que el SAT mide el tope de $3.5M, no una proyección de un mes.
  const ingresoAcumuladoAnual = useMemo(() => Math.round((incomes || [])
    .filter(r => String(r?.date || '').startsWith(activeYear) && esIngresoResico(r))
    .reduce((s, r) => s + (Number(r.amount) || 0), 0)), [incomes, activeYear])

  const [ingreso, setIngreso] = useState('')
  // Marca si el usuario editó el ingreso a mano (para no pisarlo con el auto-relleno).
  const [ingresoTouched, setIngresoTouched] = useState(false)
  const [personaMoral, setPersonaMoral] = useState(false)

  // Auto-rellenar desde los ingresos cargados. Va en un efecto y no en el
  // inicializador de useState porque `incomes` se hidrata async desde IndexedDB:
  // en el primer render todavía está vacío y el inicializador solo corre una vez.
  useEffect(() => {
    if (!ingresoTouched && ingresoEstimado > 0) setIngreso(String(ingresoEstimado))
  }, [ingresoEstimado, ingresoTouched])

  const result = useMemo(
    () => calcResico(ingreso, {
      facturaAPersonaMoral: personaMoral,
      ingresoAcumuladoAnual,
    }),
    [ingreso, personaMoral, ingresoAcumuladoAnual]
  )

  if (country !== 'MX') {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--th)', fontFamily: 'var(--mono)', fontSize: 13 }}>
        {t('resicomx.onlyMX')}
      </div>
    )
  }

  const haySaldoAFavor = result && result.saldoAFavor > 0

  return (
    <ProGate feature={t('resicomx.proFeature')}>
      <div className="stack">
        <PageHeader title={t('resicomx.title')} sub={t('resicomx.sub')} />

        <Alert type="info">
          ⚠ {t('resicomx.disclaimer')}
        </Alert>

        <Card>
          <CardHeader title={t('resicomx.income.title')} right={<span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)' }}>{activeMonth}</span>} />
          <FormRow>
            <FormGroup label={t('resicomx.income.label')}>
              <input type="number" inputMode="decimal" min="0" value={ingreso} placeholder="0"
                onChange={e => { setIngresoTouched(true); setIngreso(e.target.value) }} />
            </FormGroup>
          </FormRow>

          {ingresoEstimado > 0 && (
            <div style={{ marginTop: 2, marginBottom: 10, fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--th)', lineHeight: 1.5 }}>
              {!ingresoTouched
                ? <>✓ {t('resicomx.income.autoNote')}</>
                : <>{t('resicomx.income.suggestedNote', { v: fmtMXN(ingresoEstimado) })} <button type="button" style={{ color: 'var(--grn)', cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 0, padding: 0, font: 'inherit' }} onClick={() => { setIngresoTouched(false); setIngreso(String(ingresoEstimado)) }}>{t('resicomx.income.useAuto')}</button></>}
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', padding: '10px 12px', background: 'var(--sur2)', border: '.5px solid var(--brd)', borderRadius: 8 }}>
            <input type="checkbox" checked={personaMoral} onChange={e => setPersonaMoral(e.target.checked)}
              style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12, color: 'var(--tx)', lineHeight: 1.5 }}>
              {t('resicomx.personaMoral.label')}
              <span style={{ display: 'block', fontSize: 11, color: 'var(--th)', marginTop: 2 }}>
                {t('resicomx.personaMoral.hint', { pct: (RETENCION_PERSONA_MORAL * 100).toFixed(2) })}
              </span>
            </span>
          </label>
        </Card>

        {result && (
          <Card>
            <CardHeader title={t('resicomx.result.title')} />
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                {haySaldoAFavor ? t('resicomx.result.saldoFavor') : t('resicomx.result.aPagarSAT')}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 34, fontWeight: 700, color: haySaldoAFavor ? 'var(--pos)' : 'var(--accent)', lineHeight: 1 }}>
                {fmtMXN(haySaldoAFavor ? result.saldoAFavor : result.aPagar)}
              </div>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', marginTop: 6 }}>
                {t('resicomx.result.tasaSub', { pct: (result.tasa * 100).toFixed(2), neto: fmtMXN(result.neto) })}
              </div>
            </div>

            {/* Desglose: causado − retención = a pagar / saldo a favor */}
            <div style={{ border: '.5px solid var(--brd)', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', fontSize: 12 }}>
                <span style={{ color: 'var(--th)' }}>{t('resicomx.result.causado')}</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--tx)', fontWeight: 600 }}>{fmtMXN(result.isrCausado)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', fontSize: 12, borderTop: '.5px solid var(--brd)' }}>
                <span style={{ color: 'var(--th)' }}>
                  {t('resicomx.result.retencionLabel', { pct: (RETENCION_PERSONA_MORAL * 100).toFixed(2) })}
                </span>
                <span style={{ fontFamily: 'var(--mono)', color: result.retencion > 0 ? 'var(--tx)' : 'var(--th)', fontWeight: 600 }}>
                  {result.retencion > 0 ? `− ${fmtMXN(result.retencion)}` : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', fontSize: 12, borderTop: '.5px solid var(--brd)', background: haySaldoAFavor ? 'var(--pos-bg)' : 'var(--sur2)' }}>
                <span style={{ color: haySaldoAFavor ? 'var(--pos)' : 'var(--tx)', fontWeight: 600 }}>
                  {haySaldoAFavor ? t('resicomx.result.saldoFavor') : t('resicomx.result.aPagarShort')}
                </span>
                <span style={{ fontFamily: 'var(--mono)', color: haySaldoAFavor ? 'var(--pos)' : 'var(--tx)', fontWeight: 700 }}>
                  {fmtMXN(haySaldoAFavor ? result.saldoAFavor : result.aPagar)}
                </span>
              </div>
            </div>

            {result.conRetencion && (
              <div style={{ fontSize: 11, color: 'var(--th)', lineHeight: 1.6, marginBottom: 14 }}>
                {haySaldoAFavor
                  ? t('resicomx.result.saldoFavorNote', { tasa: (result.tasa * 100).toFixed(2), ret: (RETENCION_PERSONA_MORAL * 100).toFixed(2) })
                  : t('resicomx.result.aPagarNote', { v: fmtMXN(result.retencion) })}
              </div>
            )}

            {result.siguienteTasa && result.margenEnTramo < result.ingreso * 0.15 && (
              <div style={{ background: 'var(--warn-bg)', border: '.5px solid var(--warn)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--warn)', marginBottom: 14, lineHeight: 1.6 }}>
                ⚠ {t('resicomx.result.warnTramo', { v: fmtMXN(result.margenEnTramo), pct: (result.siguienteTasa * 100).toFixed(2) })}
              </div>
            )}

            {result.superaTope && (
              <div style={{ background: 'var(--red-bg)', border: '.5px solid var(--red)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--red)', marginBottom: 14, lineHeight: 1.6 }}>
                {result.topeEsProyeccion
                  ? <>⚠ {t('resicomx.result.projWarn', { v: fmtMXN(result.ingresoAnualProyectado), tope: fmtMXN(TOPE_ANUAL_RESICO) })}</>
                  : <>⚠ {t('resicomx.result.overTopeWarn', { year: activeYear, v: fmtMXN(result.baseTope), tope: fmtMXN(TOPE_ANUAL_RESICO) })}</>}
              </div>
            )}

            {!result.superaTope && !result.topeEsProyeccion && (
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', marginBottom: 14, lineHeight: 1.6 }}>
                {t('resicomx.result.acumuladoNote', { year: activeYear, v: fmtMXN(result.baseTope), tope: fmtMXN(TOPE_ANUAL_RESICO), pct: Math.round((result.baseTope / TOPE_ANUAL_RESICO) * 100) })}
              </div>
            )}

            <div style={{ marginTop: 4, borderTop: '.5px solid var(--brd)', paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                {t('resicomx.tramos.title')}
              </div>
              {TRAMOS_RESICO.map((tr, i) => {
                const desde = i === 0 ? 0 : TRAMOS_RESICO[i - 1].hasta
                const activo = i === result.tramoIdx
                const esUltimo = i === TRAMOS_RESICO.length - 1
                // Caso límite: el ingreso ya excede la tabla. El tramo se marca
                // activo por fallback, pero el rango impreso mentiría.
                const rangoFueraDeTabla = activo && esUltimo && result.fueraDeTabla
                return (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 8px', marginBottom: 2,
                    borderRadius: 6, background: activo ? 'var(--grn-tint)' : 'transparent',
                    color: activo ? 'var(--grn)' : 'var(--tx)', fontWeight: activo ? 600 : 400,
                  }}>
                    <span>
                      {rangoFueraDeTabla
                        ? t('resicomx.tramos.fuera', { v: fmtMXN(tr.hasta) })
                        : <>{fmtMXN(desde)} — {fmtMXN(tr.hasta)}</>}
                    </span>
                    <span style={{ fontFamily: 'var(--mono)' }}>{(tr.tasa * 100).toFixed(2)}%</span>
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>
    </ProGate>
  )
}
