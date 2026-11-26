// src/pages/Investments/follow/Follow.jsx — pestaña Siguiendo de Inversiones (F4).
//
// Rehace la sección Lista de Invest (inventario 03-lista.md). Desde el
// 26-nov-2026 (propuesta 8 de la revisión del flujo) tiene 2 sub-pestañas:
// Mi lista, con la alerta de precio de cada activo en su fila (en el servidor,
// con push), y Descubrir. Comparar se abre en una hoja desde Mi lista (y desde
// la ficha, con queueFollow). Se carga con lazy() desde el hub, con sus textos
// (./strings.<idioma>.js): nada de esto entra al JS inicial. La sub-pestaña
// vive en la entrada del historial y en fos_invest_follow_tab (investNav).
// Lo técnico (tendencia, RSI, MACD, volumen, 52 semanas, Sharpe, correlación)
// solo en Vista completa.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../../context/AppContext.jsx'
import { investApi } from '../../../core/investApi.js'
import { FOLLOW_TABS, OPEN_EVENT, bootFollowTab, rememberFollowTab, tabKeyTarget, takeFollowFocus, takeQueuedCompare } from '../../../utils/investNav.js'
import { shows } from '../../../utils/investView.js'
import { alertsBySymbol } from '../../../utils/investAlerts.js'
import { DEFAULT_COMPARE } from '../../../utils/investFollow.js'
import { demoMarketApi } from '../../../demo/demoMarketApi.js'
import Sheet from '../../../components/ui/Sheet.jsx'
import { useFollowT } from './dict.js'
import { useFollowData } from './useFollowData.js'
import { alertErrorKey, pushResultText, safeStorage, usePushOffer } from './shared.js'
import { useAlertActions } from './AlertParts.jsx'
import AlertSheet from './AlertSheet.jsx'
import ListPane from './ListPane.jsx'
import DiscoverPane from './DiscoverPane.jsx'
import ComparePane from './ComparePane.jsx'
import s from '../portfolio/portfolio.module.css'
import f from './follow.module.css'

// Activos para Comparar desde Mi lista: los de la lista (hasta 4); con menos
// de 2, la comparación de siempre.
export function compareFromList(list) {
  const l = [...new Set(list || [])].slice(0, 4)
  return l.length >= 2 ? l : DEFAULT_COMPARE.tickers
}

export default function Follow({ demo = false, view = 'esencial', onOpen }) {
  const { t, ready } = useFollowT()
  const app = useApp() || {}
  const showToast = app.showToast
  const full = shows(view, 'indicators')
  const d = useFollowData({ demo, full })
  const push = usePushOffer(demo)
  const [sub, setSub] = useState(() => bootFollowTab({ storage: safeStorage }))
  const [focus, setFocus] = useState(() => takeFollowFocus())
  const [sheet, setSheet] = useState(null) // { prev, symbol }
  // Comparar: los activos con que abre la hoja (desde la ficha llegan en cola).
  const [cmp, setCmp] = useState(() => { const q = takeQueuedCompare(); return q ? { list: q, n: 1 } : null })
  const refs = useRef({})
  useEffect(() => { rememberFollowTab(sub, safeStorage) }, [sub])
  // Aviso push tocado con Siguiendo ya abierta: Mi lista, con las alertas a la vista.
  useEffect(() => {
    const onOpenLink = (e) => {
      if (!e.detail?.follow) return
      setSub(bootFollowTab({ storage: safeStorage }))
      setFocus(takeFollowFocus())
    }
    window.addEventListener(OPEN_EVENT, onOpenLink)
    return () => window.removeEventListener(OPEN_EVENT, onOpenLink)
  }, [])

  const say = useCallback((msg, action = null) => showToast?.(msg, 'ok', action), [showToast])
  const sayErr = useCallback((code) => {
    const [k, vars] = alertErrorKey(code)
    showToast?.(t(k, vars), 'error')
  }, [showToast, t])
  const acts = useAlertActions({ t, d, onSay: say, onErr: sayErr })

  function onSubKey(e) {
    const next = tabKeyTarget(e.key, sub, FOLLOW_TABS)
    if (!next) return
    e.preventDefault()
    setSub(next)
    refs.current[next]?.focus()
  }

  const quoteOf = useCallback(async (sym) => (d.quotes[sym] || await (demo ? demoMarketApi : investApi).quote(sym)), [demo, d.quotes])
  const bySym = useMemo(() => alertsBySymbol(d.alerts.list), [d.alerts.list])
  // La campana de una fila: la hoja de ese activo, con el símbolo puesto. Sin
  // alertas, para crear; con alertas, edita la primera (la hoja lista las demás).
  const onBell = (tk) => {
    const list = bySym.get(tk) || []
    setSheet({ prev: list[0] || null, symbol: tk })
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
        onAction: async () => { const [txt, tone] = pushResultText(await push.enable(), t); if (txt) showToast?.(txt, tone) },
      })
    } else if (push.state === 'noLicense' || push.state === 'unsupported') say(`${msg} ${t(push.state === 'noLicense' ? 'fl.push.noLicense' : 'fl.push.unsupported')}`)
    else say(msg)
  }

  if (!ready) return <p className={s.note} role="status">{t('invest.card.loading')}</p>

  // Un solo aviso corto de datos de ejemplo por pantalla.
  const sample = demo ? t('fl.sample') : sub === 'lista' && (d.quotesSample || d.histSample) ? t('fl.sampleLive') : null

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
      {sample && <p className={f.sampleTag} role="note">{sample}</p>}

      <div role="tabpanel" id={`fl-panel-${sub}`} aria-labelledby={`fl-tab-${sub}`}>
        {sub === 'lista' && (
          <ListPane t={t} d={d} full={full} demo={demo} push={push} focusAlerts={focus === 'alertas'} onFocused={() => setFocus(null)} onOpen={onOpen} onAlert={onBell}
            onNewAlert={(sym) => setSheet({ prev: null, symbol: sym })} onCompare={(list) => setCmp(c => ({ list: compareFromList(list), n: (c?.n || 0) + 1 }))}
            onSay={say} onErr={sayErr} />
        )}
        {sub === 'descubrir' && <DiscoverPane t={t} full={full} demo={demo} watch={d.watch.list} onOpen={onOpen} onFollow={onFollow} onSay={say} />}
      </div>

      <AlertSheet open={!!sheet} onClose={() => setSheet(null)} prev={sheet?.prev || null} symbol={sheet?.symbol || ''}
        quoteOf={quoteOf} alerts={d.alerts.list} onSave={d.saveAlert} onSaved={onSaved} pushState={push.state}
        onToggle={(a) => { setSheet(null); acts.toggle(a) }}
        onDelete={(a) => { setSheet(null); acts.del(a) }}
        onPick={(a) => setSheet(cur => ({ prev: a, symbol: a?.symbol || cur?.symbol || '' }))} />

      <Sheet open={!!cmp} onClose={() => setCmp(null)} ariaLabel={t('fl.cmp.title')} maxWidth={640}>
        {cmp && (
          <div className={s.form}>
            <ComparePane key={cmp.n} t={t} demo={demo} full={full} initial={cmp.list} />
            <div className={s.actionsRow} style={{ justifyContent: 'flex-end' }}>
              <button type="button" className={s.btn} onClick={() => setCmp(null)}>{t('fl.cmp.close')}</button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}
