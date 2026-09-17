// src/pages/PPR/index.jsx
// Módulo PPR Portugal (Plano Poupança Reforma) — simulador do benefício fiscal
// Solo visible si settings.country === 'PT'.
// CORRECCIÓN 2026-08-27: la nota anterior decía "los módulos fiscales por país
// van en el idioma del país donde aparecen (portugués fijo acá)" — desactualizada.
// Steuer/IRPFEspana/ResicoMX/MultiDolarAR ya demostraron que la práctica actual
// es respetar settings.language como el resto de la app (útil para, ej., un
// emigrante brasileño con negocios en Portugal usando la app en portugués de
// Brasil, o cualquiera en inglés). Migrado a useT() para ser consistente.
//
// Reglas (art. 21.º EBF, validadas 2026-07-10):
//   - Dedução à coleta do IRS: 20% do valor aplicado no ano, com tetos por idade
//     (idade a 1 de janeiro): <35 → €400 · 35-50 → €350 · >50 → €300.
//   - Aporte que maximiza o benefício: €2.000 / €1.750 / €1.500 respetivamente.
//   - Após a passagem à reforma, os aportes deixam de ser dedutíveis.
//   - Resgate em condições legais: IRS reduzido (~8% sobre o rendimento).
//   - Resgate fora das condições: devolução das deduções usufruídas +10%/ano.

import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { Card, CardHeader, FormRow, FormGroup, Alert, PageHeader, KPI } from '../../components/ui/index.jsx'
import ProGate from '../../components/ui/ProGate.jsx'

const fmtEur = (n) => '€' + (Number(n) || 0).toLocaleString('pt-PT', { maximumFractionDigits: 0 })

// Teto de dedução segundo a idade a 1 de janeiro (art. 21.º EBF). bracketKey se
// traduce en el componente vía t('ppr.bracket.*') — acá queda como identificador
// interno, no como texto visible.
function deductionCap(age) {
  if (age < 35) return { cap: 400, maxContribution: 2000, bracketKey: 'under35' }
  if (age <= 50) return { cap: 350, maxContribution: 1750, bracketKey: '35to50' }
  return { cap: 300, maxContribution: 1500, bracketKey: 'over50' }
}

export default function PPRPage() {
  const { settings } = useApp()
  const { t } = useT()
  const isDemo = typeof window !== 'undefined' && window.location.search.includes('demo=true')

  const [f, setF] = useState({
    age:            isDemo ? '32' : '',
    annualContrib:  isDemo ? '1200' : '',
    currentBalance: isDemo ? '5000' : '',
    retireAge:      66,
    expectedReturn: 4,
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const r = useMemo(() => {
    const age = Number(f.age) || 0
    const contrib = Number(f.annualContrib) || 0
    const balance = Number(f.currentBalance) || 0
    const retireAge = Number(f.retireAge) || 66
    const ret = (Number(f.expectedReturn) || 0) / 100
    if (age <= 0) return null

    const { cap, maxContribution, bracketKey } = deductionCap(age)
    const benefit = Math.min(contrib * 0.20, cap)
    const benefitMaxed = contrib >= maxContribution
    const extraToMax = Math.max(0, maxContribution - contrib)
    const extraBenefit = Math.min(maxContribution * 0.20, cap) - benefit

    // Projeção composta até a reforma (aporte constante no fim de cada ano)
    const years = Math.max(0, retireAge - age)
    let projected = balance
    let totalContrib = 0
    for (let i = 0; i < years; i++) {
      projected = projected * (1 + ret) + contrib
      totalContrib += contrib
    }
    const gains = Math.max(0, projected - balance - totalContrib)
    const exitTax = gains * 0.08 // condições legais de resgate

    // Os tetos do art. 21.º EBF descem com a idade (400 → 350 → 300), por isso
    // multiplicar o benefício do ano atual pelos anos que faltam sobrestima o
    // acumulado. Calcula-se ano a ano com o teto que corresponde a cada idade.
    let totalBenefits = 0
    for (let i = 0; i < years; i++) {
      totalBenefits += Math.min(contrib * 0.20, deductionCap(age + i).cap)
    }
    const benefitAvg = years > 0 ? totalBenefits / years : 0

    return { cap, maxContribution, bracketKey, benefit, benefitMaxed, extraToMax, extraBenefit,
             years, projected, totalContrib, gains, exitTax,
             totalBenefits, benefitAvg }
  }, [f])

  return (
    <ProGate feature={t('ppr.proGateFeature')}>
    <div className="stack">
      <PageHeader title={t('ppr.title')} sub={t('ppr.sub')} />
      <Alert type="info">⚠ {t('ppr.disclaimer')}</Alert>
      <p style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--mono)', marginTop: -4, marginBottom: 8, lineHeight: 1.6 }}>
        {t('ppr.intro')}
      </p>

      <Card>
        <CardHeader title={t('ppr.card.yourData')} />
        <FormRow>
          <FormGroup label={t('ppr.form.age')}>
            <input type="number" inputMode="decimal" min="18" max="80" value={f.age} placeholder="ex. 32"
              onChange={e => set('age', e.target.value)} />
          </FormGroup>
          <FormGroup label={t('ppr.form.annualContrib')}>
            <input type="number" inputMode="decimal" min="0" value={f.annualContrib} placeholder="ex. 1200"
              onChange={e => set('annualContrib', e.target.value)} />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label={t('ppr.form.currentBalance')}>
            <input type="number" inputMode="decimal" min="0" value={f.currentBalance} placeholder="0"
              onChange={e => set('currentBalance', e.target.value)} />
          </FormGroup>
          <FormGroup label={t('ppr.form.retireAge')}>
            <input type="number" inputMode="decimal" min="55" max="75" value={f.retireAge}
              onChange={e => set('retireAge', e.target.value)} />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label={t('ppr.form.expectedReturn')}>
            <input type="number" inputMode="decimal" min="0" max="15" step="0.5" value={f.expectedReturn}
              onChange={e => set('expectedReturn', e.target.value)} />
          </FormGroup>
        </FormRow>
      </Card>

      {r && (Number(f.annualContrib) > 0 || Number(f.currentBalance) > 0) && (
        <>
          <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
            <KPI label={t('ppr.kpi.benefit')} value={fmtEur(r.benefit)} color="green"
              sub={t('ppr.kpi.benefitSub', { cap: fmtEur(r.cap), bracket: t('ppr.bracket.' + r.bracketKey) })} />
            <KPI label={t('ppr.kpi.projected')} value={fmtEur(r.projected)}
              sub={t('ppr.kpi.projectedSub', { age: f.retireAge, years: r.years })} />
            <KPI label={t('ppr.kpi.totalBenefits')} value={fmtEur(r.totalBenefits)} color="green"
              sub={t('ppr.kpi.totalBenefitsSub', { years: r.years, avg: fmtEur(r.benefitAvg) })} />
            <KPI label={t('ppr.kpi.gains')} value={fmtEur(r.gains)}
              sub={t('ppr.kpi.gainsSub', { tax: fmtEur(r.exitTax) })} />
          </div>

          {!r.benefitMaxed && r.extraBenefit > 0 && (
            <Alert type="info">
              {t('ppr.alert.notMaxed', { extra: fmtEur(r.extraToMax), max: fmtEur(r.maxContribution), extraBenefit: fmtEur(r.extraBenefit), cap: fmtEur(r.cap) })}
            </Alert>
          )}
          {r.benefitMaxed && (
            <Alert type="ok">
              {t('ppr.alert.maxed', { cap: fmtEur(r.cap), contrib: fmtEur(r.maxContribution) })}
            </Alert>
          )}

          <Card>
            <CardHeader title={t('ppr.card.rules')} />
            <ul style={{ fontSize: 12, color: 'var(--tm)', fontFamily: 'var(--mono)', lineHeight: 1.9, paddingLeft: 18, margin: 0 }}>
              <li>{t('ppr.rule1')}</li>
              <li>{t('ppr.rule2')}</li>
              <li>{t('ppr.rule3')}</li>
              <li>{t('ppr.rule4')}</li>
              <li>{t('ppr.rule5')}</li>
            </ul>
          </Card>

          <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', lineHeight: 1.6, padding: '0 4px' }}>
            {t('ppr.footer')}
          </div>
        </>
      )}
    </div>
    </ProGate>
  )
}
