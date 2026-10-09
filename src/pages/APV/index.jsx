// src/pages/APV/index.jsx
// Módulo APV Chile — página propia v1.4
// Solo visible si settings.country === 'CL'

import { useState, useMemo, useEffect } from 'react'
import { InlineIcon } from '../../components/icons/SignalIcon.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { Card, CardHeader, FormRow, FormGroup, Btn } from '../../components/ui/index.jsx'
import { calcAPV } from '../../utils/apvCalc.js'
import { calcBeneficioAPV, calcDescuentos, calcImpuestoAnual, calcGapTramo, calcArbitraje, calcBrutoDesdeLiquido, setIndicadores, getParametrosCL } from '../../utils/taxCalcCL.js'
import { loadIndicadores } from '../../utils/indicadores.js'
import ProGate from '../../components/ui/ProGate.jsx'
import CountryBadge from '../../components/CountryBadge.jsx'
import { currentMonth } from '../../utils/index.js'

const money = n => '$' + (Number(n) || 0).toLocaleString()

export default function APVPage() {
  const { settings, incomes } = useApp()
  const { t } = useT()
  const isChile = (settings.country || 'CL') === 'CL'

  const isDemo = typeof window !== 'undefined' && window.location.search.includes('demo=true')

  const activeMonth = settings.activeMonth || currentMonth()
  // Indicadores (UTM/UF) — se cargan primero para que el bruto se estime con la UTM vigente
  const [indInfo, setIndInfo] = useState(null)
  useEffect(() => {
    loadIndicadores().then(ind => {
      setIndicadores({ utm: ind.utm, uf: ind.uf })
      setIndInfo(ind)
    })
  }, [])
  // Parámetros vigentes (topes imponibles, comisión AFP, UTM/UTA y año tributario).
  // Se recalcula cuando llegan los indicadores, porque setIndicadores() muta el módulo.
  const params = useMemo(() => getParametrosCL(), [indInfo])

  // Estima el sueldo bruto desde el ingreso líquido del mes (previsional + impuesto único de 2ª cat.)
  // Solo categorías de renta del trabajo (no arriendo, inversión, etc.)
  const CATEGORIAS_TRABAJO = ['Salario', 'Sueldo', 'Freelance', 'Honorarios', 'Bono', 'Comisión']
  const sueldoBrutoCalculado = useMemo(() => {
    const work = (incomes || []).filter(r =>
      CATEGORIAS_TRABAJO.some(c => (r.category || '').toLowerCase().includes(c.toLowerCase()))
    )
    if (!work.length) return 0
    const netoDelMes = m => work
      .filter(r => r.date?.startsWith(m))
      .reduce((s, r) => s + r.amount, 0)
    // Preferir el mes activo; si no hay renta de trabajo ahí, usar el mes más reciente que sí la tenga
    let neto = netoDelMes(activeMonth)
    if (neto <= 0) {
      const meses = [...new Set(work.map(r => (r.date || '').slice(0, 7)).filter(Boolean))]
        .sort().reverse()
      for (const m of meses) { neto = netoDelMes(m); if (neto > 0) break }
    }
    return neto > 0 ? calcBrutoDesdeLiquido(neto) : 0
  }, [incomes, activeMonth, indInfo])
  const [apvF, setApvF] = useState({
    monthlyContribution: isDemo ? '150000' : '',
    currentBalance:      isDemo ? '2000000' : '',
    currentAge:          isDemo ? '32' : '',
    targetAge:           65,
    expectedReturn:      5,
    regime:              isDemo ? 'B' : 'unsure',
    grossMonthly:        isDemo ? '2000000' : '',
    annualBonus:         isDemo ? '1000000' : ''
  })
  // Marca si el usuario editó el sueldo bruto a mano (para no pisarlo con el auto-cálculo)
  const [grossTouched, setGrossTouched] = useState(false)
  // Auto-rellenar grossMonthly desde los ingresos, salvo en demo o si el usuario lo editó
  useEffect(() => {
    if (!isDemo && !grossTouched && sueldoBrutoCalculado > 0) {
      setApvF(p => ({ ...p, grossMonthly: String(sueldoBrutoCalculado) }))
    }
  }, [sueldoBrutoCalculado, isDemo, grossTouched])

  const [apvResult, setApvResult]   = useState(null)
  const [taxResult, setTaxResult]   = useState(null)
  const [gapResult, setGapResult]   = useState(null)
  const [arb, setArb]               = useState(null)

  if (!isChile) return (
    <div style={{padding:32,textAlign:'center',color:'var(--th)',fontFamily:'var(--mono)',fontSize:13}}>
      {t('apv.notAvailable')}
    </div>
  )

  function calcular() {
    const r = calcAPV({
      currentBalance: Number(apvF.currentBalance) || 0,
      monthlyContribution: Number(apvF.monthlyContribution),
      currentAge: Number(apvF.currentAge),
      targetAge: Number(apvF.targetAge),
      expectedReturn: Number(apvF.expectedReturn) || 5,
      utm: indInfo?.utm
    })
    setApvResult(r)
    if (apvF.grossMonthly && Number(apvF.grossMonthly) > 0) {
      const t = calcBeneficioAPV({
        sueldoBrutoMensual: Number(apvF.grossMonthly),
        bonoAnual: Number(apvF.annualBonus) || 0,
        apvMensual: Number(apvF.monthlyContribution),
      })
      setTaxResult(t)
      if (t) {
        setGapResult(calcGapTramo(t.baseImponible))
        setArb(calcArbitraje(t.tasaMarginal))
      }
    } else {
      setTaxResult(null)
      setGapResult(null)
      setArb(null)
    }
  }

  return (
    <ProGate feature={t('apv.proGateFeature')}>
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <Card>
        <CardHeader title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CountryBadge code="CL" size={16} title={t('country.CL')} />{t('apv.title')}</span>} />
        <div style={{fontSize:11,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:14,lineHeight:1.6,padding:'8px 10px',background:'rgba(255,165,0,.07)',borderRadius:6,border:'0.5px solid rgba(255,165,0,.2)'}}>
          <InlineIcon kind="alert" size={13} />{t('apv.disclaimer')}
          {indInfo && (
            <span style={{display:'block',marginTop:6,opacity:0.85}}>
              {t('apv.indicators', { utm: indInfo.utm.toLocaleString(), uf: indInfo.uf.toLocaleString(), usd: (indInfo.dolar||0).toLocaleString() })}
              {indInfo.source === 'api' ? t('apv.updatedToday') : t('apv.fallbackValues')}
              <span style={{display:'block',marginTop:2}}>
                {t('apv.caps', { topeAfpSalud: params.topeAfpSaludUF, topeCesantia: params.topeCesantiaUF })}
              </span>
            </span>
          )}
        </div>

        {/* ── PASO 1: Situación actual ── */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:16,marginBottom:16,alignItems:'start'}}>
          <div style={{padding:'14px',background:'var(--sur2)',borderRadius:8,border:'0.5px solid var(--brd)'}}>
            <div style={{fontSize:11,fontWeight:600,color:'var(--tx)',marginBottom:10,fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:'.5px'}}>{`① ${t('apv.step1.title')}`}</div>
            <FormRow>
              <FormGroup label={t('apv.form.grossMonthly')}><input type="number" inputMode="decimal" min="0" value={apvF.grossMonthly} placeholder={t('apv.eg', {n: '2000000'})} onChange={e => { setGrossTouched(true); setApvF(p => ({...p, grossMonthly: e.target.value})) }} /></FormGroup>
              <FormGroup label={t('apv.form.annualBonus')}><input type="number" inputMode="decimal" min="0" value={apvF.annualBonus} placeholder={t('apv.optional')} onChange={e => setApvF(p => ({...p, annualBonus: e.target.value}))} /></FormGroup>
            </FormRow>
            {!isDemo && sueldoBrutoCalculado > 0 && (
              <div style={{marginTop:6,fontSize:10,fontFamily:'var(--mono)',color:'var(--th)',lineHeight:1.5}}>
                {!grossTouched
                  ? t('apv.autoEstimated')
                  : <>{t('apv.suggestedValue', { v: money(sueldoBrutoCalculado) })}<button type="button" style={{color:'var(--grn)',cursor:'pointer',textDecoration:'underline',background:'none',border:0,padding:0,font:'inherit'}} onClick={() => { setGrossTouched(false); setApvF(p => ({...p, grossMonthly: String(sueldoBrutoCalculado)})) }}>{t('apv.useAutoValue')}</button></>}
              </div>
            )}
            {apvF.grossMonthly && Number(apvF.grossMonthly) > 0 && (() => {
              const gm = Number(apvF.grossMonthly)
              const desc = calcDescuentos(gm)
              const rentaAnual = gm * 12 + (Number(apvF.annualBonus) || 0)
              // Solo las cotizaciones rebajan la base imponible; la comisión de la AFP no.
              const baseAnual = Math.max(0, rentaAnual - desc.totalDeducible * 12)
              const imp = calcImpuestoAnual(baseAnual)
              return (
                <div style={{marginTop:12}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:10}}>
                    <div style={{background:'var(--bg)',borderRadius:6,padding:'8px 12px'}}>
                      <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:2}}>{t('apv.result.netMonthly')}</div>
                      <div style={{fontSize:15,fontWeight:700,color:'var(--tx)',fontFamily:'var(--mono)'}}>{money(desc.liquido)}</div>
                    </div>
                    <div style={{background:'var(--bg)',borderRadius:6,padding:'8px 12px'}}>
                      <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:2}}>{t('apv.result.taxWithoutAPV')}</div>
                      <div style={{fontSize:15,fontWeight:700,color:'var(--tx)',fontFamily:'var(--mono)'}}>{money(imp.impuesto)}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <div style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--th)',background:'var(--bg)',padding:'4px 8px',borderRadius:4}}>{t('apv.chip.afp', {v: money(desc.afp)})}</div>
                    <div style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--th)',background:'var(--bg)',padding:'4px 8px',borderRadius:4}}>{t('apv.chip.health', {v: money(desc.salud)})}</div>
                    <div style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--th)',background:'var(--bg)',padding:'4px 8px',borderRadius:4}}>{t('apv.chip.unemployment', {v: money(desc.cesantia)})}</div>
                    <div style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--th)',background:'var(--bg)',padding:'4px 8px',borderRadius:4}}>{t('apv.chip.afpFee', {v: money(desc.comision)})}</div>
                    <div style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--th)',background:'var(--bg)',padding:'4px 8px',borderRadius:4}}>{t('apv.chip.bracket', {tramo: imp.tramo, pct: (imp.tasaMarginal*100).toFixed(0)})}</div>
                  </div>
                  <div style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',marginTop:6,lineHeight:1.5}}>
                    {t('apv.deductionsNote1', {pct: params.comisionAfpPct})}{' '}
                    {t('apv.deductionsNote2Pre')}<strong>{t('apv.deductionsNote2Bold')}</strong>{t('apv.deductionsNote2Post')}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* ── PASO 2: Simulación APV ── */}
          <div style={{padding:'14px',background:'var(--sur2)',borderRadius:8,border:'0.5px solid var(--brd)'}}>
            <div style={{fontSize:11,fontWeight:600,color:'var(--tx)',marginBottom:10,fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:'.5px'}}>{`② ${t('apv.step2.title')}`}</div>
            <FormRow>
              <FormGroup label={t('apv.form.monthlyContribution')}><input type="number" inputMode="decimal" min="0" value={apvF.monthlyContribution} placeholder={t('apv.eg', {n: '150000'})} onChange={e => setApvF(p => ({...p, monthlyContribution: e.target.value}))} /></FormGroup>
              <FormGroup label={t('apv.form.currentBalance')}><input type="number" inputMode="decimal" min="0" value={apvF.currentBalance} placeholder={t('apv.optional')} onChange={e => setApvF(p => ({...p, currentBalance: e.target.value}))} /></FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup label={t('apv.form.currentAge')}><input type="number" inputMode="decimal" min="18" max="80" value={apvF.currentAge} placeholder={t('apv.eg', {n: '32'})} onChange={e => setApvF(p => ({...p, currentAge: e.target.value}))} /></FormGroup>
              <FormGroup label={t('apv.form.targetAge')}><input type="number" inputMode="decimal" min="50" max="90" value={apvF.targetAge} placeholder="65" onChange={e => setApvF(p => ({...p, targetAge: e.target.value}))} /></FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup label={t('apv.form.expectedReturn')}><input type="number" inputMode="decimal" min="0" max="20" step="0.5" value={apvF.expectedReturn} placeholder="5" onChange={e => setApvF(p => ({...p, expectedReturn: e.target.value}))} /></FormGroup>
              <FormGroup label={t('apv.form.regimeLabel')}>
                <select value={apvF.regime} onChange={e => setApvF(p => ({...p, regime: e.target.value}))}>
                  <option value="unsure">{t('apv.regime.unsure')}</option>
                  <option value="A">{t('apv.regime.aLabel')}</option>
                  <option value="B">{t('apv.regime.bLabel')}</option>
                </select>
              </FormGroup>
            </FormRow>
            <Btn variant="primary" onClick={calcular}>{t('apv.calculate')}</Btn>
          </div>
        </div>

        {/* ── RESULTADOS ── */}
        {apvResult && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {/* Fila 1: lado a lado */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:16,alignItems:'start'}}>
              {/* Bloque 1: Impacto tributario */}
              {taxResult && (
                <div style={{background:'var(--sur2)',borderRadius:10,padding:'16px',border:'0.5px solid var(--brd)'}}>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--tx)',marginBottom:4,fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:'.5px'}}>{`① ${t('apv.tax.title')}`}</div>
                  <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:14,lineHeight:1.4}}>{t('apv.tax.contributionLine', { v: money(apvF.monthlyContribution), v2: money(Number(apvF.monthlyContribution)*12) })}</div>
                  <div style={{display:'flex',alignItems:'center',gap:20,flexWrap:'wrap'}}>
                    {(() => {
                      const total = taxResult.impuestoSinAPV
                      // El donut mide reducción de IMPUESTO. Solo el Régimen B la produce:
                      // el bono del A es un depósito estatal, no baja el impuesto.
                      const pct = total > 0 ? taxResult.ahorroRegB / total : 0
                      const r = 40, cx = 50, cy = 50
                      const circ = 2 * Math.PI * r
                      const dash = pct * circ
                      return (
                        <div style={{flexShrink:0,textAlign:'center'}}>
                          <svg width="100" height="100" viewBox="0 0 100 100">
                            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--brd)" strokeWidth="12"/>
                            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--grn)" strokeWidth="12"
                              strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ/4} strokeLinecap="round"/>
                            <text x={cx} y={cy-6} textAnchor="middle" fontSize="10" fill="var(--grn)" fontWeight="700" fontFamily="var(--mono)">{(pct*100).toFixed(0)}%</text>
                            <text x={cx} y={cy+8} textAnchor="middle" fontSize="7" fill="var(--th)" fontFamily="var(--mono)">{t('apv.less')}</text>
                          </svg>
                          <div style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)'}}>{t('apv.tax.donutLabel')}</div>
                        </div>
                      )
                    })()}
                    <div style={{flex:1,minWidth:200}}>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        <div style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',background:'var(--bg)',borderRadius:6}}>
                          <span style={{fontSize:12,fontFamily:'var(--mono)',color:'var(--th)'}}>{t('apv.noAPV')}</span>
                          <span style={{fontSize:12,fontFamily:'var(--mono)',color:'var(--tx)',fontWeight:600}}>{t('apv.perYear', {v: money(taxResult.impuestoSinAPV)})}</span>
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',background:'rgba(10,92,62,.06)',borderRadius:6,border:'0.5px solid rgba(10,92,62,.2)'}}>
                          <span style={{fontSize:12,fontFamily:'var(--mono)',color:'var(--grn)'}}>{t('apv.tax.withRegB')}</span>
                          <span style={{fontSize:12,fontFamily:'var(--mono)',color:'var(--grn)',fontWeight:700}}>{t('apv.perYear', {v: '−'+money(taxResult.ahorroRegB)})}</span>
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',background:'var(--bg)',borderRadius:6}}>
                          <span style={{fontSize:12,fontFamily:'var(--mono)',color:'var(--th)'}}>{t('apv.tax.withRegA')}</span>
                          <span style={{fontSize:12,fontFamily:'var(--mono)',color:'var(--tx)',fontWeight:600}}>{t('apv.tax.noChange', {v: money(taxResult.impuestoConRegA)})}</span>
                        </div>
                        <div style={{padding:'6px 12px',background:'var(--bg)',borderRadius:6}}>
                          <span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--th)'}}>{t('apv.majorBenefitLabel')}</span>
                          <span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--grn)',fontWeight:700}}>{taxResult.mayorBeneficio === 'A' ? t('apv.regimeA') : t('apv.regimeB')}</span>
                          <span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--th)'}}>{t('apv.bracketMarginal', {n: taxResult.tramoActual, pct: (taxResult.tasaMarginal*100).toFixed(0)})}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* El bono del Régimen A NO es rebaja de impuesto: es plata que el
                      Estado deposita en la cuenta APV. Por eso va en bloque aparte y
                      nunca restado del impuesto anual. */}
                  <div style={{marginTop:12,padding:'10px 12px',background:'var(--bg)',borderRadius:8,border:'0.5px dashed color-mix(in srgb, var(--grn) 45%, transparent)'}}>
                    <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:4}}>{t('apv.stateContribution.title')}</div>
                    <div style={{fontSize:18,fontWeight:700,color:'var(--grn)',fontFamily:'var(--mono)'}}>{t('apv.plusPerYear', {v: money(taxResult.bonoEstatalRegA)})}</div>
                    <div style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',marginTop:4,lineHeight:1.5}}>
                      {t('apv.stateContribution.note')}
                      {taxResult.bonoLimitadoPor10x && <> <strong>{t('apv.stateContribution.limitedNote')}</strong></>}
                    </div>
                  </div>
                  <div style={{marginTop:10,fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',lineHeight:1.5}}>
                    {t('apv.tax.footnote1', {at: params.anioTributario, ac: params.anioComercial})}
                    {t('apv.tax.footnoteUTMref', {v: money(taxResult.UTMref)})}
                    {taxResult.utaEsAproximada && <>{t('apv.tax.footnoteApproxPre')}<strong>{t('apv.tax.footnoteApproxBold')}</strong>{t('apv.tax.footnoteApproxPost')}</>}
                    {t('apv.tax.footnote2', {pct: params.comisionAfpPct})}
                  </div>
                </div>
              )}

              {/* Bloque 2: Proyección al jubilar */}
              <div style={{background:'var(--sur2)',borderRadius:10,padding:'16px',border:'0.5px solid var(--brd)'}}>
                <div style={{fontSize:11,fontWeight:600,color:'var(--tx)',marginBottom:4,fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:'.5px'}}>{`② ${t('apv.projection.title')}`}</div>
                <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:14,lineHeight:1.4}}>{t('apv.projection.subtitle', { v: money(apvF.monthlyContribution), r: apvF.expectedReturn })}</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:16}}>
                  <div style={{background:'var(--bg)',borderRadius:8,padding:'10px 12px',borderBottom:'2px solid var(--grn)'}}>
                    <div style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:4}}>{t('apv.projection.startingToday')}</div>
                    <div style={{fontSize:16,fontWeight:700,color:'var(--grn)',fontFamily:'var(--mono)'}}>{apvResult.projectionToday>=1000000?'$'+(apvResult.projectionToday/1000000).toFixed(1)+'M':money(apvResult.projectionToday)}</div>
                    <div style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',marginTop:2}}>{t('apv.projection.accumulatedAtRetirement')}</div>
                  </div>
                  <div style={{background:'var(--bg)',borderRadius:8,padding:'10px 12px',borderBottom:'2px solid var(--brd)'}}>
                    <div style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:4}}>{t('apv.projection.in5Years')}</div>
                    <div style={{fontSize:16,fontWeight:700,color:'var(--tx)',fontFamily:'var(--mono)'}}>{apvResult.projection5years>=1000000?'$'+(apvResult.projection5years/1000000).toFixed(1)+'M':money(apvResult.projection5years)}</div>
                    <div style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',marginTop:2}}>{t('apv.projection.ifStartIn5')}</div>
                  </div>
                  <div style={{background:'var(--bg)',borderRadius:8,padding:'10px 12px',borderBottom:'2px solid #e84142'}}>
                    <div style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:4}}>{t('apv.projection.costOfWaiting')}</div>
                    <div style={{fontSize:16,fontWeight:700,color:'#e84142',fontFamily:'var(--mono)'}}>-{apvResult.difference>=1000000?'$'+(apvResult.difference/1000000).toFixed(1)+'M':money(apvResult.difference)}</div>
                    <div style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',marginTop:2}}>{t('apv.projection.lessAtRetirement')}</div>
                  </div>
                </div>
                <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:8}}>{t('apv.projection.growthByAge')}</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {apvResult.chartPoints.map(pt => (
                    <div key={pt.age}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                        <span style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)'}}>{t('apv.yearsOld', {age: pt.age})}</span>
                        <span style={{fontSize:10,color:'var(--grn)',fontFamily:'var(--mono)',fontWeight:600}}>{pt.today>=1000000?'$'+(pt.today/1000000).toFixed(1)+'M':money(pt.today)}</span>
                      </div>
                      <div style={{position:'relative',height:8,background:'var(--brd)',borderRadius:4,overflow:'hidden'}}>
                        <div style={{position:'absolute',height:'100%',width:Math.min(100,pt.in5years/apvResult.projectionToday*100)+'%',background:'rgba(10,92,62,.2)',borderRadius:4}}/>
                        <div style={{position:'absolute',height:'100%',width:Math.min(100,pt.today/apvResult.projectionToday*100)+'%',background:'var(--grn)',borderRadius:4,opacity:.85}}/>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',gap:12,marginTop:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:10,height:10,borderRadius:2,background:'var(--grn)',opacity:.85}}/><span style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)'}}>{t('apv.legend.startingToday')}</span></div>
                  <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:10,height:10,borderRadius:2,background:'rgba(10,92,62,.2)'}}/><span style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)'}}>{t('apv.legend.in5Years')}</span></div>
                </div>
                {apvF.regime !== 'unsure' && (
                  <div style={{marginTop:12,padding:'8px 12px',background:'var(--bg)',borderRadius:6,fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',lineHeight:1.6}}>
                    {apvF.regime === 'A' ? t('apv.regime.noteA') : t('apv.regime.noteB')}
                  </div>
                )}
                <div style={{marginTop:10,fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',lineHeight:1.5}}>
                  {t('apv.projection.footnote', {r: apvF.expectedReturn})}
                </div>
              </div>
            </div>

            {/* Fila 2: Estimación tributaria ancho completo */}
            {taxResult && (
              <div style={{background:'var(--sur2)',borderRadius:10,padding:'16px',border:'0.5px solid var(--brd)'}}>
                <div style={{fontSize:11,fontWeight:600,color:'var(--tx)',marginBottom:4,fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:'.5px'}}>{t('apv.taxEstimate.title')}</div>
                <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:12,lineHeight:1.5,padding:'6px 10px',background:'rgba(0,0,0,.03)',borderRadius:4}}>{t('apv.taxEstimate.subtitle', { v: money(apvF.monthlyContribution), v2: money(Number(apvF.monthlyContribution)*12) })}</div>
                <div style={{display:'flex',flexDirection:'column',gap:0,border:'0.5px solid var(--brd)',borderRadius:8,overflow:'hidden',marginBottom:12}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',background:'var(--sur2)'}}>
                    <div style={{padding:'8px 12px',fontSize:10,fontFamily:'var(--mono)',color:'var(--th)',textTransform:'uppercase',letterSpacing:'.5px'}}>{t('apv.table.situation')}</div>
                    <div style={{padding:'8px 12px',fontSize:10,fontFamily:'var(--mono)',color:'var(--th)',textTransform:'uppercase',letterSpacing:'.5px',borderLeft:'0.5px solid var(--brd)'}}>{t('apv.table.estTax')}</div>
                    <div style={{padding:'8px 12px',fontSize:10,fontFamily:'var(--mono)',color:'var(--grn)',textTransform:'uppercase',letterSpacing:'.5px',borderLeft:'0.5px solid var(--brd)'}}>{t('apv.table.estBenefit')}</div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',borderTop:'0.5px solid var(--brd)'}}>
                    <div style={{padding:'10px 12px',fontSize:12,fontFamily:'var(--mono)',color:'var(--tx)'}}>{t('apv.noAPV')}</div>
                    <div style={{padding:'10px 12px',fontSize:12,fontFamily:'var(--mono)',color:'var(--tx)',borderLeft:'0.5px solid var(--brd)'}}>{money(taxResult.impuestoSinAPV)}</div>
                    <div style={{padding:'10px 12px',fontSize:12,fontFamily:'var(--mono)',color:'var(--th)',borderLeft:'0.5px solid var(--brd)'}}>—</div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',borderTop:'0.5px solid var(--brd)',background:'var(--sur2)'}}>
                    <div style={{padding:'10px 12px',fontSize:12,fontFamily:'var(--mono)',color:'var(--tx)'}}>{t('apv.regimeA')}</div>
                    {/* Mismo impuesto que sin APV: el Régimen A no rebaja la base imponible. */}
                    <div style={{padding:'10px 12px',fontSize:12,fontFamily:'var(--mono)',color:'var(--tx)',borderLeft:'0.5px solid var(--brd)'}}>
                      {money(taxResult.impuestoConRegA)}
                      <span style={{fontSize:9,color:'var(--th)',display:'block'}}>{t('apv.sameAsNoAPV')}</span>
                    </div>
                    <div style={{padding:'10px 12px',fontSize:12,fontFamily:'var(--mono)',color:'var(--grn)',fontWeight:600,borderLeft:'0.5px solid var(--brd)'}}>
                      +{money(taxResult.bonoEstatalRegA)}
                      <span style={{fontSize:9,color:'var(--th)',fontWeight:400,display:'block'}}>{t('apv.stateContributionShort')}</span>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',borderTop:'0.5px solid var(--brd)'}}>
                    <div style={{padding:'10px 12px',fontSize:12,fontFamily:'var(--mono)',color:'var(--tx)'}}>{t('apv.regimeB')}</div>
                    <div style={{padding:'10px 12px',fontSize:12,fontFamily:'var(--mono)',color:'var(--tx)',borderLeft:'0.5px solid var(--brd)'}}>{money(taxResult.impuestoConRegB)}</div>
                    <div style={{padding:'10px 12px',fontSize:12,fontFamily:'var(--mono)',color:'var(--grn)',fontWeight:600,borderLeft:'0.5px solid var(--brd)'}}>
                      +{money(taxResult.ahorroRegB)}
                      <span style={{fontSize:9,color:'var(--th)',fontWeight:400,display:'block'}}>{t('apv.lessTaxToSII')}</span>
                    </div>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                  <div style={{background:'var(--bg)',borderRadius:8,padding:'10px 12px'}}>
                    <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:4}}>{t('apv.table.bracketLabel')}</div>
                    <div style={{fontSize:14,fontWeight:700,color:'var(--tx)',fontFamily:'var(--mono)'}}>{t('apv.bracketN', {n: taxResult.tramoActual})}</div>
                    <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)'}}>{t('apv.marginalRatePct', {pct: (taxResult.tasaMarginal*100).toFixed(0)})}</div>
                  </div>
                  <div style={{background:'var(--bg)',borderRadius:8,padding:'10px 12px'}}>
                    <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:4}}>{t('apv.table.majorBenefit')}</div>
                    <div style={{fontSize:14,fontWeight:700,color:'var(--grn)',fontFamily:'var(--mono)'}}>{taxResult.mayorBeneficio === 'A' ? t('apv.regimeA') : t('apv.regimeB')}</div>
                    <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)'}}>{t('apv.plusPerYearEst', {v: money(taxResult.mayorBeneficio==='A'?taxResult.bonoEstatalRegA:taxResult.ahorroRegB)})}</div>
                    <div style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',marginTop:2}}>{taxResult.mayorBeneficio==='A'?t('apv.depositNote'):t('apv.lessTaxNote')}</div>
                  </div>
                </div>
                <div style={{padding:'8px 12px',background:'rgba(0,0,0,.03)',borderRadius:6,fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',lineHeight:1.6}}>
                  {t('apv.taxEstimate.footnote1', {at: params.anioTributario, ac: params.anioComercial})}
                  {t('apv.taxEstimate.footnote2', {v: money(taxResult.UTMref), pct: params.comisionAfpPct})}
                  {t('apv.taxEstimate.footnote3')}
                  {t('apv.taxEstimate.footnote4')}
                </div>
              </div>
            )}

            {/* -- APV necesario para bajar un tramo -- */}
            {gapResult && gapResult.tramoActual > 1 && (
              <div style={{background:'var(--sur2)',borderRadius:10,padding:'16px',border:'0.5px solid var(--brd)'}}>
                <div style={{fontSize:11,fontWeight:600,color:'var(--tx)',marginBottom:12,fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:'.5px'}}>{t('apv.gap.title')}</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10}}>
                  <div style={{background:'var(--bg)',borderRadius:8,padding:'12px',borderBottom:'2px solid var(--grn)'}}>
                    <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:4}}>{t('apv.gap.annualNeeded')}</div>
                    <div style={{fontSize:18,fontWeight:700,color:'var(--grn)',fontFamily:'var(--mono)'}}>{money(gapResult.gap)}</div>
                    <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginTop:2}}>{t('apv.gap.approxPerMonth', {v: money(gapResult.gapMensual), n: gapResult.tramoObjetivo})}</div>
                  </div>
                  <div style={{background:'var(--bg)',borderRadius:8,padding:'12px'}}>
                    <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:4}}>{t('apv.gap.rateReduction')}</div>
                    <div style={{fontSize:18,fontWeight:700,color:'var(--grn)',fontFamily:'var(--mono)'}}>{t('apv.gap.rateFromTo', {pct1: (gapResult.tasaActual*100).toFixed(0), pct2: (gapResult.tasaObjetivo*100).toFixed(0)})}</div>
                    <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginTop:2}}>{t('apv.gap.lessPoints', {n: ((gapResult.tasaActual-gapResult.tasaObjetivo)*100).toFixed(1)})}</div>
                  </div>
                  <div style={{background:'var(--bg)',borderRadius:8,padding:'12px'}}>
                    <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:4}}>{t('apv.gap.ofLegalCap')}</div>
                    <div style={{fontSize:18,fontWeight:700,fontFamily:'var(--mono)',color:gapResult.dentroDelTope?'var(--grn)':'#e84142'}}>{gapResult.porcentajeDelTope}%</div>
                    <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginTop:2}}>{gapResult.dentroDelTope?t('apv.gap.withinCap'):t('apv.gap.exceedsCap')}</div>
                  </div>
                </div>
                <div style={{marginTop:8,fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',lineHeight:1.5}}>
                  {t('apv.gap.footnote', { v: money(gapResult.topeRegB), src: indInfo?.source === 'api' ? t('apv.sourceToday') : t('apv.sourceFallback') })}
                </div>
              </div>
            )}

            {/* -- Arbitraje jubilar -- */}
            {arb && arb.tasaMarginalHoy > 0 && (
              <div style={{background:'var(--sur2)',borderRadius:10,padding:'16px',border:'0.5px solid var(--brd)'}}>
                <div style={{fontSize:11,fontWeight:600,color:'var(--tx)',marginBottom:12,fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:'.5px'}}>{t('apv.arb.title')}</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10}}>
                  <div style={{background:'var(--bg)',borderRadius:8,padding:'12px',borderBottom:'2px solid var(--grn)'}}>
                    <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:4}}>{t('apv.arb.netSavingsPerPeso')}</div>
                    <div style={{fontSize:24,fontWeight:700,color:'var(--grn)',fontFamily:'var(--mono)'}}>{arb.centavosPorPeso}c</div>
                    <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginTop:2}}>{t('apv.arb.centsNotPaid')}</div>
                  </div>
                  <div style={{background:'var(--bg)',borderRadius:8,padding:'12px'}}>
                    <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:4}}>{t('apv.arb.marginalRateToday')}</div>
                    <div style={{fontSize:18,fontWeight:700,color:'var(--tx)',fontFamily:'var(--mono)'}}>{(arb.tasaMarginalHoy*100).toFixed(0)}%</div>
                    <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginTop:2}}>{t('apv.arb.rateAvoided')}</div>
                  </div>
                  <div style={{background:'var(--bg)',borderRadius:8,padding:'12px'}}>
                    <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:4}}>{t('apv.arb.effectiveRateAtRetirement')}</div>
                    <div style={{fontSize:18,fontWeight:700,color:'var(--th)',fontFamily:'var(--mono)'}}>{(arb.tasaRetiroEst*100).toFixed(0)}%</div>
                    <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginTop:2}}>{t('apv.arb.estimatedNote')}</div>
                  </div>
                </div>
                <div style={{marginTop:8,fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',lineHeight:1.5}}>
                  {t('apv.arb.footnote')}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
    </ProGate>
  )
}
