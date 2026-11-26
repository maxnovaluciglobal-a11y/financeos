// src/components/help/HelpPanel.jsx — panel lateral de ayuda de cada pantalla
// (ayuda en la app, 26-nov-2026): cómo se usa (resumen, pasos, ten en cuenta),
// "Ver el recorrido", novedades con su contador, el centro de ayuda y soporte.
// Va en un portal a <body>: dentro de la barra superior (backdrop-filter) un
// position: fixed queda recortado. Diálogo modal con useDialogA11y (Esc, Tab
// atrapado, botón atrás de Android, el foco vuelve al "?").
import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, BookOpen, Mail, ChevronRight } from 'lucide-react'
import { useT } from '../../i18n/useT.js'
import { useDialogA11y } from '../../hooks/useDialogA11y.js'
import { pageLabel } from '../layout/navConfig.js'
import { SUPPORT_MAILTO } from '../../utils/landingUrls.js'
import { PAGE_TOURS } from '../tour/pageTours.js'
import { guideIdFor, guideKeys, investmentsVisible } from './guides.js'
import { visibleNews, unreadCount } from './news.js'
import { readNewsRead, markNewsRead } from './helpCore.js'
import { anyTargetVisible } from './tourTargets.js'
import NewsList from './NewsList.jsx'
import s from './help.module.css'

export default function HelpPanel({ page, onClose, onStartTour, navigate, country, settings }) {
  const { t } = useT()
  const ref = useRef(null)
  const titleRef = useRef(null)
  useDialogA11y(true, onClose, ref, titleRef)

  const gid = guideIdFor(page)
  const keys = gid ? guideKeys(gid) : null
  // "Ver el recorrido" solo si la pantalla tiene alguno de sus objetivos a la vista.
  const [canTour] = useState(() => anyTargetVisible(PAGE_TOURS[page]))

  const news = useMemo(() => visibleNews({ investments: investmentsVisible(country, settings) }), [country, settings])
  const [read, setRead] = useState(readNewsRead)
  // "Nueva" se marca con lo leído al abrir el panel: no desaparece al abrir la lista.
  const [readAtOpen] = useState(readNewsRead)
  const unread = unreadCount(news, read)
  const [showNews, setShowNews] = useState(false)
  function toggleNews() {
    const next = !showNews
    setShowNews(next)
    // Abrir la lista es leerla: el contador se apaga.
    if (next && unread > 0) { markNewsRead(news.map(n => n.id)); setRead(readNewsRead()) }
  }
  const go = (id) => { onClose(); navigate(id) }
  const name = t(pageLabel(page))

  return createPortal(
    <div className={s.layer}>
      <div className={s.scrim} onClick={onClose} aria-hidden="true" />
      <aside ref={ref} className={s.panel} role="dialog" aria-modal="true" aria-labelledby="fos-help-title">
        <header className={s.head}>
          <div style={{ minWidth: 0 }}>
            <p className={s.eyebrow}>{t('help.panel.title')}</p>
            <h2 id="fos-help-title" ref={titleRef} tabIndex={-1} className={s.title}>{name}</h2>
          </div>
          <button type="button" className={s.close} onClick={onClose} aria-label={t('help.panel.close')}>
            <X size={20} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </header>

        <div className={s.body}>
          {keys ? (
            <section aria-labelledby="fos-help-howto">
              <h3 id="fos-help-howto" className={s.h3}>{t('help.panel.howTo')}</h3>
              <p className={s.summary}>{t(keys.summary)}</p>
              <h4 className={s.h4}>{t('help.panel.steps')}</h4>
              <ol className={s.steps}>
                {keys.steps.map(k => <li key={k}>{t(k)}</li>)}
              </ol>
              {keys.tips.length > 0 && (
                <>
                  <h4 className={s.h4}>{t('help.panel.tips')}</h4>
                  <ul className={s.tips}>{keys.tips.map(k => <li key={k}>{t(k)}</li>)}</ul>
                </>
              )}
              {canTour && (
                <button type="button" className="fos-btn-primary" onClick={onStartTour} style={{ marginTop: 14 }}>
                  {t('help.panel.tour')}
                </button>
              )}
            </section>
          ) : (
            <p className={s.summary}>{t('help.panel.noGuide')}</p>
          )}

          <section aria-labelledby="fos-help-news" className={s.block}>
            <div className={s.newsHead}>
              <h3 id="fos-help-news" className={s.h3} style={{ margin: 0 }}>{t('help.news.title')}</h3>
              {unread > 0 && <span className={s.badge}>{t('help.news.unread', { n: unread })}</span>}
            </div>
            <button type="button" className="fos-link" aria-expanded={showNews} aria-controls="fos-help-news-list" onClick={toggleNews}>
              {t(showNews ? 'help.news.hide' : 'help.news.show')}
            </button>
            {showNews && (
              <div id="fos-help-news-list">
                <NewsList items={news.slice(0, 5)} read={readAtOpen} onGo={go} />
                <button type="button" className="fos-link" onClick={() => go('help')}>{t('help.news.all')}</button>
              </div>
            )}
          </section>

          <nav className={s.links} aria-label={t('help.panel.title')}>
            <button type="button" className={s.row} onClick={() => go('help')}>
              <BookOpen size={18} strokeWidth={1.7} aria-hidden="true" />
              <span className={s.rowText}><span>{t('help.panel.center')}</span><small>{t('help.panel.centerSub')}</small></span>
              <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <a className={s.row} href={SUPPORT_MAILTO}>
              <Mail size={18} strokeWidth={1.7} aria-hidden="true" />
              <span className={s.rowText}><span>{t('help.panel.support')}</span><small>support@moyiq.app · {t('help.panel.supportSub')}</small></span>
              <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" />
            </a>
          </nav>
        </div>
      </aside>
    </div>,
    document.body,
  )
}
