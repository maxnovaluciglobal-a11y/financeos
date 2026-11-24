// src/pages/Investments/help/InvestHelp.jsx — Ayuda de Inversiones (F7).
// Hoja con las preguntas de la ayuda de Invest reescritas para moyiq, en grupos
// de <details>/<summary> (mismo acordeón que Mercado). Se carga con lazy()
// desde el hub de Inversiones (botón "Ayuda") y desde Ajustes › Inversiones:
// ni la hoja ni sus textos pesan en la carga inicial.
import { useRef } from 'react'
import { X } from 'lucide-react'
import Sheet from '../../../components/ui/Sheet.jsx'
import { HELP_EMAIL, HELP_GROUPS, useHelpT } from './dict.js'
import s from './help.module.css'

// Cuerpo de la ayuda (sin la hoja), para poder probarlo con renderToStaticMarkup.
export function HelpBody({ t, titleRef = null, onClose = null }) {
  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <div>
          <h2 ref={titleRef} tabIndex={-1} className={s.title} id="invest-help-title">{t('hlp.title')}</h2>
          <p className={s.intro}>{t('hlp.intro')}</p>
        </div>
        {onClose && (
          <button type="button" className={s.close} onClick={onClose} aria-label={t('hlp.close')}>
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
      {HELP_GROUPS.map(g => (
        <section key={g.id} className={s.group} aria-labelledby={`invest-help-g-${g.id}`}>
          <h3 id={`invest-help-g-${g.id}`} className={s.groupTitle}>{t(`hlp.g.${g.id}`)}</h3>
          <div className={s.list}>
            {g.qs.map(q => (
              <details key={q} className={s.item} data-help={q}>
                <summary>{t(`hlp.q.${q}`)}</summary>
                <div className={s.answer}>
                  {String(t(`hlp.a.${q}`)).split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
      <p className={s.contact}>
        {String(t('hlp.contact', { email: '\u0000' })).split('\u0000').flatMap((part, i) => (i ? [<a key="m" href={`mailto:${HELP_EMAIL}`}>{HELP_EMAIL}</a>, part] : [part]))}
      </p>
      <p className={s.foot} role="note">{t('hlp.foot')}</p>
    </div>
  )
}

export default function InvestHelp({ open, onClose }) {
  const { t, ready } = useHelpT()
  const titleRef = useRef(null)
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t('hlp.title')} initialFocusRef={titleRef} maxWidth={560} initialDetent="full">
      {ready
        ? <HelpBody t={t} titleRef={titleRef} onClose={onClose} />
        : <p className={s.status} role="status" ref={titleRef} tabIndex={-1}>{t('hlp.loading')}</p>}
    </Sheet>
  )
}
