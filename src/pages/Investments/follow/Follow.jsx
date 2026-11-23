// src/pages/Investments/follow/Follow.jsx — pestaña Siguiendo de Inversiones (F4).
//
// Rehace la sección Lista de Invest (inventario 03-lista.md) con 4 sub-pestañas:
// Mi lista, Alertas (en el servidor, con push), Descubrir y Comparar. Se carga
// con lazy() desde el hub, con sus textos (./strings.<idioma>.js): nada de esto
// entra al JS inicial. La sub-pestaña vive en la entrada del historial y en
// fos_invest_follow_tab (investNav). Lo técnico (tendencia, RSI, MACD,
// volumen, 52 semanas, Sharpe, correlación) solo en Vista completa.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../../context/AppContext.jsx'
import { investApi } from '../../../core/investApi.js'
import { FOLLOW_TABS, bootFollowTab, rememberFollowTab, tabKeyTarget } from '../../../utils/investNav.js'
import { shows } from '../../../utils/investView.js'
import { demoFollowQuotes } from '../../../demo/demoInvestFollow.js'
import { useFollowT } from './dict.js'
import { useFollowData } from './useFollowData.js'
import { alertErrorKey, pushResultText, safeStorage, usePushOffer } from './shared.js'
import AlertSheet from './AlertSheet.jsx'
import ListPane from './ListPane.jsx'
import AlertsPane from './AlertsPane.jsx'
import DiscoverPane from './DiscoverPane.jsx'
import ComparePane from './ComparePane.jsx'
import s from '../portfolio/portfolio.module.css'

export default function Follow({ demo = false, view = 'esencial', onOpen }) {
  const { t, ready } = useFollowT()
  const app = useApp() || {}
  const showToast = app.showToast
  const full = shows(view, 'indicators')
  const d = useFollowData({ demo, full })
  const push = usePushOffer(demo)
  const [sub, setSub] = useState(() => bootFollowTab({ storage: safeStorage }))
  const [sheet, setSheet] = useState(null) // { prev, symbol }
  const refs = useRef({})
  useEffect(() => { rememberFollowTab(sub, safeStorage) }, [sub])

  const say = useCallback((msg, action = null) => showToast?.(msg, 'ok', action), [showToast])
  const sayErr = useCallback((code) => {
    const [k, vars] = alertErrorKey(code)
    showToast?.(t(k, vars), 'error')
  }, [showToast, t])

  function onSubKey(e) {
    const next = tabKeyTarget(e.key, sub, FOLLOW_TABS)
    if (!next) return
    e.preventDefault()
    setSub(next)
    refs.current[next]?.focus()
  }

  const quoteOf = useCallback(async (sym) => (demo ? demoFollowQuotes([sym])[sym] || null : (d.quotes[sym] || await investApi.quote(sym))), [demo, d.quotes])
  // La campana de Mi lista: con alertas, lleva a Alertas; sin, abre la hoja.
  // Al ir a Alertas el panel de Mi lista se desmonta: el foco pasa a la pestaña.
  const onBell = (tk, has) => {
    if (!has) { setSheet({ prev: null, symbol: tk }); return }
    setSub('alertas')
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => refs.current.alertas?.focus())
  }
  async function onFollow(tk) {
    const r = await d.follow(tk)
    if (!r.ok) { sayErr(r.error); return }
    say(t(r.data?.existed ? 'fl.list.exists' : 'fl.list.added', { t: tk }))
  }
  function onSaved(r, prev, value) {
    setSheet(null)
    if (prev) { say(t('fl.sheet.updated')); return }
    const msg = t('fl.sheet.saved', { t: value.symbol })
    // Creada desde Mi lista sin avisos activos: sin push la alerta no llega.
    if (push.state === 'off') {
      say(`${msg} ${t('fl.push.off')}`, {
        label: t('fl.push.enable'),
        onAction: async () => { const [txt, tone] = pushResultText(await push.enable(), t); showToast?.(txt, tone) },
      })
    } else if (push.state === 'noLicense' || push.state === 'unsupported') say(`${msg} ${t(push.state === 'noLicense' ? 'fl.push.noLicense' : 'fl.push.unsupported')}`)
    else say(msg)
  }

  if (!ready) return <p className={s.note} role="status">{t('invest.card.loading')}</p>

  return (
    <div className={s.wrap}>
      <div role="tablist" aria-label={t('fl.tabsLabel')} className={s.subtabs}>
        {FOLLOW_TABS.map(k => (
          <button key={k} ref={el => { refs.current[k] = el }} type="button" role="tab" id={`fl-tab-${k}`}
            aria-selected={sub === k} aria-controls={`fl-panel-${k}`} tabIndex={sub === k ? 0 : -1}
            className={s.subtab} onClick={() => setSub(k)} onKeyDown={onSubKey}>
            {t(`fl.tab.${k}`)}
          </button>
        ))}
      </div>
      {demo && <p className={s.sample}>{t('fl.sample')}</p>}

      <div role="tabpanel" id={`fl-panel-${sub}`} aria-labelledby={`fl-tab-${sub}`}>
        {sub === 'lista' && <ListPane t={t} d={d} full={full} demo={demo} onOpen={onOpen} onAlert={onBell} onSay={say} onErr={sayErr} />}
        {sub === 'alertas' && <AlertsPane t={t} d={d} demo={demo} push={push} onNew={(sym) => setSheet({ prev: null, symbol: sym })} onEdit={(a) => setSheet({ prev: a, symbol: a.symbol })} onSay={say} onErr={sayErr} />}
        {sub === 'descubrir' && <DiscoverPane t={t} full={full} demo={demo} watch={d.watch.list} onOpen={onOpen} onFollow={onFollow} onSay={say} />}
        {sub === 'comparar' && <ComparePane t={t} demo={demo} full={full} />}
      </div>

      <AlertSheet open={!!sheet} onClose={() => setSheet(null)} prev={sheet?.prev || null} symbol={sheet?.symbol || ''}
        quoteOf={quoteOf} alerts={d.alerts.list} onSave={d.saveAlert} onSaved={onSaved} pushState={push.state} />
    </div>
  )
}
