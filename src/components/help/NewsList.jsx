// src/components/help/NewsList.jsx — lista de novedades (panel y centro de ayuda).
import { useT } from '../../i18n/useT.js'
import { dateLocale } from '../../utils/index.js'
import { pageLabel } from '../layout/navConfig.js'
import { newsKeys } from './news.js'
import s from './help.module.css'

export function fmtNewsDate(iso) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })
  } catch { return iso }
}

export default function NewsList({ items, read = [], onGo, here }) {
  const { t } = useT()
  const seen = new Set(read)
  return (
    <ul className={s.news}>
      {items.map(n => {
        const k = newsKeys(n.id)
        return (
          <li key={n.id} className={s.newsItem}>
            <div className={s.newsMeta}>
              <time dateTime={n.date}>{fmtNewsDate(n.date)}</time>
              {!seen.has(n.id) && <span className={s.newTag}>{t('help.news.new')}</span>}
            </div>
            <h4 className={s.newsTitle}>{t(k.title)}</h4>
            <p className={s.newsText}>{t(k.text)}</p>
            {n.page && onGo && n.page !== here && (
              <button type="button" className="fos-link" onClick={() => onGo(n.page)}>
                {t('help.news.where', { page: t(pageLabel(n.page)) })}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
