// src/components/Onboarding.jsx
// Onboarding de 3 pasos (T07, oct-2026; antes eran 9):
//   0 · ¿Dónde llevas tus finanzas?  idioma, país, moneda sugerida + vista previa
//   1 · Registra tu primer movimiento (QuickAddForm embebido, o importar / saltar)
//   2 · Tu IQ Score con lo que haya, y el factor más bajo como siguiente paso
// Lo que se dejó de preguntar usa defaults: uso 'personal', meta de ahorro de
// config/DB (25 %), plantilla según el país (data/countries.js). Goals y Budgets
// deberían pedir lo suyo la primera vez que se entra (pendiente aparte).
// Las claves i18n del flujo viejo (onboarding.useType.*, .profile.*, .basics.*,
// .income.*, .goalExp.*, .template.*, .summary.*) quedan sin uso: se borran en
// un commit aparte, después de confirmar que nada más las lee.

import { useState, useMemo, useRef, useEffect } from 'react'
import { Smartphone, FileUp } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/useT.js'
import TEMPLATES from '../data/templates.js'
import { COUNTRIES, PRIMARY_COUNTRIES, countryKey, suggestedCurrency, templateForCountry } from '../data/countries.js'
import config from '../config.js'
import { SEED_INCOMES, SEED_EXPENSES, SEED_BUDGETS, SEED_DEBTS, SEED_GOALS, uid, currentMonth, localeForCurrency } from '../utils/index.js'
import { calcFinancialScore, weakestFactor } from '../utils/financialScore.js'
import { ScoreState } from './ScoreState.jsx'
import { isSyncEnabled, syncAvailable, syncMeta } from '../core/sync.js'
import { dbAdd } from '../core/db/index.js'
import { Wordmark } from './Logo.jsx'
import CountUp from './CountUp.jsx'
import QuickAddForm from './QuickAddForm.jsx'

const TOTAL = 3
// Autónimos: el nombre de cada idioma en su propio idioma, igual en las 4 interfaces.
const LANGUAGES = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  { code: 'pt', name: 'Português' },
  { code: 'de', name: 'Deutsch' },
]
const SYM = { CLP:'$', USD:'US$', EUR:'€', VES:'Bs.', MXN:'$', ARS:'$', COP:'$', PEN:'S/', BRL:'R$', UYU:'$U' }
// Página a la que lleva cada factor del IQ Score en "siguiente paso sugerido"
const NEXT_PAGE = { cashFlow: 'income', emergencyCushion: 'goals', debtLoad: 'debts', goalsProgress: 'goals', dataConsistency: 'movements' }
const PAGE_LABEL = { income: 'nav.income', goals: 'nav.goals', debts: 'nav.debts', movements: 'nav.expenses' }

// ── Progreso en localStorage ────────────────────────────────────────────────
// Mismo prefijo `fos_` y misma clave que antes. La app es single-user por
// dispositivo (una licencia, una IndexedDB): si algún día hay multi-perfil,
// esta clave tiene que incluir ese id. `v: 2` marca el flujo de 3 pasos: un
// progreso del flujo viejo (sin v) o con un paso > 2 vuelve al paso 0,
// conservando país y moneda. `firstTxSaved` evita que al retomar en el paso
// del primer movimiento se pueda guardar uno duplicado.
const ONBOARDING_LS_KEY = 'fos_onboarding_progress'
const PROGRESS_VERSION = 2

function loadOnboardingProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(ONBOARDING_LS_KEY) || 'null')
    if (!raw || typeof raw !== 'object' || typeof raw.step !== 'number') return null
    const answers = {}
    if (raw.answers?.country) answers.country = raw.answers.country
    if (raw.answers?.currency) answers.currency = raw.answers.currency
    if (raw.v !== PROGRESS_VERSION || raw.step > TOTAL - 1 || raw.step < 0) return { step: 0, answers, firstTxSaved: false }
    return { step: raw.step, answers, firstTxSaved: !!raw.firstTxSaved }
  } catch {}
  return null
}
function saveOnboardingProgress(step, answers, firstTxSaved) {
  try { localStorage.setItem(ONBOARDING_LS_KEY, JSON.stringify({ v: PROGRESS_VERSION, step, answers, firstTxSaved })) } catch {}
}
function clearOnboardingProgress() {
  try { localStorage.removeItem(ONBOARDING_LS_KEY) } catch {}
}

// Cómo se verá un monto con esa moneda: mismo formato que fmtMoney (símbolo +
// entero con los separadores del locale de la moneda).
function previewAmount(currency) {
  const sample = currency === 'USD' || currency === 'EUR' ? 2450 : 1686200
  return `${SYM[currency] || '$'} ${sample.toLocaleString(localeForCurrency(currency), { maximumFractionDigits: 0 })}`
}
function currencyName(code, lang) {
  try { return new Intl.DisplayNames([lang], { type: 'currency' }).of(code) } catch { return '' }
}

function ProgressBar({ step, t }) {
  return (
    <div
      role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={TOTAL}
      aria-label={t('onboarding.v2.progress', { n: step + 1, total: TOTAL })}
      style={{ display: 'flex', gap: 4, flex: 1, maxWidth: 120 }}>
      {Array.from({ length: TOTAL }).map((_, i) => (
        <div key={i} aria-hidden="true" style={{
          height: 4, flex: 1, borderRadius: 2,
          background: i <= step ? 'var(--laton)' : 'var(--brd2)',
          transition: 'background var(--dur) var(--ease)',
        }} />
      ))}
    </div>
  )
}

// Opción grande con ícono, etiqueta y descripción (usada para "importar un archivo")
function OptionCard({ icon, label, desc, onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      width: '100%', textAlign: 'left', minHeight: 56, padding: '10px 12px',
      borderRadius: 'var(--rl)', cursor: 'pointer',
      border: '1px solid var(--brd2)', background: 'var(--sur2)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span aria-hidden="true" style={{
        width: 36, height: 36, borderRadius: 'var(--r)', flexShrink: 0,
        background: 'var(--sur)', border: '1px solid var(--brd)', color: 'var(--tm)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--tx)', fontFamily: 'var(--sans)' }}>{label}</span>
        {desc && <span style={{ display: 'block', fontSize: 13, color: 'var(--th)', fontFamily: 'var(--sans)', marginTop: 1 }}>{desc}</span>}
      </span>
    </button>
  )
}

const wrap = {
  position: 'fixed', inset: 0, background: 'var(--bg)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  zIndex: 999, padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
  overflowY: 'auto',
}
const box = {
  background: 'var(--sur)', border: '1px solid var(--brd)',
  borderRadius: 'var(--rxl)', padding: '20px 20px 22px', maxWidth: 460, width: '100%',
  boxShadow: 'var(--sh-3)', margin: 'auto',
}
const h1s = { fontSize: 24, fontWeight: 700, color: 'var(--tx)', margin: '0 0 6px', fontFamily: 'var(--display)', letterSpacing: '-0.02em', lineHeight: 1.15, outline: 'none' }
const subs = { fontSize: 14, color: 'var(--tm)', fontFamily: 'var(--sans)', lineHeight: 1.5, margin: '0 0 20px' }
const fieldLabel = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--th)', fontFamily: 'var(--sans)', marginBottom: 8, letterSpacing: '.02em' }

export default function Onboarding({ onComplete }) {
  const { settings, updateSettings, incomes, expenses, debts, goals, rehydrate } = useApp()
  const { t, lang } = useT()
  const saved = useMemo(() => loadOnboardingProgress(), [])
  const [step, setStep] = useState(() => saved?.step ?? 0)
  const [firstTxSaved, setFirstTxSaved] = useState(() => !!saved?.firstTxSaved)
  const [busy, setBusy] = useState(false)
  const [answers, setAnswers] = useState(() => {
    const country = saved?.answers?.country || settings.country || 'CL'
    return { country, currency: saved?.answers?.currency || settings.currency || suggestedCurrency(country) }
  })
  const [allCountries, setAllCountries] = useState(() => !PRIMARY_COUNTRIES.includes(answers.country))

  // Persiste paso + respuestas para retomar si se cierra la app a mitad del flujo
  useEffect(() => { saveOnboardingProgress(step, answers, firstTxSaved) }, [step, answers, firstTxSaved])

  // Mueve el foco al título del paso nuevo — sin esto un lector de pantalla
  // no se entera de que la pantalla cambió.
  const headingRef = useRef(null)
  const wrapRef = useRef(null)
  useEffect(() => {
    if (wrapRef.current) wrapRef.current.scrollTop = 0
    const id = setTimeout(() => headingRef.current?.focus({ preventScroll: true }), 50)
    return () => clearTimeout(id)
  }, [step])

  function chooseCountry(code) {
    setAnswers({ country: code, currency: suggestedCurrency(code) })
  }

  // Escribe la configuración que antes salía de los 9 pasos. Va ANTES del paso
  // del primer movimiento: QuickAddForm necesita la moneda (decimales, formato)
  // y las categorías de la plantilla, y el IQ Score el activeMonth.
  async function applySetup(extra = {}) {
    const tpl = TEMPLATES.find(x => x.id === templateForCountry(answers.country)) || TEMPLATES[0]
    await updateSettings({
      ...settings,
      currency: answers.currency, country: answers.country,
      savingGoalPct: Number(settings.savingGoalPct) || config.defaults.savingGoalPct,
      onboardingUseType: 'personal',
      onboardingExperience: settings.onboardingExperience || '',
      onboardingMainGoal: settings.onboardingMainGoal || '',
      estimatedMonthlyIncome: Number(settings.estimatedMonthlyIncome) || 0,
      activeMonth: currentMonth(),
      activeTemplateId: tpl.id, activeTemplateName: tpl.name,
      categoriesIncome: tpl.categoriesIncome, categoriesExpense: tpl.categoriesExpense,
      templateSuggestedBudgets: tpl.suggestedBudgets,
      templateAdvisorTip: tpl.advisorTip, templateAlerts: tpl.alerts,
      ...extra,
    })
  }

  async function continueFromSetup() {
    setBusy(true)
    try { await applySetup(); setStep(1) } finally { setBusy(false) }
  }

  // Termina el onboarding. goTo: página a abrir al entrar (ej. 'import').
  async function finish(goTo = null, { setup = false } = {}) {
    setBusy(true)
    try {
      if (setup) await applySetup({ onboardingDone: true })
      else await updateSettings({ ...settings, onboardingDone: true })
      clearOnboardingProgress()
      onComplete(goTo)
    } finally { setBusy(false) }
  }

  async function loadDemoData() {
    setBusy(true)
    try {
      const s = {
        incomes:  SEED_INCOMES.map(r  => ({ ...r, id: uid() })),
        expenses: SEED_EXPENSES.map(r => ({ ...r, id: uid() })),
        budgets:  SEED_BUDGETS.map(r  => ({ ...r, id: uid() })),
        debts:    SEED_DEBTS.map(r    => ({ ...r, id: uid() })),
        goals:    SEED_GOALS.map(r    => ({ ...r, id: uid() })),
      }
      await Promise.all([
        ...s.incomes.map(r  => dbAdd('incomes',  r)),
        ...s.expenses.map(r => dbAdd('expenses', r)),
        ...s.budgets.map(r  => dbAdd('budgets',  r)),
        ...s.debts.map(r    => dbAdd('debts',    r)),
        ...s.goals.map(r    => dbAdd('goals',    r)),
      ])
      await applySetup({ onboardingDone: true })
      clearOnboardingProgress()
      // dbAdd solo escribe en IndexedDB: sin rehydrate los datos no aparecen hasta recargar
      await rehydrate?.()
      onComplete('dashboard')
    } catch (e) { console.error(e) }
    finally { setBusy(false) }
  }

  // ── IQ Score del paso 3 (mismo cálculo que el Dashboard) ──────────────────
  const activeMonth = settings.activeMonth || currentMonth()
  const score = useMemo(() => {
    if (step !== 2) return null
    const inc = (incomes || []).filter(r => !r?.inv)
    const exp = (expenses || []).filter(r => !r?.inv)
    const monthInc = inc.filter(r => r?.date?.startsWith(activeMonth))
    const monthExp = exp.filter(r => r?.date?.startsWith(activeMonth))
    if (monthInc.length === 0 && monthExp.length === 0) return null
    const totalInc = monthInc.reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const totalExp = monthExp.reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const meta = syncMeta()
    return calcFinancialScore({
      savingRate: totalInc > 0 ? (totalInc - totalExp) / totalInc : 0,
      expenses: exp, incomes: inc, debts: debts || [], goals: goals || [], activeMonth,
      syncEnabled: isSyncEnabled() && syncAvailable(),
      lastSyncAt: meta.lastPushedAt || meta.lastPulledAt || null,
    }, t)
    // t cambia en cada render; el idioma es lo que importa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, incomes, expenses, debts, goals, activeMonth, lang])
  const weakest = score ? weakestFactor(score.breakdown) : null

  const currentLang = settings.language || 'es'
  const visibleCountries = allCountries
    ? COUNTRIES
    : COUNTRIES.filter(c => PRIMARY_COUNTRIES.includes(c.code))

  // ── Encabezado común: marca + progreso + (en el paso 1) saltar ─────────────
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, minHeight: 44 }}>
      <Wordmark size={14} />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}><ProgressBar step={step} t={t} /></div>
      {step === 0
        ? <button type="button" className="fos-link" style={{ fontSize: 13 }} onClick={() => finish('dashboard', { setup: true })} disabled={busy}>{t('onboarding.v2.skip')}</button>
        : <span style={{ width: 44 }} aria-hidden="true" />}
    </div>
  )

  // ── Paso 1 · ¿Dónde llevas tus finanzas? ───────────────────────────────────
  if (step === 0) return (
    <div style={wrap} ref={wrapRef}><div style={box}>
      {header}
      <h1 ref={headingRef} tabIndex={-1} style={h1s}>{t('onboarding.v2.step1.title')}</h1>
      <p style={subs}>{t('onboarding.v2.step1.sub')}</p>

      <span style={fieldLabel} id="onb-lang">{t('onboarding.v2.language')}</span>
      <div role="group" aria-labelledby="onb-lang" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 20 }}>
        {LANGUAGES.map(l => (
          <button key={l.code} type="button" className="fos-chip fos-chip--tall"
            aria-pressed={currentLang === l.code} aria-label={l.name} lang={l.code}
            onClick={() => updateSettings({ ...settings, language: l.code })}
            style={{ fontFamily: 'var(--mono)', letterSpacing: '.06em' }}>
            {l.code.toUpperCase()}
          </button>
        ))}
      </div>

      <span style={fieldLabel} id="onb-country">{t('onboarding.v2.country')}</span>
      <div role="group" aria-labelledby="onb-country" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginBottom: allCountries ? 20 : 2 }}>
        {visibleCountries.map(c => (
          <button key={c.code} type="button" className="fos-chip fos-chip--tall"
            aria-pressed={answers.country === c.code} onClick={() => chooseCountry(c.code)}
            style={{ justifyContent: 'flex-start', textAlign: 'left', gap: 10 }}>
            <span aria-hidden="true" style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--th)', minWidth: 22, letterSpacing: '.04em' }}>
              {c.code === 'OTHER' ? '··' : c.code}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(countryKey(c.code))}</span>
          </button>
        ))}
      </div>
      {!allCountries && (
        <button type="button" className="fos-link" style={{ fontSize: 13, marginBottom: 12 }} onClick={() => setAllCountries(true)}>
          {t('onboarding.v2.moreCountries', { n: COUNTRIES.length })}
        </button>
      )}

      <label style={fieldLabel} htmlFor="onb-currency">{t('onboarding.v2.currency')}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <select id="onb-currency" value={answers.currency}
          onChange={e => setAnswers(a => ({ ...a, currency: e.target.value }))}
          style={{ width: 'auto', minWidth: 0, flex: '1 1 200px', minHeight: 44, fontFamily: 'var(--sans)' }}>
          {config.currencies.map(c => {
            const name = currencyName(c.code, currentLang)
            return <option key={c.code} value={c.code}>{name ? `${c.code} · ${name}` : c.code}</option>
          })}
        </select>
        {answers.currency === suggestedCurrency(answers.country) && answers.country !== 'OTHER' && (
          <span style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--sans)' }}>
            {t('onboarding.v2.currencySuggested', { country: t(countryKey(answers.country)) })}
          </span>
        )}
      </div>

      {/* Vista previa del formato — mono porque es un dato */}
      <div aria-live="polite" style={{ padding: '12px 14px', borderRadius: 'var(--rl)', background: 'var(--sur2)', border: '1px solid var(--brd)', marginBottom: 14 }}>
        <div className="num" style={{ fontSize: 24, color: 'var(--tx)', lineHeight: 1.2 }}>
          {previewAmount(answers.currency)} <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500, color: 'var(--th)', letterSpacing: '.04em' }}>{answers.currency}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--th)', fontFamily: 'var(--sans)', marginTop: 2 }}>{t('onboarding.v2.step1.preview')}</div>
      </div>

      <p style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--tm)', fontFamily: 'var(--sans)', lineHeight: 1.5, margin: '0 0 18px' }}>
        <Smartphone size={16} strokeWidth={1.7} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, color: 'var(--th)' }} />
        {t('onboarding.v2.step1.privacy')}
      </p>

      <button type="button" className="fos-btn-primary" onClick={continueFromSetup} disabled={busy}>
        {t('onboarding.v2.step1.cta')}
      </button>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
        <button type="button" className="fos-link" onClick={loadDemoData} disabled={busy}>
          {busy ? t('onboarding.loading') : t('onboarding.v2.step1.demo')}
        </button>
      </div>
    </div></div>
  )

  // ── Paso 2 · Registra tu primer movimiento ─────────────────────────────────
  if (step === 1) return (
    <div style={wrap} ref={wrapRef}><div style={box}>
      {header}
      <h1 ref={headingRef} tabIndex={-1} style={h1s}>{t('onboarding.v2.step2.title')}</h1>
      <p style={subs}>{t('onboarding.v2.step2.sub')}</p>

      {firstTxSaved ? (
        <div role="status" style={{ padding: '14px', borderRadius: 'var(--rl)', background: 'var(--pos-bg)', color: 'var(--pos)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--sans)', marginBottom: 16 }}>
          ✓ {t('onboarding.v2.step2.done')}
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <QuickAddForm onSaved={() => { setFirstTxSaved(true); setStep(2) }} />
        </div>
      )}

      {firstTxSaved ? (
        <button type="button" className="fos-btn-primary" onClick={() => setStep(2)}>{t('onboarding.v2.step2.continue')}</button>
      ) : (
        <OptionCard
          icon={<FileUp size={18} strokeWidth={1.7} />}
          label={t('onboarding.v2.step2.import')}
          desc={t('onboarding.v2.step2.importDesc')}
          onClick={() => finish('import')}
          disabled={busy}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <button type="button" className="fos-link" onClick={() => setStep(0)}>{t('nav.back')}</button>
        {!firstTxSaved && (
          <button type="button" className="fos-link" onClick={() => setStep(2)}>{t('onboarding.v2.step2.skip')}</button>
        )}
      </div>
    </div></div>
  )

  // ── Paso 3 · Tu IQ Score ───────────────────────────────────────────────────
  const nextPage = weakest ? NEXT_PAGE[weakest.key] : null
  return (
    <div style={wrap} ref={wrapRef}><div style={box}>
      {header}
      <h1 ref={headingRef} tabIndex={-1} style={h1s}>{t('onboarding.v2.step3.title')}</h1>
      {score ? (
        <>
          <p style={subs}>{t('onboarding.v2.step3.sub')}</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
            <span className="num-hero" style={{ fontSize: 'var(--fs-hero)', color: score.color, lineHeight: 1 }}>
              <CountUp value={score.score} format={(v) => Math.round(v)} duration={900} overshoot />
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--th)' }}>/ 100</span>
            <ScoreState level={score.level} label={score.label} size={16} style={{ fontSize: 15, fontFamily: 'var(--sans)', marginLeft: 'auto', alignSelf: 'center' }} />
          </div>

          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px', display: 'grid', gap: 10 }}>
            {score.breakdown.map(b => {
              const isWeak = weakest && b.key === weakest.key
              return (
                <li key={b.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontFamily: 'var(--sans)', color: isWeak ? 'var(--tx)' : 'var(--tm)', fontWeight: isWeak ? 600 : 400 }}>{b.label}</span>
                    <span className="num" style={{ fontSize: 13, color: 'var(--th)' }}>{b.pts}/{b.max}</span>
                  </div>
                  <div aria-hidden="true" style={{ height: 4, borderRadius: 2, background: 'var(--sur3)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(b.pts / b.max) * 100}%`, background: isWeak ? 'var(--laton)' : 'var(--tm)', borderRadius: 2 }} />
                  </div>
                </li>
              )
            })}
          </ul>

          {weakest && (
            <div style={{ padding: '12px 14px', borderRadius: 'var(--rl)', border: '1px solid var(--brd2)', background: 'var(--sur2)', marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--th)', fontFamily: 'var(--sans)', marginBottom: 4 }}>{t('onboarding.v2.step3.next')}</div>
              <p style={{ fontSize: 14, color: 'var(--tx)', fontFamily: 'var(--sans)', lineHeight: 1.5, margin: 0 }}>{t(`onboarding.v2.next.${weakest.key}`)}</p>
              {nextPage && (
                <button type="button" className="fos-link" style={{ marginLeft: -4 }} onClick={() => finish(nextPage)} disabled={busy}>
                  {t('onboarding.v2.step3.goTo', { page: t(PAGE_LABEL[nextPage]) })} <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <p style={{ ...subs, marginBottom: 22 }}>{t('onboarding.v2.step3.empty')}</p>
      )}

      <button type="button" className="fos-btn-primary" onClick={() => finish('dashboard')} disabled={busy}>
        {t('onboarding.v2.step3.cta')}
      </button>
    </div></div>
  )
}
