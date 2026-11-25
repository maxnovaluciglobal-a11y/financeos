// src/pages/Dashboard/LocalAlertsCard.jsx — "Avisos de tus finanzas" en el
// Inicio (24-nov-2026). Es la forma web de los avisos locales: lo que vale HOY
// según core/localAlerts/plan.js (`current`): fijo que vence mañana,
// presupuesto al 90 %, poco margen para el resto del mes y día de cobro. Cada
// aviso se descarta con la X (por clave: el mes o la fecha, así vuelve cuando
// corresponde). Respeta los tipos apagados en Ajustes › Notificaciones y
// "Ocultar montos".
import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, ChartPie, Wallet, BadgeDollarSign, X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { fmtMoney, currencySymbol, catName } from '../../utils/index.js'
import { ExtrasStringsGate } from '../../extras/strings.js'
import { planLocalAlerts, alertPrefs, alertText } from '../../core/localAlerts/plan.js'
import { focusAfter } from '../../utils/focusAfter.js'
import s from './localAlertsCard.module.css'

export const SEEN_KEY = 'fos_local_alerts_seen'
const MAX = 3
const ICONS = { fixedDue: CalendarClock, budget: ChartPie, left: Wallet, payday: BadgeDollarSign }
const TARGET = { fixedDue: 'recurring', budget: 'budgets', payday: 'recurring' }

function readSeen() {
  try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} }
}

export default function LocalAlertsCard(props) {
  return <ExtrasStringsGate><Card {...props} /></ExtrasStringsGate>
}

function Card({ setPage }) {
  const { incomes, expenses, setAsides, budgets, recurring, settings } = useApp()
  const { t, lang } = useT()
  const [seen, setSeen] = useState(readSeen)
  const cardRef = useRef(null)
  const refocus = useRef(null) // posición de la fila descartada
  const items = useMemo(() => {
    const prefs = alertPrefs(settings)
    const sym = currencySymbol(settings?.currency, settings?.language)
    const { current } = planLocalAlerts({ incomes, expenses, setAsides, budgets, recurring, settings })
    return current
      .filter(a => prefs[a.type] && !seen[a.key])
      .slice(0, MAX)
      .map(a => ({ ...a, ...alertText(a, { t, money: (n) => fmtMoney(n, sym), cat: (c) => catName(c, lang), amounts: prefs.amounts }) }))
  }, [incomes, expenses, setAsides, budgets, recurring, settings, seen, t, lang])

  // Tras descartar, el foco pasa a la X de la fila que ocupó su lugar (o a la
  // anterior); si no quedan avisos, al título de la sección siguiente.
  useEffect(() => {
    const at = refocus.current
    if (at == null) return
    refocus.current = null
    const btns = cardRef.current?.querySelectorAll('button[data-dismiss]')
    if (btns?.length) btns[Math.min(at, btns.length - 1)].focus()
  }, [items])

  if (!items.length) return null

  function dismiss(key, index) {
    refocus.current = index
    if (items.length === 1) focusAfter(cardRef.current)
    const next = { ...seen, [key]: Date.now() }
    // Lo descartado hace más de 45 días ya no hace falta recordarlo.
    const cutoff = Date.now() - 45 * 864e5
    for (const k of Object.keys(next)) if (next[k] < cutoff) delete next[k]
    setSeen(next)
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)) } catch { /* sin almacenamiento: vuelve a mostrarse al recargar */ }
  }

  return (
    <section className={s.card} ref={cardRef} aria-label={t('la.banner.aria')}>
      <ul className={s.list}>
        {items.map((a, i) => {
          const Icon = ICONS[a.type] || CalendarClock
          const to = TARGET[a.type]
          const Main = to && setPage ? 'button' : 'div'
          return (
            <li key={a.key} className={s.row}>
              <Main type={Main === 'button' ? 'button' : undefined} className={s.main} onClick={Main === 'button' ? () => setPage(to) : undefined}>
                <span className={s.icon} aria-hidden="true"><Icon size={18} strokeWidth={1.8} /></span>
                <span className={s.text}>
                  <span className={s.title}>{a.title}</span>
                  <span className={s.body}>{a.body}</span>
                </span>
              </Main>
              <button type="button" className={s.close} data-dismiss="" onClick={() => dismiss(a.key, i)} aria-label={t('la.banner.dismiss', { title: a.title })}>
                <X size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
