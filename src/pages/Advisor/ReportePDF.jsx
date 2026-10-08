// src/pages/Advisor/ReportePDF.jsx
// Reporte PDF profesional — FinanceOS Fase 5
// Usa @react-pdf/renderer para generar PDF real con texto seleccionable
// AVISO: Contenido informativo. No constituye asesoría financiera certificada.

import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer'
import { fmtMoney, fmtPct, dateLocale, catName, prioLabel, subLabel, monthYearLabel } from '../../utils/index.js'
import { translate } from '../../i18n/translate.js'
import config from '../../config.js'

// ── COLORES ──────────────────────────────────────────────────────────────────
const C = {
  ink:     '#0f0e0c',
  ink2:    '#3a3828',
  ink3:    '#7a7868',
  ink4:    '#b0ae9e',
  paper:   '#faf9f5',
  card:    '#f5f4f0',
  grn:     '#356E57',   // --pos / verde-800
  grn2:    '#5FA98C',   // --verde
  grn3:    '#74C2A3',   // --verde-dark
  grnL:    '#E7F0EA',
  amb:     '#9C5419',   // --warning-800
  ambL:    '#F3E4CE',
  red:     '#A23E2E',   // --error
  redL:    '#F5E6E3',
  brd:     '#e8e4d8',
  white:   '#ffffff',
}

// ── ESTILOS ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    backgroundColor: C.paper,
    paddingTop: 48, paddingBottom: 52,
    paddingLeft: 44, paddingRight: 44,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.ink2,
    lineHeight: 1.5,
  },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingBottom: 14, borderBottomWidth: 1.5, borderBottomColor: C.grn,
    marginBottom: 20,
  },
  headerLeft: {},
  brandName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.grn, letterSpacing: -0.5, marginBottom: 2 },
  brandSub:  { fontSize: 8, color: C.ink3, letterSpacing: 0.5 },
  headerRight: { alignItems: 'flex-end' },
  reportTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 3 },
  reportMeta:  { fontSize: 8, color: C.ink3, marginBottom: 1 },

  // Score banner
  scoreBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: C.card, borderRadius: 8, padding: '12 16',
    marginBottom: 16, borderWidth: 0.5, borderColor: C.brd,
  },
  scoreCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3,
  },
  scoreNum:   { fontSize: 18, fontFamily: 'Helvetica-Bold', lineHeight: 1.1 },
  scoreDen:   { fontSize: 7, color: C.ink4 },
  scoreLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  scoreSub:   { fontSize: 8, color: C.ink3 },

  // Secciones
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.grn,
    textTransform: 'uppercase', letterSpacing: 0.8,
    borderBottomWidth: 0.5, borderBottomColor: C.brd,
    paddingBottom: 5, marginBottom: 8,
  },

  // KPI grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kpiBox: {
    width: '22.5%', backgroundColor: C.card,
    borderRadius: 6, padding: '8 10',
    borderWidth: 0.5, borderColor: C.brd,
  },
  kpiLabel: { fontSize: 7, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  kpiValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', letterSpacing: -0.3 },
  kpiSub:   { fontSize: 7, color: C.ink3, marginTop: 2 },

  // Semáforo
  signalRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: '7 10', borderRadius: 6, marginBottom: 4,
  },
  signalDot:   { width: 8, height: 8, borderRadius: 4 },
  signalLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', flex: 1 },
  signalNote:  { fontSize: 8, color: C.ink3, flex: 2 },
  signalBadge: { fontSize: 7, fontFamily: 'Helvetica-Bold', padding: '2 7', borderRadius: 10 },

  // Alertas
  alertBox: {
    flexDirection: 'row', gap: 8, padding: '8 10',
    borderRadius: 6, marginBottom: 5,
    borderLeftWidth: 2.5,
  },
  alertIcon: { fontSize: 9, width: 14, flexShrink: 0, marginTop: 1 },
  alertText: { fontSize: 8.5, lineHeight: 1.5, flex: 1 },

  // Tabla
  table:     { borderWidth: 0.5, borderColor: C.brd, borderRadius: 6, overflow: 'hidden' },
  tableHead: { flexDirection: 'row', backgroundColor: C.card, borderBottomWidth: 0.5, borderBottomColor: C.brd },
  tableRow:  { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.brd },
  tableRowLast: { flexDirection: 'row' },
  thCell:    { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.ink3, padding: '6 8', textTransform: 'uppercase', letterSpacing: 0.3 },
  tdCell:    { fontSize: 8.5, color: C.ink2, padding: '6 8' },

  // Notas del asesor
  notesBox: {
    backgroundColor: C.grnL, borderRadius: 8, padding: '12 14',
    borderWidth: 0.5, borderColor: '#C7DBD0',
  },
  notesLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.grn2, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  notesText:  { fontSize: 9, color: C.grn, lineHeight: 1.6 },

  // Próximos pasos
  stepRow:  { flexDirection: 'row', gap: 8, marginBottom: 6, alignItems: 'flex-start' },
  stepNum:  { width: 18, height: 18, borderRadius: 9, backgroundColor: C.grn, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumTx:{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.white },
  stepText: { fontSize: 9, color: C.ink2, lineHeight: 1.5, flex: 1, paddingTop: 2 },

  // Progress bar
  barWrap: { height: 5, backgroundColor: C.brd, borderRadius: 3, overflow: 'hidden', marginTop: 3 },
  barFill: { height: 5, borderRadius: 3 },

  // Meta row
  goalRow: { marginBottom: 8 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  goalName: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.ink },
  goalAmt:  { fontSize: 8, color: C.ink3 },
  goalSub:  { fontSize: 7.5, color: C.ink4 },

  // Footer
  footer: {
    position: 'absolute', bottom: 24, left: 44, right: 44,
    borderTopWidth: 0.5, borderTopColor: C.brd,
    paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between',
  },
  footerLeft:  { fontSize: 7, color: C.ink4, flex: 1, lineHeight: 1.4 },
  footerRight: { fontSize: 7, color: C.ink4, textAlign: 'right' },

  // Disclaimer
  disclaimer: {
    backgroundColor: C.card, borderRadius: 6, padding: '10 12',
    borderWidth: 0.5, borderColor: C.brd, marginTop: 8,
  },
  disclaimerText: { fontSize: 7.5, color: C.ink3, lineHeight: 1.6 },

  divider: { height: 0.5, backgroundColor: C.brd, marginVertical: 12 },

  pageNum: { fontSize: 7, color: C.ink4, textAlign: 'center', marginTop: 4 },
})

// ── HELPERS ───────────────────────────────────────────────────────────────────
const STATUS_COLORS = { green: C.grn3, yellow: '#9C5419', red: C.red }
const STATUS_BG     = { green: C.grnL, yellow: C.ambL,    red: C.redL }

function today() {
  return new Date().toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' })
}

// "Marzo 2026" / "March 2026" / "März 2026" — mes completo en el idioma de la
// interfaz (dateLocale), con mayúscula inicial (es/pt lo dan en minúscula).
function monthLabel(m) {
  if (!m) return '—'
  const [y, mo] = m.split('-').map(Number)
  let s = ''
  try { s = new Date(y, mo - 1, 1).toLocaleDateString(dateLocale(), { month: 'long' }) } catch {}
  return s ? `${s.charAt(0).toUpperCase()}${s.slice(1)} ${y}` : monthYearLabel(m)
}

function parseSteps(text) {
  if (!text) return []
  return text.split('\n').filter(l => l.trim()).map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
}

// ── DOCUMENT COMPONENT ────────────────────────────────────────────────────────
export function ReporteFinancieroPDF({ data }) {
  const {
    brandName, clientName, activeMonth, sym,
    mIncome, mExpense, mBalance, savingRate,
    totalDebt, totalMinPayments,
    signals, alerts, goals, debts,
    overBudgetCount, score, scoreLabel, scoreColor,
    advisorNotes,
    expByCategory,
    subMonthly, subAnnual, subCount, subAlerts, subByCategory, netWorth,
    lang = 'es',
  } = data
  // react-pdf renderiza fuera del árbol de la app: idioma por data.lang.
  const t = (key, vars) => translate(lang, key, vars)
  const client = clientName || t('apdf.client')

  const steps = parseSteps(advisorNotes?.nextSteps || '')

  return (
    <Document
      title={t('apdf.docTitle', { client, month: monthLabel(activeMonth) })}
      author={brandName}
      subject={t('apdf.subject')}
      creator="MOY IQ · MAXNOVA & LUCI Global LLC"
    >
      {/* ── PÁGINA 1 — Resumen ejecutivo ── */}
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.brandName}>{brandName}</Text>
            <Text style={s.brandSub}>{t('apdf.brandSub')}</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.reportTitle}>{t('apdf.title')}</Text>
            <Text style={s.reportMeta}>{t('apdf.clientLine', { client: clientName || t('apdf.noName') })}</Text>
            <Text style={s.reportMeta}>{t('apdf.period', { month: monthLabel(activeMonth) })}</Text>
            <Text style={s.reportMeta}>{t('apdf.date', { date: today() })}</Text>
          </View>
        </View>

        {/* Score banner */}
        <View style={s.scoreBanner}>
          <View style={[s.scoreCircle, { borderColor: scoreColor }]}>
            <Text style={[s.scoreNum, { color: scoreColor }]}>{score}</Text>
            <Text style={s.scoreDen}>/100</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.scoreLabel, { color: scoreColor }]}>{scoreLabel}</Text>
            <Text style={s.scoreSub}>
              {t('apdf.signalsSummary', {
                green: signals.filter(sg => sg.status === 'green').length,
                yellow: signals.filter(sg => sg.status === 'yellow').length,
                red: signals.filter(sg => sg.status === 'red').length,
              })}
            </Text>
            {advisorNotes?.meetingDate && (
              <Text style={[s.scoreSub, { marginTop: 3, color: C.grn2 }]}>
                {t('apdf.nextMeeting', { date: new Date(advisorNotes.meetingDate + 'T12:00').toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) })}
              </Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7, color: C.ink4, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('apdf.scoreTitle')}</Text>
            <Text style={{ fontSize: 7, color: C.ink4, marginTop: 2 }}>{t('apdf.scoreBasis', { n: signals.length })}</Text>
          </View>
        </View>

        {/* Métricas clave */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('apdf.metrics')}</Text>
          <View style={s.kpiGrid}>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>{t('apdf.income')}</Text>
              <Text style={[s.kpiValue, { color: C.grn }]}>{fmtMoney(mIncome, sym)}</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>{t('apdf.expense')}</Text>
              <Text style={[s.kpiValue, { color: mExpense > mIncome ? C.red : C.ink }]}>{fmtMoney(mExpense, sym)}</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>{t('apdf.netFlow')}</Text>
              <Text style={[s.kpiValue, { color: mBalance >= 0 ? C.grn : C.red }]}>{fmtMoney(mBalance, sym)}</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>{t('rpdf.savingRate')}</Text>
              <Text style={[s.kpiValue, { color: savingRate >= 0.2 ? C.grn : savingRate >= 0.1 ? '#9C5419' : C.red }]}>{fmtPct(savingRate)}</Text>
              <Text style={s.kpiSub}>{t('apdf.goalPlus')}</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>{t('apdf.totalDebt')}</Text>
              <Text style={[s.kpiValue, { color: totalDebt > 0 ? '#9C5419' : C.grn }]}>{fmtMoney(totalDebt, sym)}</Text>
              {totalDebt > 0 && <Text style={s.kpiSub}>{t('apdf.minPerMonth', { amount: fmtMoney(totalMinPayments, sym) })}</Text>}
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>{t('apdf.activeGoals')}</Text>
              <Text style={s.kpiValue}>{goals.length}</Text>
              <Text style={s.kpiSub}>{overBudgetCount > 0 ? t('apdf.overBudget', { n: overBudgetCount }) : t('apdf.budgetsOk')}</Text>
            </View>
            {netWorth && (
              <View style={s.kpiBox}>
                <Text style={s.kpiLabel}>{t('rpdf.netWorth')}</Text>
                <Text style={[s.kpiValue, { color: netWorth.netWorth >= 0 ? C.grn : C.red }]}>{fmtMoney(netWorth.netWorth, sym)}</Text>
                <Text style={s.kpiSub}>{t('rpdf.assetsLiabilities', { assets: fmtMoney(netWorth.totalActivos, sym), liabilities: fmtMoney(netWorth.totalPasivos, sym) })}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Semáforo */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('apdf.trafficLight')}</Text>
          {signals.map((sg, i) => (
            <View key={i} style={[s.signalRow, { backgroundColor: STATUS_BG[sg.status] }]}>
              <View style={[s.signalDot, { backgroundColor: STATUS_COLORS[sg.status] }]} />
              <Text style={s.signalLabel}>{sg.label}</Text>
              <Text style={s.signalNote}>{sg.note}</Text>
              <Text style={[s.signalBadge, { color: STATUS_COLORS[sg.status], backgroundColor: `${STATUS_COLORS[sg.status]}18` }]}>
                {t(`apdf.status.${sg.status}`)}
              </Text>
            </View>
          ))}
          <Text style={{ fontSize: 7, color: C.ink4, marginTop: 5, lineHeight: 1.4 }}>
            {t('apdf.signalsNote')}
          </Text>
        </View>

        {/* Alertas */}
        {alerts.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('apdf.alerts', { n: alerts.length })}</Text>
            {alerts.slice(0, 5).map((a, i) => {
              const alertColors = {
                danger: { bg: C.redL, border: C.red, icon: '⚠' },
                warn:   { bg: C.ambL, border: '#9C5419', icon: '→' },
                info:   { bg: '#E9EEF2', border: '#5B7A99', icon: 'ℹ' },
              }
              const ac = alertColors[a.type] || alertColors.info
              return (
                <View key={i} style={[s.alertBox, { backgroundColor: ac.bg, borderLeftColor: ac.border }]}>
                  <Text style={s.alertIcon}>{ac.icon}</Text>
                  <Text style={s.alertText}>{a.text}</Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Footer pág 1 */}
        <View style={s.footer} fixed>
          <Text style={s.footerLeft}>
            {t('apdf.footer', { brand: brandName, date: today() })}
          </Text>
          <Text style={s.footerRight} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>

      </Page>

      {/* ── PÁGINA 2 — Deudas, Metas, Notas y Próximos pasos ── */}
      <Page size="A4" style={s.page}>

        {/* Header mínimo */}
        <View style={[s.header, { borderBottomWidth: 0.5, borderBottomColor: C.brd, marginBottom: 16, paddingBottom: 10 }]}>
          <Text style={[s.brandName, { fontSize: 13 }]}>{brandName}</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.reportMeta, { fontFamily: 'Helvetica-Bold', color: C.ink }]}>
              {client} · {monthLabel(activeMonth)}
            </Text>
            <Text style={s.reportMeta}>{t('apdf.page2Sub')}</Text>
          </View>
        </View>

        {/* Deudas */}
        {debts.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('apdf.debts')}</Text>
            <View style={s.table}>
              <View style={s.tableHead}>
                <Text style={[s.thCell, { flex: 3 }]}>{t('apdf.creditor')}</Text>
                <Text style={[s.thCell, { flex: 2, textAlign: 'right' }]}>{t('apdf.balance')}</Text>
                <Text style={[s.thCell, { flex: 2, textAlign: 'right' }]}>{t('apdf.minPayment')}</Text>
                <Text style={[s.thCell, { flex: 1, textAlign: 'right' }]}>{t('apdf.rate')}</Text>
                <Text style={[s.thCell, { flex: 2, textAlign: 'right' }]}>{t('apdf.paidPct')}</Text>
              </View>
              {debts.map((d, i) => {
                const pct = d.initial > 0 ? (d.initial - d.balance) / d.initial : 0
                const isLast = i === debts.length - 1
                return (
                  <View key={d.id} style={isLast ? s.tableRowLast : s.tableRow}>
                    <Text style={[s.tdCell, { flex: 3, fontFamily: 'Helvetica-Bold', color: C.ink }]}>{d.creditor}</Text>
                    <Text style={[s.tdCell, { flex: 2, textAlign: 'right', color: '#9C5419', fontFamily: 'Helvetica-Bold' }]}>{fmtMoney(d.balance, sym)}</Text>
                    <Text style={[s.tdCell, { flex: 2, textAlign: 'right' }]}>{t('rpdf.perMonth', { amount: fmtMoney(d.minPayment || 0, sym) })}</Text>
                    <Text style={[s.tdCell, { flex: 1, textAlign: 'right', color: d.rate > 15 ? C.red : C.ink2 }]}>{d.rate}%</Text>
                    <Text style={[s.tdCell, { flex: 2, textAlign: 'right', color: C.grn2 }]}>{fmtPct(pct)}</Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* Metas */}
        {goals.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('apdf.goals')}</Text>
            {goals.map((g, i) => {
              const pct = g.target > 0 ? Math.min(g.saved / g.target, 1) : 0
              return (
                <View key={g.id} style={s.goalRow}>
                  <View style={s.goalHeader}>
                    <Text style={s.goalName}>{g.name}</Text>
                    <Text style={s.goalAmt}>{fmtMoney(g.saved, sym)} / {fmtMoney(g.target, sym)}</Text>
                  </View>
                  <View style={s.barWrap}>
                    <View style={[s.barFill, { width: `${pct * 100}%`, backgroundColor: g.color || C.grn }]} />
                  </View>
                  <Text style={s.goalSub}>
                    {t('apdf.goalLine', { pct: fmtPct(pct), date: g.targetDate ? monthLabel(String(g.targetDate).slice(0, 7)) : '—', priority: g.priority ? prioLabel(g.priority, lang) : '—' })}
                  </Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Gastos por categoría */}
        {Object.keys(expByCategory).length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('apdf.byCategory')}</Text>
            <View style={s.table}>
              <View style={s.tableHead}>
                <Text style={[s.thCell, { flex: 3 }]}>{t('apdf.category')}</Text>
                <Text style={[s.thCell, { flex: 2, textAlign: 'right' }]}>{t('apdf.amount')}</Text>
                <Text style={[s.thCell, { flex: 2, textAlign: 'right' }]}>{t('apdf.pctOfTotal')}</Text>
              </View>
              {Object.entries(expByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt], i, arr) => {
                const isLast = i === arr.length - 1
                return (
                  <View key={cat} style={isLast ? s.tableRowLast : s.tableRow}>
                    <Text style={[s.tdCell, { flex: 3, fontFamily: 'Helvetica-Bold' }]}>{catName(cat, lang)}</Text>
                    <Text style={[s.tdCell, { flex: 2, textAlign: 'right' }]}>{fmtMoney(amt, sym)}</Text>
                    <Text style={[s.tdCell, { flex: 2, textAlign: 'right', color: C.ink3 }]}>
                      {mExpense > 0 ? fmtPct(amt / mExpense) : '—'}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        <View style={s.divider} />

        {/* Observaciones del asesor */}
        {advisorNotes?.comments && (
          <View style={[s.section, { marginBottom: 12 }]}>
            <Text style={s.sectionTitle}>{t('apdf.observations')}</Text>
            <View style={s.notesBox}>
              <Text style={s.notesLabel}>{t('apdf.notesLabel')}</Text>
              <Text style={s.notesText}>{advisorNotes.comments}</Text>
            </View>
          </View>
        )}

        {/* Próximos pasos */}
        {steps.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('apdf.nextSteps')}</Text>
            {steps.map((step, i) => (
              <View key={i} style={s.stepRow}>
                <View style={s.stepNum}>
                  <Text style={s.stepNumTx}>{i + 1}</Text>
                </View>
                <Text style={s.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Suscripciones y gastos recurrentes */}
        {subCount > 0 && (
          <View style={[s.section, { marginBottom: 12 }]}>
            <Text style={s.sectionTitle}>{t('apdf.subs')}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              {[
                { lb: t('apdf.subsMonthly'), v: fmtMoney(subMonthly || 0, sym) },
                { lb: t('apdf.subsAnnual'), v: fmtMoney(subAnnual  || 0, sym) },
                { lb: t('apdf.subsCount'), v: `${subCount || 0}` },
                ...(mIncome > 0 ? [{ lb: t('apdf.subsPctIncome'), v: fmtPct((subMonthly || 0) / mIncome) }] : []),
              ].map(m => (
                <View key={m.lb} style={{ flex: 1, backgroundColor: C.card, padding: 8, borderRadius: 4, border: '0.5 solid ' + C.brd }}>
                  <Text style={{ fontSize: 7, color: C.ink3, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{m.lb}</Text>
                  <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.ink }}>{m.v}</Text>
                </View>
              ))}
            </View>
            {(subByCategory || []).length > 0 && (
              <View style={s.table}>
                <View style={s.tableHead}>
                  <Text style={[s.thCell, { flex: 3 }]}>{t('apdf.category')}</Text>
                  <Text style={[s.thCell, { flex: 2, textAlign: 'right' }]}>{t('apdf.subsMonthlyCol')}</Text>
                  <Text style={[s.thCell, { flex: 1, textAlign: 'right' }]}>{t('apdf.subsServices')}</Text>
                </View>
                {(subByCategory || []).slice(0, 5).map(([cat, data], i, arr) => (
                  <View key={cat} style={i === arr.length - 1 ? s.tableRowLast : s.tableRow}>
                    <Text style={[s.tdCell, { flex: 3 }]}>{subLabel(cat, lang)}</Text>
                    <Text style={[s.tdCell, { flex: 2, textAlign: 'right' }]}>{fmtMoney(data.monthly || 0, sym)}</Text>
                    <Text style={[s.tdCell, { flex: 1, textAlign: 'right', color: C.ink3 }]}>{data.count}</Text>
                  </View>
                ))}
              </View>
            )}
            {(subAlerts || []).length > 0 && (
              <View style={{ marginTop: 8, padding: 8, backgroundColor: C.ambL, borderRadius: 4 }}>
                {(subAlerts || []).slice(0, 2).map((a, i) => (
                  <Text key={i} style={{ fontSize: 8, color: C.amb, lineHeight: 1.5 }}>· {a.msg}</Text>
                ))}
              </View>
            )}
            <Text style={{ fontSize: 7, color: C.ink3, marginTop: 6 }}>
              {t('apdf.subsNote')}
            </Text>
          </View>
        )}

        {/* Disclaimer */}
        <View style={s.disclaimer}>
          <Text style={s.disclaimerText}>
            {t('apdf.legal')} {brandName !== 'MOY IQ' ? `${t('apdf.madeWith')} ` : ''}
            {t('apdf.contact', { email: config.app.supportEmail })}
          </Text>
        </View>

        {/* Footer pág 2 */}
        <View style={s.footer} fixed>
          <Text style={s.footerLeft}>
            {t('apdf.footer', { brand: brandName, date: today() })}
          </Text>
          <Text style={s.footerRight} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}

// ── HELPERS COMPARTIDOS (descarga local + envío por correo) ──────────────────
function reportFilename({ clientName, activeMonth, lang = 'es' }) {
  const monthStr = activeMonth || ''
  const clientStr = (clientName || translate(lang, 'apdf.client')).replace(/\s+/g, '-').toLowerCase()
  return `${translate(lang, 'apdf.filename')}-${clientStr}${monthStr ? `-${monthStr}` : ''}.pdf`
}

async function buildReportePDFBlob(data) {
  return pdf(<ReporteFinancieroPDF data={data} />).toBlob()
}

// Convierte un Blob a base64 en chunks — spreadear el array completo en
// String.fromCharCode revienta el call stack en PDFs de varias páginas.
async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

// ── FUNCIÓN PARA DESCARGAR EL PDF ─────────────────────────────────────────────
export async function downloadReportePDF(data) {
  const filename = reportFilename(data)
  const blob = await buildReportePDFBlob(data)
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)

  return filename
}

// ── FUNCIÓN PARA ENVIAR EL PDF POR CORREO ─────────────────────────────────────
// Envío manual, a pedido explícito del asesor — NO es un cron automático.
// Un reporte automático "corre solo, sin abrir la app" necesitaría que el
// servidor tuviera acceso a datos financieros sin cifrar (esta app es
// local-first, ver CLAUDE.md "Nada de datos financieros al servidor sin
// cifrar") — esta acción es la excepción explícita y consentida a esa regla,
// análoga a "Exportar PDF" pero mandada por correo en vez de guardada local.
// El PDF viaja SIN cifrar por la red (Resend, bandeja del destinatario) — por
// eso requiere un clic explícito, nunca dispararla sin que el usuario la pida.
const FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '') + '/functions/v1/send-report-email'

export async function sendReportePDFByEmail(data, to) {
  const { getLicenseKey } = await import('../../utils/licenseValidator.js')
  const filename = reportFilename(data)
  const blob = await buildReportePDFBlob(data)
  const pdfBase64 = await blobToBase64(blob)

  const res = await fetch(FUNCTIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      licenseKey: getLicenseKey(),
      to,
      clientName: data.clientName,
      month: data.activeMonth,
      pdfBase64,
      filename,
      lang: data.lang || 'es', // idioma del correo (send-report-email)
    }),
  })

  let result = {}
  try { result = await res.json() } catch { /* respuesta no-JSON, cae al error genérico de abajo */ }
  if (!res.ok || !result.ok) {
    throw new Error(result.error || `http_${res.status}`)
  }
  return true
}
