// src/components/WhatsNew.jsx — N12 "Novedades" (patrón de rial), 30-oct-2026.
// Una hoja con lo que cambió, una sola vez por versión, a quien ya usaba la
// app. No en la demo (no hay "versión anterior" para quien la prueba).
import { useEffect, useState } from 'react'
import Sheet from './ui/Sheet.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/useT.js'
import { pendingNotes, SEEN_KEY } from '../data/releaseNotes.js'
import s from './whatsNew.module.css'

export default function WhatsNew() {
  const ctx = useApp() || {}
  const { t, lang } = useT()
  const [notes, setNotes] = useState([])
  const isDemo = !!ctx.settings?.isDemo
  const hasData = [ctx.incomes, ctx.expenses, ctx.budgets, ctx.goals].some(a => Array.isArray(a) && a.length > 0)
  const ready = ctx.loading === false || ctx.loading === undefined

  useEffect(() => {
    if (isDemo || !ready) return
    let seen = null
    try { seen = localStorage.getItem(SEEN_KEY) } catch { /* sin almacenamiento: no se muestra nada */ return }
    const { show, markSeen } = pendingNotes({ seen, hasData })
    if (markSeen) { try { localStorage.setItem(SEEN_KEY, markSeen) } catch { /* modo privado */ } }
    if (show.length) setNotes(show)
  }, [isDemo, ready, hasData])

  if (!notes.length) return null
  const close = () => setNotes([])
  return (
    <Sheet open onClose={close} ariaLabel={t('whatsnew.title')}>
      <h2 className={s.title}>{t('whatsnew.title')}</h2>
      {notes.map(n => (
        <ul key={n.id} className={s.list}>
          {(n.items[lang] || n.items.es || []).map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      ))}
      <button type="button" className={`fos-btn-primary ${s.cta}`} onClick={close}>{t('whatsnew.ok')}</button>
    </Sheet>
  )
}
