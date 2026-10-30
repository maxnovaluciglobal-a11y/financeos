// src/pages/Panorama/index.jsx — "¿Cómo voy en general?" (poda P1, 30-oct-2026).
// Hub del análisis: reemplaza la vista detallada del Inicio y junta en un
// solo hogar lo que antes estaba repartido entre el Inicio y el Menú (IQ
// Score con factores y siguiente paso, señales del Diagnóstico, Ingresos y
// Gastos con su variación, tasa de ahorro, suscripciones, patrimonio,
// proyección, gráficos). Patrón "Análisis" de Copilot y Monarch (E7 de la
// propuesta). Se llega desde "Más" › Panorama y desde la línea del IQ en el
// Inicio. Las páginas completas (Diagnóstico, Patrimonio, Proyección,
// Reportes, Suscripciones) siguen igual y se abren desde el pie.
import { ChevronRight } from 'lucide-react'
import { useT } from '../../i18n/useT.js'
import { PageHeader, Card, CardHeader } from '../../components/ui/index.jsx'
import ChartCard from '../../components/charts/ChartCard.jsx'
import IncomeExpenseBar from '../../components/charts/IncomeExpenseBar.jsx'
import CategoryDonut from '../../components/charts/CategoryDonut.jsx'
import MoneyFlow from '../../components/charts/MoneyFlow.jsx'
import CountUp from '../../components/CountUp.jsx'
import Money from '../../components/Money.jsx'
import { InlineIcon } from '../../components/icons/SignalIcon.jsx'
import { NAV_ICONS } from '../../components/icons/Icons.jsx'
import { useHomeData } from '../Dashboard/useHomeData.jsx'
import { IncExpTiles } from '../Dashboard/HomeKpis.jsx'
import ScoreCard from '../Dashboard/ScoreCard.jsx'
import NetWorthCard from '../Dashboard/NetWorthCard.jsx'
import ProjectionCard from '../Dashboard/ProjectionCard.jsx'
import CountryTool from '../Dashboard/CountryTool.jsx'
import DonutEmpty from '../Dashboard/DonutEmpty.jsx'
import { PANORAMA_PAGES, showProChip, ALL_ITEMS } from '../../components/layout/navConfig.js'
import { getLicensePlan } from '../../utils/licenseValidator.js'
import { currentMonth, fmtMoney, fmtPct } from '../../utils/index.js'
import { monthLabel } from '../shared/constants.js'
import hs from '../Dashboard/Home.module.css'
import ms from '../More/more.module.css'

export default function Panorama({ setPage }) {
  const { t } = useT()
  const d = useHomeData()
  const { settings, sym, activeMonth, kpis, healthScore, todoItems, money, dualOn, toUSD, propFlow, flujoTotal, subMonthly } = d
  const plan = getLicensePlan()
  const hasData = kpis.incCount > 0 || kpis.expCount > 0

  const secondary = [
    ...(propFlow.has ? [{ label: t('dash.kpi.totalFlow'), color: flujoTotal >= 0 ? 'var(--pos)' : 'var(--neg)', sub: t('dash.kpi.personalPlusProps', { v: `${propFlow.net >= 0 ? '+' : '−'}${money(Math.abs(propFlow.net))}` }), raw: flujoTotal, count: true }] : []),
    { label: t('dash.kpi.savingRate'), value: fmtPct(kpis.savingRate), color: kpis.savingRate >= 0.2 ? 'var(--pos)' : kpis.savingRate >= 0 ? 'var(--warn)' : 'var(--neg)', sub: t('dash.kpi.ofIncome') },
    { label: t('dash.kpi.subs'), value: t('dash.kpi.perMonth', { v: money(subMonthly) }), color: 'var(--tx)', sub: t('dash.kpi.perYear', { v: money(subMonthly * 12) }), page: 'subscriptions' },
  ]

  const expected = Number(settings.estimatedMonthlyIncome) || 0
  const links = PANORAMA_PAGES.map(id => ALL_ITEMS.find(it => it.id === id)).filter(Boolean)

  return (
    <div>
      <PageHeader title={t('nav.panorama')} sub={monthLabel(activeMonth)} />
      <div className={hs.home}>
        <div className={hs.stack}>
          {/* IQ Score completo: número, estado, siguiente paso y factores. */}
          <ScoreCard healthScore={healthScore} activeMonth={activeMonth} compact={false}
            isCurrentMonth={activeMonth === currentMonth()} setPage={setPage} />

          {/* Para hacer hoy — señales del Diagnóstico + insights (Fase 05). */}
          {todoItems.length > 0 && (
            <Card style={{ padding: '16px 18px' }}>
              <CardHeader
                title={<><InlineIcon kind="diagnosis" size={13} />{t('dash.signals.title')}</>}
                right={setPage && (
                  <button type="button" onClick={() => setPage('coach')}
                    style={{ minHeight: 44, fontSize: 12, fontFamily: 'var(--sans)', color: 'var(--accent)', cursor: 'pointer', background: 'none', border: 0, padding: 0 }}>
                    {t('dash.signals.viewAll')}
                  </button>
                )}
              />
              {todoItems.map((item, i) => (
                <button key={i} type="button" onClick={() => item.page && setPage?.(item.page)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', minHeight: 44, textAlign: 'left',
                    background: 'none', border: 'none', cursor: item.page ? 'pointer' : 'default', padding: 0,
                    marginBottom: i < todoItems.length - 1 ? 12 : 0, font: 'inherit' }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: item.color, background: `color-mix(in srgb, ${item.color} 14%, transparent)` }}>{item.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--tx)', marginBottom: 2 }}>{item.title}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--tm)', lineHeight: 1.5 }}>{item.sub}</span>
                  </span>
                  {item.page && <span aria-hidden="true" style={{ fontSize: 13, color: item.color, flexShrink: 0 }}>→</span>}
                </button>
              ))}
            </Card>
          )}

          {/* Ingresos y Gastos con su variación (antes, en el Inicio) + tasa
              de ahorro, suscripciones y flujo total. */}
          <section aria-labelledby="pano-month-title" data-tour="pano-month">
            <h2 id="pano-month-title" className={hs.cardTitle} style={{ margin: '0 0 8px' }}>{t('panorama.month.title')}</h2>
            <IncExpTiles kpis={kpis} activeMonth={activeMonth} sym={sym} dualOn={dualOn} toUSD={toUSD} onOpen={setPage} country={settings.country} />
            <div className={hs.secondary}>
              {secondary.map((k, i) => {
                const Tag = k.page && setPage ? 'button' : 'div'
                return (
                  <Tag key={i} type={Tag === 'button' ? 'button' : undefined} onClick={Tag === 'button' ? () => setPage(k.page) : undefined}
                    className={`${hs.card} ${hs.kpi} ${Tag === 'button' ? hs.kpiTap : ''}`}>
                    <div className={hs.kpiLabel}>{k.label}{Tag === 'button' && <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className={hs.kpiChevron} />}</div>
                    <div className={`num ${hs.kpiValue}`} style={{ color: k.color }}>
                      {k.count ? <Money><CountUp value={k.raw} format={(v) => `${k.raw < 0 ? '−' : ''}${fmtMoney(v, sym)}`} /></Money> : k.value}
                    </div>
                    <div className={hs.kpiSub}>{k.sub}</div>
                  </Tag>
                )
              })}
            </div>
          </section>

          {/* Ingreso esperado vs recibido */}
          {expected > 0 && kpis.totalInc > 0 && (() => {
            const diff = kpis.totalInc - expected
            const over = diff >= 0
            return (
              <div style={{ background: over ? 'color-mix(in srgb, var(--pos) 8%, transparent)' : 'color-mix(in srgb, var(--neg) 8%, transparent)', border: `.5px solid ${over ? 'color-mix(in srgb, var(--pos) 28%, transparent)' : 'color-mix(in srgb, var(--neg) 28%, transparent)'}`, borderRadius: 'var(--r)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 12, color: 'var(--th)', marginBottom: 4 }}>{t('dash.expected.title')}</div>
                  <div style={{ fontSize: 13, color: 'var(--tx)' }}>
                    {t('dash.expected.expected')} <strong><Money>{fmtMoney(expected, sym)}</Money></strong> · {t('dash.expected.received')} <strong style={{ color: over ? 'var(--accent)' : 'var(--red)' }}><Money>{fmtMoney(kpis.totalInc, sym)}</Money></strong>
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--num)', fontSize: 14, fontWeight: 700, color: over ? 'var(--accent)' : 'var(--red)' }}>
                  {fmtPct(diff / expected, { signed: true })}
                </div>
              </div>
            )
          })()}

          <ProjectionCard incomes={d.incomes} expenses={d.expenses} activeMonth={activeMonth} pending={d.pendingSum}
            kpis={kpis} money={money} dualOn={dualOn} toUSD={toUSD} setPage={setPage} />

          <NetWorthCard goals={d.goals} debts={d.debts} incomes={d.ctx.incomes} expenses={d.ctx.expenses}
            settings={settings} sym={sym} setPage={setPage} />

          <ChartCard title={t('dash.chart.cat.title')} subtitle={monthLabel(activeMonth)} minHeight={160}>
            {d.monthExpenses.some(r => Number(r?.amount) > 0)
              ? <CategoryDonut records={d.monthExpenses} sym={sym} maxCategories={6}
                  onCategoryClick={setPage ? (cat) => { try { sessionStorage.setItem('fos_drill_category', cat) } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ } ; setPage('movements') } : undefined}/>
              : <DonutEmpty />}
          </ChartCard>

          {hasData && (
            <ChartCard title={t('dash.chart.bar.title')} subtitle={t('dash.chart.bar.sub')} minHeight={180}>
              <IncomeExpenseBar incomes={d.incomes} expenses={d.expenses} sym={sym} months={6}/>
            </ChartCard>
          )}

          {/* Flujo del mes (solo escritorio). */}
          {d.monthExpenses.length > 0 && (
            <div className="fos-hide-mobile">
              <ChartCard title={t('dash.chart.flow.title')} subtitle={t('dash.chart.flow.sub')} minHeight={220}>
                <MoneyFlow incomes={d.monthIncomes} expenses={d.monthExpenses} subscriptions={d.subs} debts={d.debts} sym={sym}/>
              </ChartCard>
            </div>
          )}

          {/* #03 — Herramienta fiscal del país. */}
          <CountryTool country={settings.country} setPage={setPage} />

          {/* Las páginas completas del análisis. */}
          {setPage && (
            <section aria-labelledby="pano-detail-title" data-tour="pano-detail">
              <h2 id="pano-detail-title" className={ms.groupTitle}>{t('panorama.detail.title')}</h2>
              <div className={ms.list}>
                {links.map(it => {
                  const Ic = NAV_ICONS[it.id]
                  return (
                    <button key={it.id} type="button" className={ms.row} onClick={() => setPage(it.id)}>
                      <span className={ms.rowIc} aria-hidden="true">{Ic ? <Ic size={18} /> : null}</span>
                      <span className={ms.rowLabel}>{t(it.lb)}</span>
                      {showProChip(it, plan) && <span className={ms.pro}>PRO</span>}
                      <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className={ms.chev} />
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--sans)', lineHeight: 1.6, marginTop: 16 }}>
        {t('dash.disclaimer')}
      </div>
    </div>
  )
}
