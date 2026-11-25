// ING-14: textos idénticos al español en pt/en/de. Se revisaron uno por uno
// (19-oct-2026): son cognados o nombres propios válidos en ese idioma. Una
// clave nueva idéntica al español falla acá hasta que alguien la revise y la
// sume a la lista (o la traduzca): así no se cuela una isla en español.
import { describe, it, expect } from 'vitest'
import { es } from './withSections.js'
import { pt } from './withSections.js'
import { en } from './withSections.js'
import { de } from './withSections.js'

const ALLOWED = {
  pt: new Set([
    // Avisos locales y Puntos y millas (24-nov-2026): solo variables o cognados iguales en pt.
    'la.fixedDue.body', 'loyalty.edit', 'loyalty.form.titleEdit', 'loyalty.estimated',
    // 24-nov-2026: iguales en pt a propósito.
    'steps.expense.cta', 'review.confirmAria', 'review.openAria',
    // Invest F2, Hoy (20-nov-2026): nombres de índices, tickers y cognados iguales en este idioma.
    "invest.hoy.strip.sym.gspc", "invest.hoy.strip.sym.dji", "invest.hoy.strip.sym.ixic", "invest.hoy.strip.sym.rut", "invest.hoy.strip.sym.oil", "invest.hoy.strip.sym.eurusd", "invest.hoy.strip.sym.btc", "invest.hoy.pvh.cmp.SPY", "invest.hoy.pvh.cmp.ECH", "invest.hoy.pvh.range.1M", "invest.hoy.pvh.range.3M", "invest.hoy.pvh.range.1A", "invest.hoy.pvh.rangeName.3M", "invest.hoy.pvh.say", "invest.hoy.pvh.sayIndex", "invest.hoy.top.sorted", "invest.hoy.top.result", "invest.hoy.top.weight", "invest.hoy.cash.contributed", "invest.hoy.ctx.vix.normal", "invest.hoy.ctx.vix.high", "invest.hoy.ctx.vix.extreme", "invest.hoy.ctx.see", "invest.hoy.empty.import",
    'mov.filter.btn', // Poda P2: "Filtrar" es igual en portugués
    // Invest F0 (20-nov-2026): "{n} resultados" y "Gráfico de velas de {t}, últimos 6 meses" son iguales en portugués.
    'invest.search.count.many', 'invest.chart.label',
    'conv.shareText', // B2: solo variables y signos ("{from} = {to} · {rate} ({source}, {date})")
    'refcur.source.crossEur', // rial #20: "{base} × EUR/USD Fixer", variable + nombres propios
    'conv.hist.unit', 'conv.hist.stats', // B2b: "{source}, {code} por 1 US$" y "Mín./Máx.": iguales en portugués
    // Ola 1 de diseño visual (21-oct-2026): cognados correctos en portugués.
    'ui.state.overBudget',
    // Ola 2 (21-oct-2026): cognados correctos en portugués.
    'budgets.model.col.group',
    'chart.expensesPrev',
    'goals.status.behind',
    'movl.title',
    'movl.summary.one',
    'movl.summary.many',
    'movl.search.label',
    'movl.filter.label',
    'movl.filter.all',
    'movl.filter.oneoff',
    'movl.count',
    'movl.sheet.editTitle',
    'movl.sheet.edit',
    'movl.sheet.type',
    'movl.sheet.notes',
    'proTrial.hide', // "Ocultar esta lista": igual en pt (PRD-4)
    "adv.kpi.budgetsOver",
    "adv.pdf.export",
    "adv.score.client",
    "adv.tl.budgets.over",
    "ahorroFiscal.card.rothVsTraditional",
    "ahorroFiscal.coverage.self",
    "ahorroFiscal.form.annualContribUSD",
    "ahorroFiscal.rothFutureValue",
    "apdf.alerts",
    "apdf.clientLine",
    "apdf.subsAnnual",
    "apv.indicators",
    "apv.useAutoValue",
    "authGate.passwordPlaceholderSignup",
    "backup.cloud.connected",
    "backup.cloud.syncing",
    "budgets.cat.base",
    "budgets.group.lifestyle",
    "budgets.model.title",
    "cat.Plataforma digital",
    "cf.kpi.trendDown",
    "cf.pace.fast",
    "cf.pace.high",
    "chart.debt.due",
    "chart.goal.totalSaved",
    "coach.badge.review",
    "country.US",
    "dash.action.viewCoach",
    "dash.chart.bar.sub",
    "dash.coachLink.btn",
    "dash.kpi.records",
    "dash.signals.viewAll",
    "dash.trend.down",
    "dash.trend.up",
    "debts.card.due",
    "debts.card.monthsLeft",
    "debts.card.totalLeft",
    "debts.uf.balance",
    "demo.tour.count",
    "expsub.Apps / Software",
    "expsub.Cursos online",
    "expsub.Material escolar",
    "expsub.Médico / Consulta",
    "expsub.Transporte público",
    "goals.card.remaining",
    "goals.emergencyAdjustBtn",
    "goals.first.emergencySub",
    "goals.first.purchaseName",
    "goals.kpi.target",
    "goals.suggest.target",
    "goals.suggestBtn",
    "home.delta.vs",
    "imp.map.debitCredit",
    "imp.review.all",
    "income.sub",
    "licenseGate.keyFormat",
    "licenseGate.version",
    "lock.screen.pinProgress",
    "mov.kpi.oneOff",
    "mov.list.expenses",
    "multimoneda.result.breakdown",
    "nav.resicoMX",
    "onboarding.v2.currencySuggested",
    "ppr.form.expectedReturn",
    "ppr.proGateFeature",
    "projects.equity",
    "projects.estValue",
    "projects.linkedMortgage",
    "projects.setValue",
    "qa.repeat",
    "qa.title",
    "rec.action.confirmAria",
    "rec.live.confirmed",
    "rec.page.thisMonth",
    "rec.rule.auto",
    "rec.rule.historyFrom",
    "rec.rule.next",
    "refcur.sheet.perUsd",
    "refcur.source.oficial",
    "reports.diag.linkBtn",
    "reports.rule.idealPct",
    "reports.subs.annual",
    "resicomx.income.useAuto",
    "resicomx.result.saldoFavor",
    "resicomx.title",
    "settings.diagnostics.btn",
    "settings.exchangeRate.perUsd",
    "settings.install.installed.label",
    "settings.install.title",
    "settings.language.sub",
    "settings.taxId.invalidFormat",
    "settings.taxId.title",
    "settings.taxId.valid",
    "steps.count",
    "steuer.elster.total",
    "steuer.lohn.kirche",
    "subs.form.namePh",
    "tour.count",
    "tpl.personal.budgetNote.1",
    "tplsel.suggestedGoals",
    "ui.editItem",
  ]),
  en: new Set([
    'la.fixedDue.body', // avisos locales: solo variables ('{name}: {amount}.')
    // Invest F2, Hoy (20-nov-2026): nombres de índices, tickers y cognados iguales en este idioma.
    "invest.hoy.strip.sym.gspc", "invest.hoy.strip.sym.dji", "invest.hoy.strip.sym.ixic", "invest.hoy.strip.sym.rut", "invest.hoy.strip.sym.btc", "invest.hoy.pvh.cmp.SPY", "invest.hoy.pvh.cmp.ECH", "invest.hoy.pvh.range.1M", "invest.hoy.pvh.range.3M", "invest.hoy.pvh.say", "invest.hoy.pvh.sayIndex", "invest.hoy.ctx.vix.normal",
    'conv.shareText', // B2: solo variables y signos ("{from} = {to} · {rate} ({source}, {date})")
    'refcur.source.crossEur', // rial #20: "{base} × EUR/USD Fixer", variable + nombres propios
    "ahorroFiscal.card.rothVsTraditional",
    "ahorroFiscal.coverage.self",
    "apv.indicators",
    "budgets.cat.base",
    "expsub.Apps / Software",
    "expsub.Gym / Fitness",
    "home.delta.vs",
    "licenseGate.keyFormat",
    "licenseGate.version",
    "reports.rule.idealPct",
    "resicomx.title",
    "settings.language.sub",
    "steuer.elster.total",
    "steuer.lohn.kirche",
    "subs.form.namePh",
  ]),
  de: new Set([
    'la.fixedDue.body', // avisos locales: solo variables ('{name}: {amount}.')
    // Invest F2, Hoy (20-nov-2026): nombres de índices, tickers y cognados iguales en este idioma.
    "invest.hoy.strip.sym.gspc", "invest.hoy.strip.sym.dji", "invest.hoy.strip.sym.ixic", "invest.hoy.strip.sym.rut", "invest.hoy.strip.sym.btc", "invest.hoy.pvh.cmp.SPY", "invest.hoy.pvh.cmp.ECH", "invest.hoy.pvh.range.1M", "invest.hoy.pvh.range.3M", "invest.hoy.pvh.say", "invest.hoy.pvh.sayIndex", "invest.hoy.ctx.vix.normal",
    'conv.shareText', // B2: solo variables y signos ("{from} = {to} · {rate} ({source}, {date})")
    'refcur.source.crossEur', // rial #20: "{base} × EUR/USD Fixer", variable + nombres propios
    'reports.rule.idealPct', // "{actual} / {max} ideal {mark}": solo variables + "ideal" (igual en alemán)
    "ahorroFiscal.card.rothVsTraditional",
    "apv.indicators",
    "debts.uf.balance",
    "expsub.Apps / Software",
    "licenseGate.keyFormat",
    "licenseGate.version",
    "resicomx.title",
    "settings.language.sub",
    "steuer.lohn.kirche",
    "subs.form.namePh",
  ]),
}

const identical = (dict) => Object.keys(es).filter(k => dict[k] === es[k] && es[k].length > 12)

describe('claves idénticas al español (ING-14)', () => {
  for (const [lang, dict] of [['pt', pt], ['en', en], ['de', de]]) {
    it(`${lang}: solo las revisadas`, () => {
      expect(identical(dict).filter(k => !ALLOWED[lang].has(k))).toEqual([])
    })
  }
})
