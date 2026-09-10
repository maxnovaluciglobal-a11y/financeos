// src/components/Onboarding.jsx
// Onboarding inicial — FinanceOS Fase 8 (reescrito completo)
// 9 pasos (0-8): Bienvenida → Uso → Perfil → País → Config → Ingreso → Objetivo → Plantilla → Resumen

import { useState, useMemo, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/useT.js'
import TEMPLATES from '../data/templates.js'
import { SEED_INCOMES, SEED_EXPENSES, SEED_BUDGETS, SEED_DEBTS, SEED_GOALS, uid } from '../utils/index.js'
import { dbAdd } from '../core/db/index.js'

// label/desc son KEYS de traducción (ver src/i18n/translations.js), no texto directo
const CURRENCIES = [
  { code: 'CLP', label: 'Peso chileno',    flag: '🇨🇱' },
  { code: 'USD', label: 'Dólar',           flag: '🇺🇸' },
  { code: 'EUR', label: 'Euro',            flag: '🇪🇺' },
  { code: 'VES', label: 'Bolívar',         flag: '🇻🇪' },
  { code: 'MXN', label: 'Peso mexicano',   flag: '🇲🇽' },
  { code: 'ARS', label: 'Peso argentino',  flag: '🇦🇷' },
  { code: 'PEN', label: 'Sol peruano',      flag: '🇵🇪' },
  { code: 'COP', label: 'Peso colombiano', flag: '🇨🇴' },
]
const USE_TYPES = [
  { id: 'personal', icon: '◈', label: 'onboarding.useType.personal.label', desc: 'onboarding.useType.personal.desc' },
  { id: 'advisor',  icon: '◑', label: 'onboarding.useType.advisor.label',  desc: 'onboarding.useType.advisor.desc' },
  { id: 'demo',     icon: '⟶', label: 'onboarding.useType.demo.label',     desc: 'onboarding.useType.demo.desc' },
]
const MAIN_GOALS = [
  { id: 'control', icon: '◈', label: 'onboarding.goal.control.label', desc: 'onboarding.goal.control.desc' },
  { id: 'save',    icon: '◎', label: 'onboarding.goal.save.label',    desc: 'onboarding.goal.save.desc' },
  { id: 'debt',    icon: '⊖', label: 'onboarding.goal.debt.label',    desc: 'onboarding.goal.debt.desc' },
  { id: 'plan',    icon: '▤', label: 'onboarding.goal.plan.label',    desc: 'onboarding.goal.plan.desc' },
]
const EXPERIENCE_LEVELS = [
  { id: 'beginner',     label: 'onboarding.exp.beginner.label',     desc: 'onboarding.exp.beginner.desc' },
  { id: 'intermediate', label: 'onboarding.exp.intermediate.label', desc: 'onboarding.exp.intermediate.desc' },
  { id: 'advanced',     label: 'onboarding.exp.advanced.label',     desc: 'onboarding.exp.advanced.desc' },
]
const LANGUAGES = [
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'pt', flag: '🇵🇹', label: 'Português' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
]

function recommendTemplate({ profileId, useType, mainGoal, hasDebts }) {
  if (profileId) return profileId
  if (useType === 'advisor') return 'educador'
  if (mainGoal === 'debt' || hasDebts === 'yes') return 'deudas'
  if (mainGoal === 'save') return 'ahorro'
  return 'personal'
}

function ProgressBar({ step, total }) {
  // Los puntitos son puramente decorativos para un lector de pantalla sin
  // role="progressbar" — no había forma de saber cuánto faltaba del flujo.
  return (
    <div
      role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={total}
      aria-label={`Paso ${step + 1} de ${total}`}
      style={{ display: 'flex', gap: 5, marginBottom: 28, justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} aria-hidden="true" style={{
          height: 4, borderRadius: 20, transition: 'all .3s',
          width: i < step ? 28 : i === step ? 20 : 8,
          background: i <= step ? 'var(--grn)' : 'var(--brd2)',
        }} />
      ))}
    </div>
  )
}

function OptionCard({ icon, label, desc, selected, onClick, color = 'var(--grn)' }) {
  return (
    <button onClick={onClick} aria-pressed={selected} style={{
      width: '100%', textAlign: 'left', padding: '11px 13px',
      borderRadius: 10, cursor: 'pointer', transition: 'all .15s',
      border: selected ? `1.5px solid ${color}` : '0.5px solid var(--brd2)',
      background: selected ? `${color}0d` : 'var(--sur2)',
      display: 'flex', alignItems: 'center', gap: 11, marginBottom: 6,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: selected ? `${color}18` : 'var(--sur)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, color: selected ? color : 'var(--th)',
        border: `0.5px solid ${selected ? color + '30' : 'var(--brd)'}`,
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)', marginBottom: 1 }}>{label}</div>
        {desc && <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)' }}>{desc}</div>}
      </div>
      {selected && <div style={{ color, fontSize: 14, flexShrink: 0 }}>✓</div>}
    </button>
  )
}

const wrap = {
  position: 'fixed', inset: 0, background: 'var(--bg)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 999, padding: 20, overflowY: 'auto',
}
const box = {
  background: 'var(--sur)', border: '0.5px solid var(--brd)',
  borderRadius: 16, padding: '26px 22px', maxWidth: 430, width: '100%',
  boxShadow: '0 24px 60px rgba(0,0,0,.08)', margin: 'auto',
}
const h1s = { fontSize: 22, fontWeight: 700, color: 'var(--tx)', marginBottom: 5, fontFamily: 'var(--display)', letterSpacing: '-0.02em' }
// Subtítulo del onboarding: es la voz que guía al usuario, no un dato → sans
const subs = { fontSize: 12.5, color: 'var(--th)', fontFamily: 'var(--sans)', lineHeight: 1.55, marginBottom: 18 }
const btnP = (disabled = false) => ({
  width: '100%', padding: '10px', borderRadius: 8, border: 'none',
  background: disabled ? 'var(--brd2)' : 'var(--laton)', color: disabled ? 'var(--th)' : 'var(--navy)',
  fontSize: 12, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'var(--sans)', marginTop: 7, transition: 'all .15s',
})
const btnG = {
  width: '100%', padding: '8px', borderRadius: 8,
  border: '0.5px solid var(--brd2)', background: 'transparent',
  color: 'var(--th)', fontSize: 11, cursor: 'pointer',
  fontFamily: 'var(--sans)', marginTop: 5,
}

export default function Onboarding({ onComplete }) {
  const { settings, updateSettings } = useApp()
  const { t } = useT()
  const TOTAL = 8
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [deLangDismissed, setDeLangDismissed] = useState(false)
  const [answers, setAnswers] = useState({
    useType: '', profileId: '',
    country: settings.country || 'CL',
    currency: settings.currency || 'CLP',
    savingGoal: 20, hasDebts: '', mainGoal: '', experience: '',
    estimatedMonthlyIncome: '',
  })
  const set = (k, v) => setAnswers(a => ({ ...a, [k]: v }))

  const recommendedId = useMemo(() => recommendTemplate(answers), [answers])
  const activeTemplate = TEMPLATES.find(t => t.id === (answers.profileId || recommendedId)) || TEMPLATES[0]

  const next = () => setStep(s => Math.min(s + 1, TOTAL))
  const back = () => setStep(s => Math.max(s - 1, 0))

  // Mueve el foco al título del paso nuevo — sin esto un lector de pantalla
  // no se entera de que la pantalla cambió al avanzar/retroceder.
  const headingRef = useRef(null)
  useEffect(() => {
    const id = setTimeout(() => headingRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [step])

  async function loadDemoData() {
    setLoading(true)
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
      await finalize(true)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function finalize(withDemo = false, goTo = null) {
    const tpl = activeTemplate
    await updateSettings({
      ...settings,
      currency: answers.currency, savingGoalPct: answers.savingGoal,
      country: answers.country,
      onboardingDone: true, onboardingUseType: answers.useType,
      onboardingExperience: answers.experience, onboardingMainGoal: answers.mainGoal,
      estimatedMonthlyIncome: Number(answers.estimatedMonthlyIncome) || 0,
      activeMonth: new Date().toISOString().slice(0, 7),
      activeTemplateId: tpl.id, activeTemplateName: tpl.name,
      categoriesIncome: tpl.categoriesIncome, categoriesExpense: tpl.categoriesExpense,
      templateSuggestedBudgets: tpl.suggestedBudgets,
      templateAdvisorTip: tpl.advisorTip, templateAlerts: tpl.alerts,
    })
    onComplete(goTo)
  }

  // Step 0 — Bienvenida
  if (step === 0) return (
    <div style={wrap}><div style={box}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
        {LANGUAGES.map(l => (
          <button key={l.code} onClick={() => updateSettings({ ...settings, language: l.code })} style={{
            padding: '4px 9px', borderRadius: 20, fontSize: 10, cursor: 'pointer',
            border: (settings.language || 'es') === l.code ? '1.5px solid var(--grn)' : '0.5px solid var(--brd2)',
            background: (settings.language || 'es') === l.code ? 'var(--grn-bg)' : 'var(--sur2)',
            color: (settings.language || 'es') === l.code ? 'var(--grn)' : 'var(--th)',
            fontFamily: 'var(--mono)', fontWeight: (settings.language || 'es') === l.code ? 600 : 400,
          }}>{l.flag} {l.label}</button>
        ))}
      </div>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{ width: 52, height: 52, borderRadius: 13, margin: '0 auto 12px', background: 'var(--grn-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--grn)' }}>◈</div>
        <h1 ref={headingRef} tabIndex={-1} style={{ ...h1s, textAlign: 'center', outline: 'none' }}>{t('onboarding.welcome.title')}</h1>
        <p style={{ ...subs, textAlign: 'center' }}>{t('onboarding.welcome.sub')}</p>
      </div>
      <div style={{ padding: '10px 13px', background: 'var(--grn-bg)', borderRadius: 8, border: '0.5px solid rgba(26,163,104,.2)', fontSize: 11, color: 'var(--grn)', fontFamily: 'var(--mono)', lineHeight: 1.6, marginBottom: 18 }}>
        {t('onboarding.welcome.privacy')}
      </div>
      <button style={btnP()} onClick={next}>{t('onboarding.welcome.start')}</button>
      <button style={btnG} onClick={() => finalize()}>{t('onboarding.welcome.skip')}</button>
      <button style={{ ...btnG, color: 'var(--grn)' }} onClick={loadDemoData} disabled={loading}>
        {loading ? t('onboarding.loading') : t('onboarding.welcome.demo')}
      </button>
    </div></div>
  )

  // Step 1 — Tipo de uso
  if (step === 1) return (
    <div style={wrap}><div style={box}>
      <ProgressBar step={1} total={TOTAL} />
      <h2 ref={headingRef} tabIndex={-1} style={{ ...h1s, outline: 'none' }}>{t('onboarding.useType.title')}</h2>
      <p style={subs}>{t('onboarding.useType.sub')}</p>
      {USE_TYPES.map(u => <OptionCard key={u.id} icon={u.icon} label={t(u.label)} desc={t(u.desc)} selected={answers.useType === u.id} onClick={() => set('useType', u.id)} />)}
      <div style={{ display: 'flex', gap: 7, marginTop: 7 }}>
        <button style={{ ...btnG, width: 'auto', padding: '8px 14px', marginTop: 0 }} onClick={back}>{t('nav.back')}</button>
        <button style={{ ...btnP(answers.useType === ''), flex: 1, marginTop: 0 }} disabled={answers.useType === ''} onClick={next}>{t('onboarding.continue')}</button>
      </div>
    </div></div>
  )

  // Step 2 — Perfil
  // "Cliente con deuda" / "Cliente con meta de ahorro" están escritas en
  // segunda persona para un asesor eligiendo la plantilla de OTRO — confunden
  // a quien ya contestó "Uso personal" un paso atrás (¿"cliente"? soy yo).
  // Esos dos perfiles siguen disponibles para quien SÍ es asesor.
  const profileTemplates = answers.useType === 'advisor'
    ? TEMPLATES
    : TEMPLATES.filter(tpl => tpl.id !== 'deudas' && tpl.id !== 'ahorro')
  if (step === 2) return (
    <div style={wrap}><div style={{ ...box, maxWidth: 490 }}>
      <ProgressBar step={2} total={TOTAL} />
      <h2 ref={headingRef} tabIndex={-1} style={{ ...h1s, outline: 'none' }}>{t('onboarding.profile.title')}</h2>
      <p style={subs}>{answers.useType === 'advisor' ? t('onboarding.profile.sub.advisor') : t('onboarding.profile.sub.default')}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
        {profileTemplates.map(tpl => (
          <button key={tpl.id} onClick={() => set('profileId', tpl.id)} aria-pressed={answers.profileId === tpl.id} style={{
            padding: '10px 11px', borderRadius: 10, cursor: 'pointer',
            border: answers.profileId === tpl.id ? `1.5px solid ${tpl.color}` : '0.5px solid var(--brd2)',
            background: answers.profileId === tpl.id ? `${tpl.color}0d` : 'var(--sur2)',
            textAlign: 'left', transition: 'all .15s',
          }}>
            <div style={{ fontSize: 15, color: tpl.color, marginBottom: 3 }}>{tpl.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx)' }}>{t(`tpl.${tpl.id}.name`)}</div>
            <div style={{ fontSize: 9, color: 'var(--th)', fontFamily: 'var(--mono)', marginTop: 1 }}>{t('onboarding.profile.categories', { n: tpl.categoriesExpense.length })}</div>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
        <button style={{ ...btnG, width: 'auto', padding: '8px 14px', marginTop: 0 }} onClick={back}>{t('nav.back')}</button>
        <button style={{ ...btnP(false), flex: 1, marginTop: 0 }} onClick={next}>{answers.profileId ? t('onboarding.continue') : t('onboarding.skipArrow')}</button>
      </div>
    </div></div>
  )


  // Step 3 — País (NUEVO v1.3)
  const COUNTRIES = [
    { code: 'CL', flag: '🇨🇱', label: 'Chile',     currency: 'CLP' },
    { code: 'MX', flag: '🇲🇽', label: 'México',    currency: 'MXN' },
    { code: 'AR', flag: '🇦🇷', label: 'Argentina', currency: 'ARS' },
    { code: 'CO', flag: '🇨🇴', label: 'Colombia',  currency: 'COP' },
    { code: 'EC',    flag: '🇪🇨', label: 'Ecuador',        currency: 'USD' },
    { code: 'PE',    flag: '🇵🇪', label: 'Perú',           currency: 'PEN' },
    { code: 'VE',    flag: '🇻🇪', label: 'Venezuela',      currency: 'VES' },
    { code: 'US',    flag: '🇺🇸', label: 'Estados Unidos', currency: 'USD' },
    { code: 'ES',    flag: '🇪🇸', label: 'España',          currency: 'EUR' },
    { code: 'PT',    flag: '🇵🇹', label: 'Portugal',        currency: 'EUR' },
    { code: 'DE',    flag: '🇩🇪', label: 'Alemania',        currency: 'EUR' },
    { code: 'OTHER', flag: '🌎', label: 'Otro',            currency: 'USD' },
  ]
  if (step === 3) return (
    <div style={wrap}><div style={box}>
      <ProgressBar step={3} total={TOTAL} />
      <h2 ref={headingRef} tabIndex={-1} style={{ ...h1s, outline: 'none' }}>{t('onboarding.country.title')}</h2>
      <p style={subs}>{t('onboarding.country.sub')}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, marginBottom: 14 }}>
        {COUNTRIES.map(c => (
          <button key={c.code} onClick={() => {
            set('country', c.code)
            set('currency', c.currency)
          }} aria-pressed={answers.country === c.code} style={{
            padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
            border: answers.country === c.code ? '1.5px solid var(--grn)' : '0.5px solid var(--brd2)',
            background: answers.country === c.code ? 'var(--grn-bg)' : 'var(--sur2)',
            textAlign: 'center', transition: 'all .15s',
          }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{c.flag}</div>
            <div style={{ fontSize: 11, fontWeight: answers.country === c.code ? 600 : 400, color: answers.country === c.code ? 'var(--grn)' : 'var(--tx)' }}>{c.label}</div>
          </button>
        ))}
      </div>
      {answers.country === 'CL' && (
        <div style={{ padding: '8px 10px', background: 'var(--grn-bg)', borderRadius: 8, border: '0.5px solid rgba(26,163,104,.2)', fontSize: 10, color: 'var(--grn)', fontFamily: 'var(--mono)', marginBottom: 10 }}>
          {t('onboarding.country.chileHint')}
        </div>
      )}
      {answers.country === 'DE' && (
        <div style={{ padding: '8px 10px', background: 'var(--grn-bg)', borderRadius: 8, border: '0.5px solid rgba(26,163,104,.2)', fontSize: 10, color: 'var(--grn)', fontFamily: 'var(--mono)', marginBottom: 10 }}>
          {t('onboarding.country.germanyHint')}
        </div>
      )}
      {answers.country === 'DE' && (settings.language || 'es') !== 'de' && !deLangDismissed && (
        <div style={{ padding: '8px 10px', background: 'var(--sur2)', borderRadius: 8, border: '0.5px solid var(--brd2)', fontSize: 11, color: 'var(--tx)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 140 }}>{t('onboarding.country.germanyLangOffer')}</span>
          <button type="button" onClick={() => { updateSettings({ ...settings, language: 'de' }); setDeLangDismissed(true) }}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--grn)', background: 'var(--grn-bg)', color: 'var(--grn)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            {t('onboarding.country.switchToGerman')}
          </button>
          <button type="button" onClick={() => setDeLangDismissed(true)}
            style={{ padding: '5px 10px', borderRadius: 6, border: '0.5px solid var(--brd2)', background: 'transparent', color: 'var(--th)', fontSize: 11, cursor: 'pointer' }}>
            {t('onboarding.country.keepCurrentLang')}
          </button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 7, marginTop: 4 }}>
        <button style={{ ...btnG, width: 'auto', padding: '8px 14px', marginTop: 0 }} onClick={back}>{t('nav.back')}</button>
        <button style={{ ...btnP(false), flex: 1, marginTop: 0 }} onClick={next}>{t('onboarding.continue')}</button>
      </div>
    </div></div>
  )

  // Step 4 — Configuración básica
  if (step === 4) return (
    <div style={wrap}><div style={box}>
      <ProgressBar step={4} total={TOTAL} />
      <h2 ref={headingRef} tabIndex={-1} style={{ ...h1s, outline: 'none' }}>{t('onboarding.basics.title')}</h2>
      <p style={subs}>{t('onboarding.basics.sub')}</p>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx)', marginBottom: 7 }}>{t('settings.currency.label')}</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {CURRENCIES.map(c => (
            <button key={c.code} onClick={() => set('currency', c.code)} aria-pressed={answers.currency === c.code} style={{
              padding: '5px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
              border: answers.currency === c.code ? '1.5px solid var(--grn)' : '0.5px solid var(--brd2)',
              background: answers.currency === c.code ? 'var(--grn-bg)' : 'var(--sur2)',
              color: answers.currency === c.code ? 'var(--grn)' : 'var(--tm)',
              fontFamily: 'var(--mono)', fontWeight: answers.currency === c.code ? 600 : 400,
            }}>{c.flag} {c.code}</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>
          {t('onboarding.basics.savingGoalLabel')} <span style={{ color: 'var(--grn)' }}>{answers.savingGoal}%</span>
        </div>
        <input type="range" min={5} max={50} step={5} value={answers.savingGoal}
          aria-label={t('onboarding.basics.savingGoalLabel')}
          onChange={e => set('savingGoal', Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--grn)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--th)', fontFamily: 'var(--mono)' }}>
          <span>{t('onboarding.basics.min')}</span><span>{t('onboarding.basics.mid')}</span><span>{t('onboarding.basics.max')}</span>
        </div>
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>{t('onboarding.basics.hasDebts')}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ id: 'yes', label: t('onboarding.yes') }, { id: 'no', label: t('onboarding.no') }].map(o => (
            <button key={o.id} onClick={() => set('hasDebts', o.id)} aria-pressed={answers.hasDebts === o.id} style={{
              flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
              border: answers.hasDebts === o.id ? '1.5px solid var(--grn)' : '0.5px solid var(--brd2)',
              background: answers.hasDebts === o.id ? 'var(--grn-bg)' : 'var(--sur2)',
              color: answers.hasDebts === o.id ? 'var(--grn)' : 'var(--tm)',
              fontFamily: 'var(--sans)', fontWeight: answers.hasDebts === o.id ? 600 : 400,
            }}>{o.label}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
        <button style={{ ...btnG, width: 'auto', padding: '8px 14px', marginTop: 0 }} onClick={back}>{t('nav.back')}</button>
        <button style={{ ...btnP(false), flex: 1, marginTop: 0 }} onClick={next}>{t('onboarding.continue')}</button>
      </div>
    </div></div>
  )

  // Step 5 — Ingreso mensual estimado (nuevo)
  if (step === 5) return (
    <div style={wrap}><div style={box}>
      <ProgressBar step={5} total={TOTAL} />
      <h2 ref={headingRef} tabIndex={-1} style={{ ...h1s, outline: 'none' }}>{t('onboarding.income.title')}</h2>
      <p style={subs}>{t('onboarding.income.sub')}</p>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', marginBottom: 6 }}>
          {t('onboarding.income.label', { currency: answers.currency || 'tu moneda' })}
        </div>
        <input
          type="number" inputMode="decimal"
          min="0"
          value={answers.estimatedMonthlyIncome}
          placeholder={t('onboarding.income.placeholder')}
          aria-label={t('onboarding.income.label', { currency: answers.currency || 'tu moneda' })}
          onChange={e => set('estimatedMonthlyIncome', e.target.value)}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
            border: '0.5px solid var(--brd2)', background: 'var(--sur2)', color: 'var(--tx)',
            fontFamily: 'var(--mono)', boxSizing: 'border-box',
          }}
          autoFocus
        />
        <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', marginTop: 5, lineHeight: 1.5 }}>
          {t('onboarding.income.hint')}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 7 }}>
        <button style={{ ...btnG, width: 'auto', padding: '8px 14px', marginTop: 0 }} onClick={back}>{t('nav.back')}</button>
        <button style={{ ...btnP(false), flex: 1, marginTop: 0 }} onClick={next}>{t('onboarding.continue')}</button>
      </div>
      <button style={{ ...btnG, fontSize: 10, marginTop: 2 }} onClick={next}>{t('onboarding.income.skip')}</button>
    </div></div>
  )

  // Step 6 — Objetivo y experiencia
  if (step === 6) return (
    <div style={wrap}><div style={box}>
      <ProgressBar step={6} total={TOTAL} />
      <h2 ref={headingRef} tabIndex={-1} style={{ ...h1s, outline: 'none' }}>{t('onboarding.goalExp.title')}</h2>
      <p style={subs}>{t('onboarding.goalExp.sub')}</p>
      {MAIN_GOALS.map(g => <OptionCard key={g.id} icon={g.icon} label={t(g.label)} desc={t(g.desc)} selected={answers.mainGoal === g.id} onClick={() => set('mainGoal', g.id)} />)}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx)', marginTop: 12, marginBottom: 6 }}>{t('onboarding.goalExp.experienceLabel')}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {EXPERIENCE_LEVELS.map(e => (
          <button key={e.id} onClick={() => set('experience', e.id)} aria-pressed={answers.experience === e.id} style={{
            flex: 1, padding: '8px 5px', borderRadius: 8, fontSize: 10, cursor: 'pointer',
            border: answers.experience === e.id ? '1.5px solid var(--grn)' : '0.5px solid var(--brd2)',
            background: answers.experience === e.id ? 'var(--grn-bg)' : 'var(--sur2)',
            color: answers.experience === e.id ? 'var(--grn)' : 'var(--tm)',
            fontFamily: 'var(--sans)', fontWeight: answers.experience === e.id ? 600 : 400,
            textAlign: 'center',
          }}>{t(e.label)}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
        <button style={{ ...btnG, width: 'auto', padding: '8px 14px', marginTop: 0 }} onClick={back}>{t('nav.back')}</button>
        <button style={{ ...btnP(false), flex: 1, marginTop: 0 }} onClick={next}>{t('onboarding.goalExp.next')}</button>
      </div>
    </div></div>
  )

  // Step 7 — Plantilla recomendada
  if (step === 7) return (
    <div style={wrap}><div style={box}>
      <ProgressBar step={7} total={TOTAL} />
      <h2 ref={headingRef} tabIndex={-1} style={{ ...h1s, outline: 'none' }}>{t('onboarding.template.title')}</h2>
      <p style={subs}>{t('onboarding.template.sub')}</p>
      <div style={{ padding: '13px', borderRadius: 10, border: `1.5px solid ${activeTemplate.color}`, background: `${activeTemplate.color}08`, marginBottom: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: `${activeTemplate.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: activeTemplate.color, flexShrink: 0 }}>{activeTemplate.icon}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>{t(`tpl.${activeTemplate.id}.name`)}</div>
            <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)' }}>{t(`tpl.${activeTemplate.id}.tagline`)}</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 9, padding: '2px 7px', borderRadius: 20, background: `${activeTemplate.color}18`, color: activeTemplate.color, fontFamily: 'var(--mono)', fontWeight: 600 }}>{t('onboarding.template.badge')}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            t('onboarding.template.incomeCount', { n: activeTemplate.categoriesIncome.length }),
            t('onboarding.template.expenseCount', { n: activeTemplate.categoriesExpense.length }),
            t('onboarding.template.budgetCount', { n: activeTemplate.suggestedBudgets.length }),
          ].map(s => (
            <span key={s} style={{ fontSize: 9, fontFamily: 'var(--mono)', padding: '2px 7px', borderRadius: 20, background: 'var(--sur)', color: 'var(--th)', border: '0.5px solid var(--brd)' }}>{s}</span>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx)', marginBottom: 7 }}>{t('onboarding.template.other')}</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
        {TEMPLATES.map(tpl => (
          <button key={tpl.id} onClick={() => set('profileId', tpl.id === answers.profileId ? '' : tpl.id)} style={{
            padding: '4px 9px', borderRadius: 20, fontSize: 10, cursor: 'pointer',
            border: `0.5px solid ${activeTemplate.id === tpl.id ? tpl.color + '60' : 'var(--brd)'}`,
            background: activeTemplate.id === tpl.id ? `${tpl.color}14` : 'var(--sur2)',
            color: activeTemplate.id === tpl.id ? tpl.color : 'var(--th)',
            fontFamily: 'var(--mono)', fontWeight: activeTemplate.id === tpl.id ? 600 : 400,
          }}>{tpl.icon} {t(`tpl.${tpl.id}.name`)}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 7 }}>
        <button style={{ ...btnG, width: 'auto', padding: '8px 14px', marginTop: 0 }} onClick={back}>{t('nav.back')}</button>
        <button style={{ ...btnP(false), flex: 1, marginTop: 0 }} onClick={next}>{t('onboarding.template.next')}</button>
      </div>
    </div></div>
  )

  // Step 8 — Resumen y finalizar
  return (
    <div style={wrap}><div style={box}>
      <ProgressBar step={TOTAL} total={TOTAL} />
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, margin: '0 auto 10px', background: 'var(--grn-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--grn)' }}>✓</div>
        <h2 ref={headingRef} tabIndex={-1} style={{ ...h1s, textAlign: 'center', outline: 'none' }}>{t('onboarding.summary.title')}</h2>
        <p style={{ ...subs, textAlign: 'center' }}>{t('onboarding.summary.sub')}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 14 }}>
        {[
          { label: t('settings.country.label'), value: COUNTRIES.find(c => c.code === answers.country)?.label || answers.country },
          { label: t('settings.currency.label'), value: CURRENCIES.find(c => c.code === answers.currency)?.label || answers.currency },
          { label: t('onboarding.summary.savingGoal'), value: t('onboarding.summary.savingGoalValue', { pct: answers.savingGoal }) },
          { label: t('onboarding.summary.template'), value: t(`tpl.${activeTemplate.id}.name`) },
          { label: t('onboarding.summary.useType'), value: (() => { const u = USE_TYPES.find(u => u.id === answers.useType); return u ? t(u.label) : '—' })() },
        ].map(row => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid var(--brd)' }}>
            <span style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)' }}>{row.label}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--tx)' }}>{row.value}</span>
          </div>
        ))}
      </div>
      {/* #02 — Punto de partida: diagnóstico HONESTO derivado de lo declarado
          (ingreso × meta%). Es un objetivo real, no un score inventado con datos
          que aún no existen. Cierra el "primer minuto" con una cifra motivadora. */}
      {(() => {
        const income = Number(answers.estimatedMonthlyIncome) || 0
        const pct = Number(answers.savingGoal) || 0
        const sym = { CLP:'$', USD:'US$', EUR:'€', VES:'Bs.', MXN:'$', ARS:'$', COP:'$', PEN:'S/', BRL:'R$', UYU:'$U' }[answers.currency] || '$'
        const fmt = (n) => sym + Math.round(n).toLocaleString()
        const perMonth = income * pct / 100
        const toolKey = { CL:'nav.apvChile', PT:'nav.pprPortugal', EC:'nav.deductions', PE:'nav.deductions', MX:'nav.taxSavings', CO:'nav.taxSavings', US:'nav.taxSavings', ES:'nav.taxSavings', AR:'nav.inflation', VE:'nav.multicurrency' }[(answers.country || 'CL').toUpperCase()]
        return (
          <div style={{ padding: '13px 15px', background: 'var(--grn-bg)', border: '0.5px solid rgba(26,163,104,.25)', borderRadius: 10, marginBottom: 12 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--grn)', marginBottom: 8 }}>
              {t('onboarding.summary.startTitle')}
            </div>
            {income > 0 ? (
              <>
                <div className="num" style={{ fontSize: 'var(--fs-hero)', fontWeight: 700, color: 'var(--grn)', lineHeight: 1.02, letterSpacing: '-0.03em' }}>
                  {fmt(perMonth)}<span style={{ fontSize: 15, fontWeight: 500, color: 'var(--tm)' }}>/{t('onboarding.summary.startPerMonth')}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--tm)', marginTop: 4 }}>
                  {t('onboarding.summary.startPlan', { pct })} · {t('onboarding.summary.startYear', { amount: fmt(perMonth * 12) })}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--tm)', lineHeight: 1.5 }}>{t('onboarding.summary.startNoIncome')}</div>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {toolKey && (
                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', padding: '3px 8px', borderRadius: 20, background: 'var(--sur)', color: 'var(--grn)', border: '0.5px solid rgba(26,163,104,.25)' }}>{t(toolKey)}</span>
              )}
              {answers.hasDebts === 'yes' && (
                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', padding: '3px 8px', borderRadius: 20, background: 'var(--sur)', color: 'var(--tm)', border: '0.5px solid var(--brd)' }}>{t('onboarding.summary.startDebts')}</span>
              )}
            </div>
          </div>
        )
      })()}
      <div style={{ padding: '9px 11px', background: '#faeeda', border: '0.5px solid rgba(133,79,11,.2)', borderRadius: 8, fontSize: 10, color: '#854f0b', fontFamily: 'var(--mono)', lineHeight: 1.5, marginBottom: 10 }}>
        {t('onboarding.summary.backupWarning')}
      </div>
      {answers.useType === 'advisor' && (
        <div style={{ padding: '9px 11px', background: 'var(--grn-bg)', border: '0.5px solid rgba(26,163,104,.2)', borderRadius: 8, fontSize: 10, color: 'var(--grn)', fontFamily: 'var(--mono)', lineHeight: 1.5, marginBottom: 10 }}>
          {t('onboarding.summary.advisorTip')}
        </div>
      )}
      {/* Bifurcación final: importar la cartola es el puente al primer dato REAL
          (autodetección de banco). Va como acción primaria; el arranque a mano
          queda como alternativa, sin bloquearlo. Al elegir importar, finalize
          termina el onboarding y App abre la página de import. */}
      <div style={{ padding: '10px 12px', background: 'var(--grn-bg)', border: '0.5px solid rgba(26,163,104,.25)', borderRadius: 8, fontSize: 11, color: 'var(--grn)', fontFamily: 'var(--mono)', lineHeight: 1.5, marginBottom: 10 }}>
        {t('onboarding.summary.importHint')}
      </div>
      <button style={btnP(loading)} onClick={() => finalize(false, 'import')} disabled={loading}>
        {loading ? t('onboarding.summary.loading') : t('onboarding.summary.import')}
      </button>
      <button style={{ ...btnG, marginTop: 8 }} onClick={() => finalize()} disabled={loading}>
        {t('onboarding.summary.enterPlain')}
      </button>
      <button style={btnG} onClick={back}>{t('nav.back')}</button>
    </div></div>
  )
}
