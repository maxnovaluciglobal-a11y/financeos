// src/pages/Reports/ReportPDF.jsx
// PDF mensual de FinanceOS — @react-pdf/renderer (sin recharts, barras con View)

import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer'
import { PDF_FONT as F, PDF_COLOR as P } from '../pdfTheme.js'
import { fmtMoney, catName } from '../../utils/index.js'
import { translate } from '../../i18n/translate.js'

// Colores y fuentes de la marca (pdfTheme.js, BRD-8).
const ACCENT  = P.pos         // positivo/ingreso, no la marca
const BRAND   = P.latonOnNavy // Latón sobre la cabecera Navy
const RED     = P.neg
const AMBER   = P.warn
const DARK    = P.navy
const GRAY    = P.muted
const LGRAY   = P.card
const WHITE   = P.page

const s = StyleSheet.create({
  page:    { fontFamily: F.body, backgroundColor: WHITE, paddingHorizontal: 36, paddingVertical: 32, fontSize: 9, color: DARK },
  // Header
  header:  { backgroundColor: DARK, marginHorizontal: -36, marginTop: -32, paddingHorizontal: 36, paddingVertical: 20, marginBottom: 20, borderBottomWidth: 3, borderBottomColor: P.laton },
  wordmark:{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  plate:   { backgroundColor: P.laton, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 5 },
  plateTx: { fontSize: 15, fontFamily: F.display, fontWeight: 600, color: DARK },
  hTitle:  { fontSize: 20, fontFamily: F.display, fontWeight: 600, color: P.page, letterSpacing: 0.2, marginBottom: 3 },
  hSub:    { fontSize: 9, color: BRAND, fontFamily: F.body },
  hRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  hMeta:   { fontSize: 8, color: P.navySub, textAlign: 'right' },
  // Section
  section: { marginBottom: 16 },
  secTitle:{ fontSize: 11, fontFamily: F.display, fontWeight: 600, color: DARK, marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${P.line}` },
  // KPI grid
  kpiRow:  { flexDirection: 'row', gap: 8, marginBottom: 4 },
  kpiBox:  { flex: 1, backgroundColor: LGRAY, borderRadius: 4, padding: '8 10' },
  kpiLabel:{ fontSize: 7, color: GRAY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  kpiVal:  { fontSize: 14, fontFamily: F.mono, fontWeight: 600 },
  kpiSub:  { fontSize: 7, color: GRAY, marginTop: 2 },
  // Bars
  barRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  barLabel:{ width: 90, fontSize: 8, color: DARK },
  barTrack:{ flex: 1, height: 10, backgroundColor: LGRAY, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 3 },
  barAmt:  { width: 68, fontSize: 8, textAlign: 'right', fontFamily: F.mono, fontWeight: 600, color: DARK },
  // Trend table
  tRow:    { flexDirection: 'row', borderBottom: `0.5px solid ${LGRAY}`, paddingVertical: 4 },
  tHead:   { backgroundColor: LGRAY },
  tCell:   { flex: 1, fontSize: 8 },
  tCellR:  { flex: 1, fontSize: 8, textAlign: 'right' },
  // Rules
  ruleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  ruleLabel:{ width: 140, fontSize: 8 },
  ruleTrack:{ flex: 1, height: 8, backgroundColor: LGRAY, borderRadius: 3, overflow: 'hidden', marginHorizontal: 6 },
  rulePct: { width: 60, fontSize: 8, textAlign: 'right' },
  // Recs
  recBox:  { borderRadius: 4, padding: '6 10', marginBottom: 5 },
  recText: { fontSize: 8, lineHeight: 1.5 },
  // Footer
  footer:  { position: 'absolute', bottom: 20, left: 36, right: 36 },
  footTxt: { fontSize: 7, color: GRAY, textAlign: 'center', lineHeight: 1.4 },
  divider: { borderTop: `0.5px solid ${LGRAY}`, marginVertical: 10 },
  // Badge
  badge:   { borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeTxt:{ fontSize: 7, fontFamily: F.body, fontWeight: 700 },
})

// Con los decimales de la moneda. Signo ASCII "-" a propósito: la Helvetica
// integrada de react-pdf (WinAnsi) no tiene el "−" tipográfico.
function fmt(n, sym = '$') {
  const v = Number(n) || 0
  return (v < 0 && fmtMoney(v, sym) !== fmtMoney(0, sym) ? '-' : '') + fmtMoney(v, sym)
}
function pct(n) { return `${((Number(n) || 0) * 100).toFixed(1)}%` }

const CAT_COLORS = [
  P.navy, P.laton, P.pos, P.warn, P.info,
  P.neg, '#4A5875', P.laton700, P.posMid, '#5F5236',
]

export default function ReportPDF({ data }) {
  const {
    sym, month, monthLabel,
    totalIncome, totalExpense, totalSubs, totalDebt, balance, savingRate,
    savingGoalPct, necesidad, deseos, expByCat, trendData,
    overBudget, currency, generatedAt, netWorth, lang = 'es',
  } = data
  // react-pdf renderiza fuera del árbol de React de la app (sin AppContext):
  // el idioma llega en data.lang y se traduce con translate() directo.
  const t = (key, vars) => translate(lang, key, vars)

  const catEntries = Object.entries(expByCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  const maxCat = catEntries[0]?.[1] || 1

  const maxTrend = Math.max(...trendData.flatMap(d => [d.Ingresos, d.Gastos]), 1)

  const recs = []
  if (savingRate >= 0.25) {
    recs.push({ type: 'ok', text: t('rpdf.rec.savingOk', { rate: pct(savingRate), goal: savingGoalPct }) })
  } else {
    recs.push({ type: 'warn', text: t('rpdf.rec.savingLow', { rate: pct(savingRate), goal: savingGoalPct }) })
  }
  if (overBudget.length > 0) {
    recs.push({ type: 'danger', text: t('rpdf.rec.over', { cats: overBudget.map(b => catName(b.category, lang)).join(', ') }) })
  } else {
    recs.push({ type: 'ok', text: t('rpdf.rec.allOk') })
  }
  if (deseos > 0 && totalExpense > 0) {
    const dp = deseos / totalExpense
    recs.push({ type: dp > 0.3 ? 'warn' : 'info', text: t('rpdf.rec.wants', { amount: fmt(deseos, sym), pct: pct(deseos / (totalIncome || 1)) }) })
  }
  if (totalSubs > 0) {
    recs.push({ type: 'info', text: t('rpdf.rec.subs', { month: fmt(totalSubs, sym), year: fmt(totalSubs * 12, sym) }) })
  }

  const recColors = { ok: { bg: P.posBg, txt: P.pos }, warn: { bg: P.warnBg, txt: P.warn }, danger: { bg: P.negBg, txt: P.neg }, info: { bg: P.infoBg, txt: P.info } }

  return (
    <Document title={t('rpdf.docTitle', { month: monthLabel })} author="MOY IQ" creator="MOY IQ v1.5">
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.hRow}>
            <View>
              <View style={s.wordmark}>
                <Text style={[s.hTitle, { marginBottom: 0 }]}>MOY</Text>
                <View style={s.plate}><Text style={s.plateTx}>IQ</Text></View>
              </View>
              <Text style={s.hSub}>{t('rpdf.sub', { month: monthLabel })}</Text>
            </View>
            <View>
              <Text style={s.hMeta}>{t('rpdf.generated', { date: generatedAt })}</Text>
              <Text style={s.hMeta}>{t('rpdf.currency', { currency })}</Text>
              <Text style={s.hMeta}>{t('rpdf.guidance')}</Text>
            </View>
          </View>
        </View>

        {/* KPIs */}
        <View style={s.section}>
          <Text style={s.secTitle}>{t('rpdf.summary')}</Text>
          <View style={s.kpiRow}>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>{t('chart.income')}</Text>
              <Text style={[s.kpiVal, { color: ACCENT }]}>{fmt(totalIncome, sym)}</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>{t('chart.expenses')}</Text>
              <Text style={[s.kpiVal, { color: RED }]}>{fmt(totalExpense, sym)}</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>{t('rpdf.net')}</Text>
              <Text style={[s.kpiVal, { color: balance >= 0 ? ACCENT : RED }]}>{fmt(balance, sym)}</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>{t('rpdf.savingRate')}</Text>
              <Text style={[s.kpiVal, { color: savingRate >= 0.2 ? ACCENT : savingRate >= 0.1 ? AMBER : RED }]}>{pct(savingRate)}</Text>
              <Text style={s.kpiSub}>{t('rpdf.goal', { pct: savingGoalPct })}</Text>
            </View>
          </View>
          <View style={s.kpiRow}>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>{t('chart.flow.subs')}</Text>
              <Text style={[s.kpiVal, { color: AMBER, fontSize: 11 }]}>{t('rpdf.perMonth', { amount: fmt(totalSubs, sym) })}</Text>
              <Text style={s.kpiSub}>{t('rpdf.perYear', { amount: fmt(totalSubs * 12, sym) })}</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>{t('chart.flow.debt')}</Text>
              <Text style={[s.kpiVal, { color: RED, fontSize: 11 }]}>{t('rpdf.perMonth', { amount: fmt(totalDebt, sym) })}</Text>
            </View>
            {netWorth && (
              <View style={s.kpiBox}>
                <Text style={s.kpiLabel}>{t('rpdf.netWorth')}</Text>
                <Text style={[s.kpiVal, { color: netWorth.netWorth >= 0 ? ACCENT : RED, fontSize: 11 }]}>{fmt(netWorth.netWorth, sym)}</Text>
                <Text style={s.kpiSub}>{t('rpdf.assetsLiabilities', { assets: fmt(netWorth.totalActivos, sym), liabilities: fmt(netWorth.totalPasivos, sym) })}</Text>
              </View>
            )}
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>{t('rpdf.needs')}</Text>
              <Text style={[s.kpiVal, { fontSize: 11 }]}>{fmt(necesidad, sym)}</Text>
              <Text style={s.kpiSub}>{t('rpdf.ofSpending', { pct: totalExpense > 0 ? pct(necesidad / totalExpense) : '—' })}</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>{t('rpdf.wants')}</Text>
              <Text style={[s.kpiVal, { fontSize: 11 }]}>{fmt(deseos, sym)}</Text>
              <Text style={s.kpiSub}>{t('rpdf.ofSpending', { pct: totalExpense > 0 ? pct(deseos / totalExpense) : '—' })}</Text>
            </View>
          </View>
        </View>

        {/* Gastos por categoría */}
        {catEntries.length > 0 && (
          <View style={s.section}>
            <Text style={s.secTitle}>{t('rpdf.byCategory')}</Text>
            {catEntries.map(([cat, amt], i) => {
              const w = (amt / maxCat) * 100
              return (
                <View key={cat} style={s.barRow}>
                  <Text style={s.barLabel}>{catName(cat, lang)}</Text>
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { width: `${w}%`, backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }]} />
                  </View>
                  <Text style={s.barAmt}>{fmt(amt, sym)}</Text>
                  <Text style={[s.barAmt, { color: GRAY, width: 36 }]}>
                    {totalExpense > 0 ? pct(amt / totalExpense) : ''}
                  </Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Tendencia 6 meses */}
        <View style={s.section}>
          <Text style={s.secTitle}>{t('rpdf.trend')}</Text>
          {/* Mini barras horizontales por mes */}
          {trendData.map((d) => (
            <View key={d.mes} style={{ marginBottom: 6 }}>
              <Text style={{ fontSize: 7, color: GRAY, marginBottom: 2 }}>{d.mes}</Text>
              <View style={s.barRow}>
                <Text style={[s.barLabel, { width: 54, color: ACCENT }]}>{t('chart.income')}</Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${(d.Ingresos / maxTrend) * 100}%`, backgroundColor: ACCENT }]} />
                </View>
                <Text style={s.barAmt}>{fmt(d.Ingresos, sym)}</Text>
              </View>
              <View style={s.barRow}>
                <Text style={[s.barLabel, { width: 54, color: RED }]}>{t('chart.expenses')}</Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${(d.Gastos / maxTrend) * 100}%`, backgroundColor: RED }]} />
                </View>
                <Text style={s.barAmt}>{fmt(d.Gastos, sym)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Regla 50/30/20 */}
        {totalIncome > 0 && (
          <View style={s.section}>
            <Text style={s.secTitle}>{t('rpdf.rule')}</Text>
            {[
              { key: 'needs',   label: t('rpdf.rule.needsDebt'), actual: necesidad + totalDebt, ideal: 0.5, color: ACCENT },
              { key: 'wants',   label: t('rpdf.wants'),          actual: deseos,               ideal: 0.3, color: AMBER },
              { key: 'savings', label: t('rpdf.rule.savings'),   actual: Math.max(0, balance), ideal: 0.2, color: P.info },
            ].map(r => {
              const ap = totalIncome > 0 ? r.actual / totalIncome : 0
              const ok = r.key === 'savings' ? ap >= r.ideal : ap <= r.ideal
              return (
                <View key={r.key} style={s.ruleRow}>
                  <Text style={s.ruleLabel}>{r.label}</Text>
                  <View style={s.ruleTrack}>
                    <View style={[s.barFill, { width: `${Math.min(ap / r.ideal, 1) * 100}%`, backgroundColor: ok ? r.color : RED }]} />
                  </View>
                  <Text style={[s.rulePct, { color: ok ? ACCENT : RED }]}>
                    {pct(ap)} / {pct(r.ideal)} {ok ? '✓' : '⚠'}
                  </Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Recomendaciones */}
        <View style={s.section}>
          <Text style={s.secTitle}>{t('rpdf.recs')}</Text>
          {recs.map((r, i) => (
            <View key={i} style={[s.recBox, { backgroundColor: recColors[r.type]?.bg || LGRAY }]}>
              <Text style={[s.recText, { color: recColors[r.type]?.txt || DARK }]}>{r.text}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <View style={s.divider} />
          <Text style={s.footTxt}>
            {t('rpdf.footer')}
          </Text>
        </View>

      </Page>
    </Document>
  )
}
