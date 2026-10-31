// src/components/QuickLineField.jsx — "Escribir el movimiento en una línea" (#2).
// Campo de una línea del alta rápida. La interpretación es local
// (utils/quickLine.js) y QuickAddForm rellena los campos; acá solo se muestra
// el estado: la marca de privacidad, o la pregunta si el monto admite dos
// lecturas. Enter guarda solo cuando el formulario ya es válido.
import { useT } from '../i18n/useT.js'
import { useMoney, MONEY_MASK } from './Money.jsx'
import { fmtMoney, fmtMoneyFor } from '../utils/index.js'
import css from './QuickLineField.module.css'

export default function QuickLineField({ value, result, sym, onChange, onPick, onEnter, summary }) {
  const { t, lang } = useT()
  const { hidden, m } = useMoney()
  const status = result?.status || 'empty'
  const asking = status === 'ambiguous'
  const warn = asking || status === 'unreadable' || status === 'needsRate' || status === 'foreign'
  const currency = String(sym || '').replace(/\.$/, '') // "Bs." cierra la frase sin doble punto

  const message = asking ? t('qa.line.ask')
    : status === 'unreadable' ? t('qa.line.unreadable')
      : status === 'needsRate' ? t('qa.line.needsRate', { currency })
        : status === 'foreign' ? t('qa.line.foreign', { code: result.code, currency })
          : status === 'noAmount' ? t('qa.line.noAmount')
            : t('qa.line.local')

  const money = (o) => (o.usd ? fmtMoneyFor(o.value, 'USD', lang) : fmtMoney(o.value, sym))

  return (
    <div className={css.wrap}>
      <input
        type="text" value={value} className={css.input}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          e.stopPropagation()
          if (!asking) onEnter()
        }}
        placeholder={t('qa.line.ph')}
        aria-label={t('qa.line.label')}
        aria-describedby="qa-line-status"
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        enterKeyHint="done"
      />
      <div id="qa-line-status" role="status" className={`${css.status} ${warn ? css.warn : ''}`}>
        {message}
        {summary && <span className="sr-only"> · {summary.type}: {summary.amount}, {summary.cat}</span>}
      </div>
      {asking && result.options.length > 0 && (
        <div role="group" aria-label={t('qa.line.ask')} className={css.options}>
          {result.options.map((o, i) => (
            <button key={`${o.value}-${i}`} type="button" className="fos-chip fos-chip--tall" onClick={() => onPick(i)}
              aria-label={hidden ? t('qa.line.option', { n: i + 1 }) : t('qa.line.pick', { amount: money(o) })}>
              {/* Con montos ocultos las cifras serían idénticas: se numeran. */}
              <span aria-hidden="true" className="num">{hidden ? `${t('qa.line.option', { n: i + 1 })} · ${MONEY_MASK}` : m(money(o))}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
