// src/pages/HipotecaUF/index.jsx
// Simulador de dividendo hipotecario — Chile. El pain cotidiano #1 de quien
// tiene crédito en Chile: el dividendo en UF no cambia, pero su valor en CLP
// sube todos los meses porque la UF se reajusta. Solo visible si country=CL.

import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { Card, CardHeader, FormRow, FormGroup, Alert, PageHeader } from '../../components/ui/index.jsx'
import ProGate from '../../components/ui/ProGate.jsx'
import { calcDividendoUF, proyeccionCLP, calcPrepago, CRECIMIENTO_UF_DEFAULT } from '../../utils/hipotecaCL.js'
import { loadIndicadores } from '../../utils/indicadores.js'

const fmtCLP = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`
const fmtUF = (n) => `${(Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 })} UF`

export default function HipotecaUF() {
  const { settings } = useApp()
  const { t } = useT()
  const country = (settings.country || 'CL').toUpperCase()

  if (country !== 'CL') {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--th)', fontFamily: 'var(--mono)', fontSize: 13 }}>
        {t('hipoteca.notAvailable')}
      </div>
    )
  }

  const [uf, setUf] = useState(null)
  const [ufSource, setUfSource] = useState(null)
  useEffect(() => {
    // loadIndicadores() nunca rechaza — internamente cae a FALLBACK y marca
    // source:'fallback' si la API/red falla. El error real a mostrar es ESE
    // estado, no un catch (nunca dispararía).
    loadIndicadores().then(ind => { setUf(ind.uf); setUfSource(ind.source) })
  }, [])

  const [saldo, setSaldo] = useState('')
  const [tasa, setTasa] = useState('4.5')
  const [plazo, setPlazo] = useState('20')
  const [crecimiento, setCrecimiento] = useState(String(CRECIMIENTO_UF_DEFAULT))
  const [prepago, setPrepago] = useState('')

  const dividendoUF = useMemo(
    () => calcDividendoUF(saldo, tasa, plazo),
    [saldo, tasa, plazo]
  )

  const proyeccion = useMemo(
    () => uf && dividendoUF > 0 ? proyeccionCLP(dividendoUF, uf, crecimiento) : [],
    [dividendoUF, uf, crecimiento]
  )

  const impactoPrepago = useMemo(
    () => calcPrepago(saldo, tasa, plazo, prepago),
    [saldo, tasa, plazo, prepago]
  )

  return (
    <ProGate feature={t('hipoteca.proGateFeature')}>
      <div className="stack">
        <PageHeader title={t('hipoteca.title')} sub={t('hipoteca.sub')} />

        <Alert type="info">
          {t('hipoteca.disclaimer')}
        </Alert>

        {ufSource === 'fallback' && (
          <Alert type="warn">
            {t('hipoteca.ufFallback')}
          </Alert>
        )}

        <Card>
          <CardHeader title={t('hipoteca.card.credit')} right={uf && <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)' }}>{t('hipoteca.ufToday', { uf: fmtUF(uf) })}</span>} />
          <FormRow>
            <FormGroup label={t('hipoteca.form.balance')}>
              <input type="number" inputMode="decimal" min="0" value={saldo} placeholder="0"
                onChange={e => setSaldo(e.target.value)} />
            </FormGroup>
            <FormGroup label={t('hipoteca.form.rate')}>
              <input type="number" inputMode="decimal" min="0" step="0.1" value={tasa}
                onChange={e => setTasa(e.target.value)} />
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label={t('hipoteca.form.term')}>
              <input type="number" inputMode="decimal" min="1" value={plazo}
                onChange={e => setPlazo(e.target.value)} />
            </FormGroup>
            <FormGroup label={t('hipoteca.form.ufGrowth')}>
              <input type="number" inputMode="decimal" min="0" step="0.1" value={crecimiento}
                onChange={e => setCrecimiento(e.target.value)} />
            </FormGroup>
          </FormRow>
        </Card>

        {dividendoUF > 0 && uf && (
          <Card>
            <CardHeader title={t('hipoteca.card.dividend')} />
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 34, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
                {fmtCLP(dividendoUF * uf)}
              </div>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', marginTop: 6 }}>
                {t('hipoteca.perMonthToday', { uf: fmtUF(dividendoUF) })}
              </div>
            </div>

            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10, borderTop: '.5px solid var(--brd)', paddingTop: 12 }}>
              {t('hipoteca.howItRises')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
              {proyeccion.map(p => (
                <div key={p.anios} style={{ background: 'var(--sur2)', border: '.5px solid var(--brd)', borderRadius: 'var(--r)', padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--th)', marginBottom: 4 }}>{t(p.anios === 1 ? 'hipoteca.inYear' : 'hipoteca.inYears', { n: p.anios })}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: 'var(--tx)' }}>{fmtCLP(p.clp)}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {dividendoUF > 0 && (
          <Card>
            <CardHeader title={t('hipoteca.card.prepay')} />
            <FormRow>
              <FormGroup label={t('hipoteca.form.prepayAmount')}>
                <input type="number" inputMode="decimal" min="0" value={prepago} placeholder="0"
                  onChange={e => setPrepago(e.target.value)} />
              </FormGroup>
            </FormRow>
            {impactoPrepago.mesesAhorrados > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                <div style={{ background: 'var(--grn-tint)', border: '.5px solid color-mix(in srgb, var(--grn) 35%, transparent)', borderRadius: 'var(--r)', padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--th)', marginBottom: 4 }}>{t('hipoteca.shortenBy')}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: 'var(--grn)' }}>
                    {t('hipoteca.yearsMonths', { y: Math.floor(impactoPrepago.mesesAhorrados / 12), m: impactoPrepago.mesesAhorrados % 12 })}
                  </div>
                </div>
                <div style={{ background: 'var(--grn-tint)', border: '.5px solid color-mix(in srgb, var(--grn) 35%, transparent)', borderRadius: 'var(--r)', padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--th)', marginBottom: 4 }}>{t('hipoteca.netInterestSaved')}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: 'var(--grn)' }}>
                    {fmtUF(impactoPrepago.interesesAhorradosNetosUF)}{uf && <span style={{ fontSize: 12, fontWeight: 400 }}> · {fmtCLP(impactoPrepago.interesesAhorradosNetosUF * uf)}</span>}
                  </div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--th)', marginTop: 6, lineHeight: 1.5 }}>
                    {t('hipoteca.interestBreakdown', { interest: fmtUF(impactoPrepago.interesesAhorradosUF), fee: fmtUF(impactoPrepago.comisionPrepagoUF) })}
                  </div>
                </div>
              </div>
            )}
            {impactoPrepago.mesesAhorrados > 0 && (
              <div style={{ marginTop: 12, fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--th)', lineHeight: 1.6, padding: '8px 10px', background: 'var(--sur2)', border: '.5px solid var(--brd)', borderRadius: 'var(--r)' }}>
                {t('hipoteca.feeNotePre')} <strong>{t('hipoteca.feeNoteBold')}</strong>{t('hipoteca.feeNotePost')}
              </div>
            )}
          </Card>
        )}
      </div>
    </ProGate>
  )
}
