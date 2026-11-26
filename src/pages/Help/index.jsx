// src/pages/Help/index.jsx — Centro de ayuda (ayuda en la app, 26-nov-2026):
// todas las guías con un buscador, cada una con "Ver el recorrido", las
// novedades y el contacto con soporte. Se abre desde Más y desde el panel de
// ayuda de cualquier pantalla. Pantalla diferida (App.jsx, DemoShell.jsx).
import { useEffect, useId, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { PageHeader } from '../../components/ui/index.jsx'
import { HelpStringsGate } from '../../i18n/help/index.js'
import { PAGE_TOURS } from '../../components/tour/pageTours.js'
import { visibleGuides, guideKeys, searchGuides, investmentsVisible } from '../../components/help/guides.js'
import { visibleNews } from '../../components/help/news.js'
import { readNewsRead, markNewsRead, readSeen, requestTourReplay, TOUR_PAGES } from '../../components/help/helpCore.js'
import NewsList from '../../components/help/NewsList.jsx'
import { SUPPORT_MAILTO, helpUrl } from '../../utils/landingUrls.js'
import { isNativeApp } from '../../native/platform.js'
import s from '../../components/help/help.module.css'

function Guide({ id, t, onTour, onOpen }) {
  const [open, setOpen] = useState(false)
  const k = guideKeys(id)
  const bodyId = useId()
  const hasTour = !!PAGE_TOURS[id]
  return (
    <li className={s.guide}>
      <h3 className={s.guideName}>{t(k.name)}</h3>
      <p className={s.summary}>{t(k.summary)}</p>
      {open && (
        <div id={bodyId}>
          <h4 className={s.h4}>{t('help.panel.steps')}</h4>
          <ol className={s.steps}>{k.steps.map(x => <li key={x}>{t(x)}</li>)}</ol>
          {k.tips.length > 0 && (
            <>
              <h4 className={s.h4}>{t('help.panel.tips')}</h4>
              <ul className={s.tips}>{k.tips.map(x => <li key={x}>{t(x)}</li>)}</ul>
            </>
          )}
        </div>
      )}
      <div className={s.guideActions}>
        <button type="button" className="fos-link" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(v => !v)}>
          {t(open ? 'help.center.less' : 'help.center.more')}
        </button>
        {hasTour && <button type="button" className="fos-link" onClick={() => onTour(id)}>{t('help.panel.tour')}</button>}
        {!hasTour && id !== 'country' && <button type="button" className="fos-link" onClick={() => onOpen(id)}>{t('help.center.open')}</button>}
      </div>
    </li>
  )
}

function HelpCenter({ setPage }) {
  const { settings = {} } = useApp() || {}
  const { t, lang } = useT()
  const [q, setQ] = useState('')
  const country = (settings.country || 'CL').toUpperCase()
  const all = useMemo(() => visibleGuides(country, settings), [country, settings])
  const shown = useMemo(() => searchGuides(all, q, t), [all, q, t])
  const news = useMemo(() => visibleNews({ investments: investmentsVisible(country, settings) }), [country, settings])
  const [readAtOpen] = useState(readNewsRead)
  // Abrir el centro de ayuda es leer las novedades: el contador del "?" se apaga.
  useEffect(() => { markNewsRead(news.map(n => n.id)) }, [news])
  const seen = readSeen()
  const tourIds = all.filter(id => TOUR_PAGES.includes(id))
  const seenCount = tourIds.filter(id => seen.includes(id)).length

  const tour = (id) => { requestTourReplay(id); setPage?.(id) }
  const native = isNativeApp()

  return (
    <div className={s.center}>
      <PageHeader title={t('help.center.title')} sub={t('help.center.sub')} />

      <div role="search" className={s.searchWrap}>
        <label htmlFor="fos-help-search" className="sr-only">{t('help.center.search')}</label>
        <input id="fos-help-search" type="search" className={s.search} value={q} onChange={e => setQ(e.target.value)}
          placeholder={t('help.center.searchPh')} autoComplete="off" enterKeyHint="search" />
        {q && (
          <button type="button" className={s.clear} onClick={() => setQ('')} aria-label={t('help.center.clear')}>
            <X size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        )}
      </div>
      <p className={s.count} role="status" aria-live="polite">
        {q && shown.length === 0 ? t('help.center.none', { q }) : t('help.center.count', { n: shown.length })}
        {!q && !settings.isDemo && tourIds.length > 0 && <> · {t('help.center.progress', { n: seenCount, total: tourIds.length })}</>}
      </p>

      <section aria-labelledby="fos-help-guides">
        <h2 id="fos-help-guides" className={s.section}>{t('help.center.guides')}</h2>
        <ul className={s.guides} style={{ marginTop: 10 }}>
          {shown.map(id => <Guide key={id} id={id} t={t} onTour={tour} onOpen={(p) => setPage?.(p)} />)}
        </ul>
      </section>

      <section aria-labelledby="fos-help-news-center">
        <h2 id="fos-help-news-center" className={s.section}>{t('help.news.title')}</h2>
        <NewsList items={news} read={readAtOpen} onGo={(p) => setPage?.(p)} here="help" />
      </section>

      <section aria-labelledby="fos-help-support" className={s.guide}>
        <h2 id="fos-help-support" className={s.guideName}>{t('help.center.supportTitle')}</h2>
        <p className={s.summary}>{t('help.center.supportBody')}</p>
        <div className={s.guideActions}>
          <a className="fos-link" href={SUPPORT_MAILTO}>{t('help.panel.support')}</a>
          {/* La app de tienda no enlaza a la web (precios y planes, B2 de la revisión pre-tiendas). */}
          {!native && <a className="fos-link" href={helpUrl(lang)} target="_blank" rel="noopener noreferrer">{t('help.center.web')}</a>}
        </div>
      </section>
    </div>
  )
}

export default function HelpPage(props) {
  return <HelpStringsGate><HelpCenter {...props} /></HelpStringsGate>
}
