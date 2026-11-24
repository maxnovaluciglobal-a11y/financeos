// src/pages/Investments/hub/TickerSearch.jsx — buscador global de tickers de
// Inversiones (combobox del patrón APG: flechas, Enter, Esc).
// Universo: portafolio y lista de la persona (se piden al enfocar, no antes)
// más los tickers conocidos de tickerSearch.js. Vista previa del precio con
// /api/quote (investApi, caché en memoria). En el demo, la misma cotización
// real (demo/demoMarketApi.js); si solo hay la de ejemplo, no se muestra.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useT } from '../../../i18n/useT.js'
import { useMoney } from '../../../components/Money.jsx'
import { investApi } from '../../../core/investApi.js'
import { demoMarketApi } from '../../../demo/demoMarketApi.js'
import { investData } from '../../../core/investData.js'
import { decimalsFor } from '../../../utils/investValuation.js'
import { fmtAmount, fmtPct } from '../../../utils/index.js'
import { POPULAR, SEARCH_TICKER_RE, searchMatches } from './tickerSearch.js'
import s from './hub.module.css'

export function priceText(q) {
  if (!q) return ''
  const ccy = q.currency || 'USD'
  return `${ccy === 'USD' ? 'US$' : `${ccy} `}${fmtAmount(q.price, decimalsFor(ccy))}`
}

export default function TickerSearch({ onOpen, demo = false, demoTickers = [] }) {
  const { t } = useT()
  const { m } = useMoney()
  const id = useId()
  const listId = `${id}-list`
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [mine, setMine] = useState({ portfolio: [], watch: [] })
  const [preview, setPreview] = useState(null) // { t, phase: 'loading'|'ok'|'none'|'demo'|'offline', q }
  const loaded = useRef(false)

  function loadMine() {
    if (loaded.current) return
    loaded.current = true
    if (demo) { setMine({ portfolio: demoTickers.map(x => ({ t: x })), watch: [] }); return }
    Promise.all([investData.listHoldings(), investData.listWatchlist()]).then(([h, w]) => {
      setMine({
        portfolio: h.ok ? h.data.map(x => ({ t: x.t })) : [],
        watch: w.ok ? w.data.map(x => ({ t: x })) : [],
      })
    })
  }

  const groups = useMemo(() => [
    { key: 'portfolio', items: mine.portfolio },
    { key: 'watch', items: mine.watch },
    { key: 'popular', items: POPULAR },
  ], [mine])
  const results = useMemo(() => searchMatches(query, groups), [query, groups])
  const typed = query.trim().toUpperCase()
  const invalid = typed.length > 0 && !SEARCH_TICKER_RE.test(typed) && results.length === 0
  const target = active >= 0 ? results[active]?.t : (SEARCH_TICKER_RE.test(typed) ? typed : null)

  // Vista previa con espera corta: no se pide nada mientras se escribe.
  useEffect(() => {
    if (!open || !target) { setPreview(null); return undefined }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setPreview({ t: target, phase: 'offline' }); return undefined }
    let alive = true
    setPreview({ t: target, phase: 'loading' })
    const timer = setTimeout(() => {
      ;(demo ? demoMarketApi : investApi).quote(target).then((q) => { if (alive) setPreview({ t: target, phase: q ? (q.sample ? 'demo' : 'ok') : 'none', q }) })
    }, 350)
    return () => { alive = false; clearTimeout(timer) }
  }, [target, open, demo])

  function choose(tk) {
    if (!tk) return
    setOpen(false); setActive(-1); setQuery('')
    onOpen?.(tk)
  }
  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => (results.length ? (i + 1) % results.length : -1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); setActive(i => (results.length ? (i <= 0 ? results.length - 1 : i - 1) : -1)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (active >= 0 && results[active]) choose(results[active].t)
      else if (SEARCH_TICKER_RE.test(typed)) choose(typed)
    } else if (e.key === 'Escape') {
      if (query) { setQuery(''); setActive(-1) } else setOpen(false)
    }
  }

  const note = (() => {
    if (invalid) return { tone: 'error', text: t('invest.search.invalid') }
    if (preview?.phase === 'loading') return { text: t('invest.search.preview.loading', { t: preview.t }) }
    if (preview?.phase === 'none') return { text: t('invest.search.preview.none', { t: preview.t }) }
    if (preview?.phase === 'demo') return { text: t('invest.search.preview.demo') }
    if (preview?.phase === 'offline') return { text: t('invest.search.preview.offline') }
    if (preview?.phase === 'ok') return { text: t('invest.search.preview.price', { t: preview.t, price: m(priceText(preview.q)), pct: fmtPct(preview.q.changePct, { signed: true }) }) }
    if (open && query && results.length === 0) return { text: t('invest.search.empty') }
    return null
  })()

  let lastGroup = null
  const showList = open && results.length > 0
  return (
    <div className={s.search}>
      <label htmlFor={`${id}-input`} className={s.searchLabel}>{t('invest.search.label')}</label>
      <div className={s.searchField}>
        <Search size={18} strokeWidth={2} aria-hidden="true" className={s.searchIcon} />
        <input
          id={`${id}-input`} className={s.searchInput} type="text" role="combobox" autoComplete="off" autoCapitalize="characters" spellCheck={false}
          aria-autocomplete="list" aria-expanded={showList} aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? `${id}-opt-${active}` : undefined}
          aria-invalid={invalid || undefined} aria-describedby={`${id}-note`}
          placeholder={t('invest.search.placeholder')} value={query} maxLength={24}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(-1) }}
          onFocus={() => { loadMine(); setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
      </div>
      <ul id={listId} role="listbox" aria-label={t('invest.search.label')} className={s.listbox} hidden={!showList}>
        {results.map((r, i) => {
          const header = r.group !== lastGroup && r.group !== 'typed' ? r.group : null
          lastGroup = r.group
          return [
            header && <li key={`g-${header}`} role="presentation" className={s.groupLabel}>{t(`invest.search.group.${header}`)}</li>,
            // El teclado va por el combobox (aria-activedescendant): la opción solo recibe el toque o el clic.
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li key={r.t} id={`${id}-opt-${i}`} role="option" aria-selected={i === active} className={s.option}
              onMouseDown={(e) => e.preventDefault()} onClick={() => choose(r.t)}>
              <span className={s.optionTicker}>{r.open ? t('invest.search.open', { t: r.t }) : r.t}</span>
              {r.name && <span className={s.optionName}>{r.name}</span>}
            </li>,
          ]
        })}
      </ul>
      <p id={`${id}-note`} className={s.searchNote} data-tone={note?.tone} role="status" aria-live="polite">
        {note?.text || (showList ? t(results.length === 1 ? 'invest.search.count.one' : 'invest.search.count.many', { n: results.length }) : '')}
      </p>
    </div>
  )
}
