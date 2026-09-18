// src/pages/IRSPortugal/index.jsx
// Simulador IRS — Portugal. Pasa a ser la tarjeta protagonista (el PPR tiene
// tracción cultural — 2,2M subscritores — pero solo 7% deduce y el ahorro
// medio real es €161/año; el pain diario es entender el IRS anual). El PPR
// (página PPR existente) se mantiene intacto como segundo item de nav.
// Solo visible si settings.country === 'PT'.

import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { Card, CardHeader, FormRow, FormGroup, Alert, PageHeader, SegmentedControl } from '../../components/ui/index.jsx'
import ProGate from '../../components/ui/ProGate.jsx'
import { calcIRSEmpregado, calcIRSRecibosVerdes, ESCALOES_IRS_2026, MINIMO_EXISTENCIA } from '../../utils/irsPT.js'
import { fmtFixed } from '../../utils/index.js'

const fmtEUR = (n) => fmtFixed(n, 'pt-PT', '€')

export default function IRSPortugal() {
  const { settings } = useApp()
  const { t } = useT()
  const country = (settings.country || 'CL').toUpperCase()

  // Regras dos hooks: TODOS os hooks antes de qualquer return condicional.
  // Se settings.country mudar com o componente montado, um hook depois do
  // return faz o React renderizar menos hooks do que esperava e o ecrã fica
  // em branco. Referência de estrutura correta: pages/Steuer/index.jsx.
  const [modo, setModo] = useState('empregado')

  if (country !== 'PT') {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--th)', fontFamily: 'var(--mono)', fontSize: 13 }}>
        {t('irsPT.notAvailable')}
      </div>
    )
  }

  return (
    <ProGate feature={t('irsPT.proGateFeature')}>
      <div className="stack">
        <PageHeader title={t('irsPT.title')} sub={t('irsPT.sub')} />

        <Alert type="info">
          ⚠ {t('irsPT.disclaimer')}
        </Alert>

        <SegmentedControl value={modo} onChange={setModo} options={[
          { value: 'empregado', label: t('irsPT.tab.employed') },
          { value: 'verdes', label: t('irsPT.tab.greenReceipts') },
        ]} />

        {modo === 'empregado' ? <EmpregadoCard t={t} /> : <RecibosVerdesCard t={t} />}

        <Card>
          <CardHeader title={t('irsPT.card.brackets')} />
          {ESCALOES_IRS_2026.map((e, i) => {
            const desde = i === 0 ? 0 : ESCALOES_IRS_2026[i - 1].hasta
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', color: 'var(--tx)' }}>
                <span>{fmtEUR(desde)} — {e.hasta === Infinity ? t('irsPT.andAbove') : fmtEUR(e.hasta)}</span>
                <span style={{ fontFamily: 'var(--mono)' }}>{(e.tasa * 100).toFixed(1)}%</span>
              </div>
            )
          })}
        </Card>
      </div>
    </ProGate>
  )
}

function EmpregadoCard({ t }) {
  const [bruto, setBruto] = useState('')
  const result = useMemo(() => calcIRSEmpregado({ brutoAnual: bruto }), [bruto])

  return (
    <Card>
      <CardHeader title={t('irsPT.card.yourSalary')} />
      <FormRow>
        <FormGroup label={t('irsPT.form.grossAnnual')}>
          <input type="number" inputMode="decimal" min="0" value={bruto} placeholder="0" onChange={e => setBruto(e.target.value)} />
        </FormGroup>
      </FormRow>

      {result && result.isento && (
        <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, textAlign: 'center', padding: '12px 0' }}>
          {t('irsPT.exempt', { min: fmtEUR(MINIMO_EXISTENCIA) })}
        </div>
      )}

      {result && (
        <>
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 34, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
              {fmtEUR(result.liquidoMensal)}
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', marginTop: 6 }}>
              {t('irsPT.netMonthlyLabel', { rate: (result.taxaEfetiva * 100).toFixed(1) })}
            </div>
          </div>
          <div style={{ marginTop: 4, borderTop: '.5px solid var(--brd)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
              <span>{t('irsPT.row.irsWithholding')}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>−{fmtEUR(result.retencaoMensal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
              <span>{t('irsPT.row.socialSecurity')}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>−{fmtEUR(result.ssMensal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
              <span>{t('irsPT.row.annualIRS')}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{fmtEUR(result.irsAnual)}</span>
            </div>
            {result.solidariedade > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
                <span>{t('irsPT.row.solidarity')}</span>
                <span style={{ fontFamily: 'var(--mono)' }}>{fmtEUR(result.solidariedade)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
              <span>{t('irsPT.row.specificDeduction')}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{fmtEUR(result.deducaoEspecifica)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
              <span>{t('irsPT.row.taxableIncome')}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{fmtEUR(result.rendimentoColetavel)}</span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', lineHeight: 1.6, marginTop: 14, padding: '10px 12px', background: 'var(--sur2)', borderRadius: 8, border: '.5px solid var(--brd)' }}>
            {t('irsPT.empregadoNote', {
              min: fmtEUR(MINIMO_EXISTENCIA),
              ssNote: result.deducaoPorSS ? t('irsPT.ssNoteYes') : t('irsPT.ssNoteNo'),
            })}
          </div>
        </>
      )}
    </Card>
  )
}

function RecibosVerdesCard({ t }) {
  const [faturacao, setFaturacao] = useState('')
  const result = useMemo(() => calcIRSRecibosVerdes({ faturacaoAnual: faturacao }), [faturacao])

  return (
    <Card>
      <CardHeader title={t('irsPT.card.simplifiedRegime')} />
      <FormRow>
        <FormGroup label={t('irsPT.form.annualBilling')}>
          <input type="number" inputMode="decimal" min="0" value={faturacao} placeholder="0" onChange={e => setFaturacao(e.target.value)} />
        </FormGroup>
      </FormRow>

      {result && (
        <>
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 34, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
              {fmtEUR(result.irsAnual)}
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', marginTop: 6 }}>
              {t('irsPT.annualIRSEstimated', { rate: (result.taxaEfetiva * 100).toFixed(1) })}
            </div>
          </div>
          <div style={{ marginTop: 4, borderTop: '.5px solid var(--brd)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
              <span>{t('irsPT.row.taxableBase')}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{fmtEUR(result.baseTributavel)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
              <span>{t('irsPT.row.ssDeduction')}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>−{fmtEUR(result.deducaoSS)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
              <span>{t('irsPT.row.taxableIncome')}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{fmtEUR(result.rendimentoColetavel)}</span>
            </div>
            {result.solidariedade > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
                <span>{t('irsPT.row.solidarity')}</span>
                <span style={{ fontFamily: 'var(--mono)' }}>{fmtEUR(result.solidariedade)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
              <span>{t('irsPT.row.annualSS')}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>−{fmtEUR(result.ssAnual)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}>
              <span>{t('irsPT.row.netMonthlyEstimated')}</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmtEUR(result.liquidoMensal)}</span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', lineHeight: 1.6, marginTop: 14, padding: '10px 12px', background: 'var(--sur2)', borderRadius: 8, border: '.5px solid var(--brd)' }}>
            {t('irsPT.verdesNote')}
          </div>
        </>
      )}
    </Card>
  )
}
