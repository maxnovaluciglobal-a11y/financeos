// src/pages/Investments/ProfileSheet.jsx — cuestionario de 3 preguntas + aviso
// legal que habilita Inversiones (utils/investProfile.js). Guarda en la cuenta.
import { useRef, useState } from 'react'
import Sheet from '../../components/ui/Sheet.jsx'
import { ChoiceGroup } from '../../components/ui/index.jsx'
import { useT } from '../../i18n/useT.js'
import { answersComplete, PROFILE_QUESTIONS } from '../../utils/investProfile.js'
import s from './investments.module.css'

export default function ProfileSheet({ open, onClose, onSave }) {
  const { t } = useT()
  const [answers, setAnswers] = useState({})
  const [ack, setAck] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const titleRef = useRef(null)
  const ready = answersComplete(answers) && ack

  async function submit(e) {
    e.preventDefault()
    if (!ready) { setError(t('invest.profile.missing')); return }
    setSaving(true); setError('')
    try {
      await onSave(answers)
    } catch {
      setError(t('invest.profile.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t('invest.profile.title')} initialFocusRef={titleRef}>
      <form className={s.form} onSubmit={submit} noValidate>
        <div>
          <h2 ref={titleRef} tabIndex={-1} className={s.formTitle}>{t('invest.profile.title')}</h2>
          <p className={s.formSub}>{t('invest.profile.sub')}</p>
        </div>
        {PROFILE_QUESTIONS.map((q) => (
          <fieldset key={q.id} className={s.q}>
            <legend id={`invest-q-${q.id}`} className={s.qLabel}>{t(`invest.profile.q.${q.id}`)}</legend>
            <ChoiceGroup
              labelledBy={`invest-q-${q.id}`}
              value={answers[q.id] ?? null}
              onChange={(v) => { setAnswers(a => ({ ...a, [q.id]: v })); setError('') }}
              options={q.options.map(o => ({ value: o, label: t(`invest.profile.q.${q.id}.${o}`) }))}
            />
          </fieldset>
        ))}
        <label className={s.ack}>
          <input type="checkbox" checked={ack} onChange={e => { setAck(e.target.checked); setError('') }} />
          <span>{t('invest.profile.ack')}</span>
        </label>
        {error && <p className={s.formError} role="alert">{error}</p>}
        <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={saving} aria-disabled={!ready}>
          {saving ? t('invest.profile.saving') : t('invest.profile.save')}
        </button>
      </form>
    </Sheet>
  )
}
