// src/pages/Investments/reglas/TusReglasHoy.jsx — "Tus reglas hoy", arriba de
// Inversiones › Resumen (propuesta del 25-nov-2026, §6, aprobada el 26-nov).
//
// Habla de la regla que define la persona (su escalera de Tus tramos y su
// condición de RSI), nunca califica el momento: tres estados neutros
// (cumple / cerca / lejos, rules.js), cada uno con ícono y palabra (no solo
// color), y el dato concreto de cada fila. Debajo, el mercado en hechos (SPY
// frente a sus medias de 50 y 200 días, VIX con la zona de Mercado) y los
// avisos de regla (ruleAlerts.js). Usa las historias de 1 año que Resumen ya
// pidió: sin pedidos nuevos.
import { useEffect, useMemo, useState } from 'react'
import { Bell, ChevronRight, Circle, CircleCheck, CircleDashed, CircleDot, Info, X } from 'lucide-react'
import { fmtDayMonth, fmtDecimal, fmtPct } from '../../../utils/index.js'
import { vixLevel } from '../../../utils/investHoy.js'
import { isNativeApp } from '../../../native/platform.js'
import { summarizeRules, marketFacts } from './rules.js'
import { readRule } from './rulePrefs.js'
import {
  anyAlert, browserStore, loadLedger, loadPrefs, memoryStore, newRuleHits, saveLedger, savePrefs,
  pushState as readPushState, setAll, showSystemNotice, systemChannel, toggleAsset, wantsAlert,
} from './ruleAlerts.js'
import { useReglasT } from './dict.js'
import s from './reglas.module.css'

// Zona del VIX con los nombres de Mercado (investMarket.vixZone: low · normal ·
// elevated · extreme); vixLevel de Resumen usa los mismos cortes y dice 'high'.
export const vixZoneOf = (v) => { const z = vixLevel(v); return z === 'high' ? 'elevated' : z }

const ICONS = { meets: CircleCheck, near: CircleDot, far: Circle, none: CircleDashed, loading: CircleDashed }

export function StatePill({ state, label }) {
  const Ic = ICONS[state] || CircleDashed
  return (
    <span className={s.pill} data-state={state}>
      <Ic size={14} strokeWidth={2} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

const rsiTxt = (v) => (v == null ? '—' : String(Math.round(v)))

/** Texto del dato de una fila (lo usa también el aria-label). */
export function factText(r, t) {
  const f = r.fact
  if (r.state === 'loading') return t('rul.fact.loading')
  if (!f) return t('rul.fact.none')
  if (f.kind === 'meets') return f.rsi != null ? t('rul.fact.meets', { n: f.n, rsi: rsiTxt(f.rsi) }) : t('rul.fact.meetsNoRsi', { n: f.n })
  if (f.kind === 'rsi') return f.rsi == null ? t('rul.fact.rsiNone', { n: f.n }) : t('rul.fact.rsi', { n: f.n, rsi: rsiTxt(f.rsi) })
  return t(r.state === 'near' ? 'rul.fact.near' : 'rul.fact.far', { n: f.n, p: fmtPct(f.dist, { decimals: 1 }) })
}

export function noticeText(n, rsiRule, t) {
  return t(rsiRule ? 'rul.notice.rsi' : 'rul.notice.plain', { t: n.label, n: n.n })
}

// El nombre de la zona del VIX es el mismo de Mercado (invest.mkt.vix.*): `t`
// de useLazyDict cae al diccionario de la app para las claves que no son rul.*.
function marketLine(m, t) {
  const spy = m.spy ? t(`rul.mkt.spy.${m.spy.pos}`) : null
  const vix = m.vix ? t('rul.mkt.vix', { v: fmtDecimal(m.vix.v, 1), zone: t(`invest.mkt.vix.${m.vix.zone}`) }) : null
  if (spy && vix) return t('rul.mkt.both', { spy, vix })
  if (spy) return t('rul.mkt.spyOnly', { spy })
  if (vix) return t('rul.mkt.vixOnly', { vix })
  return t('rul.mkt.none')
}

/**
 * items: [{ t, label, crypto, rows }] (rows undefined = cargando, null = falló)
 * spyRows: historia de SPY (o undefined / null); vix: número o null.
 * demo / sample: las preferencias de aviso quedan en memoria y no hay
 * notificación del sistema. rule: { ladder, rsiRule } (por defecto, la de Tus tramos).
 */
export default function TusReglasHoy({ items = [], spyRows, vix = null, demo = false, sample = false, rule = null, onSee, onRetry, pushState = null, native = null, store = null, now = null }) {
  const { t, ready } = useReglasT()
  const { ladder, rsiRule } = useMemo(() => rule || readRule(), [rule])
  const sum = useMemo(() => summarizeRules(items, { ladder, rsiRule }), [items, ladder, rsiRule])
  const mkt = useMemo(() => marketFacts(spyRows || null, vix, vixZoneOf), [spyRows, vix])
  const st = useMemo(() => store || (demo || sample ? memoryStore : browserStore()), [store, demo, sample])
  const [prefs, setPrefsState] = useState(() => loadPrefs(st))
  const [notices, setNotices] = useState([])
  const setPrefs = (p) => { setPrefsState(p); savePrefs(st, p) }
  const ps = pushState || (demo || sample ? 'demo' : readPushState())
  const isNative = native ?? isNativeApp()

  // Evaluación al abrir Resumen: cuando ya llegaron todas las historias.
  const hitKey = sum.loading ? '' : sum.rows.filter(r => r.state === 'meets').map(r => `${r.t}:${r.tramos.filter(x => x.state === 'today').map(x => x.n).join('.')}`).join(',')
  const prefsKey = `${prefs.all}:${prefs.ids.join('.')}`
  useEffect(() => {
    if (!hitKey || !anyAlert(prefs)) return
    const at = now ?? Date.now()
    const { notices: fresh, ledger } = newRuleHits(sum.rows, prefs, loadLedger(st), at)
    if (!fresh.length) return
    saveLedger(st, ledger)
    setNotices(prev => [...prev, ...fresh.filter(f => !prev.some(p => p.t === f.t && p.n === f.n))])
    if (systemChannel({ pushState: ps, native: isNative, now: at }).ok) {
      for (const n of fresh) showSystemNotice({ title: t('rul.notice.sysTitle', { t: n.label }), body: noticeText(n, rsiRule, t), tag: `invest-rule-${n.t}-${n.n}` })
    }
  }, [hitKey, prefsKey]) // eslint-disable-line react-hooks/exhaustive-deps -- las claves resumen lo que cambia

  if (!ready) return null
  const owned = sum.rows.length
  const chKey = ps === 'on' ? 'on' : ps === 'demo' ? 'demo' : ps === 'noLicense' ? 'noLicense' : ps === 'unsupported' ? 'unsupported' : 'off'

  let body
  if (!owned) body = <p className={s.text}>{t('rul.empty.noPositions')}</p>
  else if (sum.loading && !sum.read) body = <p className={s.muted} role="status">{t('rul.loading')}</p>
  else if (!sum.read) {
    const failed = items.some(i => i.rows === null) && items.every(i => i.rows === null)
    body = (
      <div className={s.stack}>
        <p className={s.text}>{failed ? t('rul.empty.failed') : t('rul.empty.noReadings')}</p>
        {failed && onRetry && <button type="button" className={s.btn} onClick={onRetry}>{t('rul.retry')}</button>}
      </div>
    )
  } else if (!sum.total) body = <p className={s.text}>{t('rul.empty.noTramos')}</p>
  else body = <p className={s.count}>{t(sum.met === 1 ? 'rul.countOne' : 'rul.countMany', { n: sum.met, m: sum.total })}</p>

  return (
    <section className={s.card} aria-labelledby="hoy-rules-title">
      <div className={s.head}>
        <h2 id="hoy-rules-title" className={s.title}>{t('rul.title')}</h2>
        {sum.date && <span className={s.date}>{t('rul.date', { d: fmtDayMonth(sum.date) })}</span>}
      </div>

      {notices.length > 0 && (
        <div className={s.notice} role="status" aria-label={t('rul.notice.label')}>
          <Bell size={16} strokeWidth={2} aria-hidden="true" />
          <ul className={s.noticeList}>
            {notices.map(n => <li key={`${n.t}:${n.n}`}>{noticeText(n, rsiRule, t)}</li>)}
          </ul>
          <button type="button" className={s.iconBtn} onClick={() => setNotices([])} aria-label={t('rul.notice.dismiss')}>
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      )}

      <div aria-live="polite">{body}</div>
      {owned > 0 && <p className={s.muted}>{t('rul.rule', { lad: t(`rul.lad.${ladder}`), rsi: t(rsiRule ? 'rul.rsiOn' : 'rul.rsiOff') })}</p>}

      {owned > 0 && (sum.read > 0 || sum.loading > 0) && (
        <ul className={s.list} aria-label={t('rul.list')}>
          {sum.rows.map(r => {
            const label = t(`rul.st.${r.state}`)
            const fact = factText(r, t)
            return (
              <li key={r.t} className={s.item}>
                <button type="button" className={s.row} onClick={onSee} aria-label={t('rul.row.aria', { t: r.label, state: label, fact })}>
                  <span className={s.tk}>{r.label}</span>
                  <span className={s.fact}>{fact}</span>
                  <StatePill state={r.state} label={label} />
                  <ChevronRight size={16} className={s.chev} aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {sum.none > 0 && sum.read > 0 && <p className={s.muted}>{t(sum.none === 1 ? 'rul.noneOne' : 'rul.noneMany', { n: sum.none })}</p>}
      {sample && sum.read > 0 && <p className={s.muted}>{t('rul.sample')}</p>}

      {owned > 0 && onSee && (
        <div className={s.links}>
          <button type="button" className={s.link} onClick={onSee}>{t('rul.see')}<ChevronRight size={14} aria-hidden="true" /></button>
        </div>
      )}

      <p className={s.market}>{marketLine(mkt, t)} <span className={s.muted}>{t('rul.mkt.note')}</span></p>

      {owned > 0 && (
        <div className={s.alerts} role="group" aria-labelledby="hoy-rules-al">
          <h3 id="hoy-rules-al" className={s.subTitle}>{t('rul.al.title')}</h3>
          <label className={s.check}>
            <input type="checkbox" checked={prefs.all} onChange={e => setPrefs(setAll(prefs, e.target.checked))} aria-describedby="hoy-rules-al-help" />
            <span>{t('rul.al.all')}</span>
          </label>
          <p id="hoy-rules-al-help" className={s.muted}>{t('rul.al.allHelp')}</p>
          <details className={s.pick}>
            <summary className={s.link}>{t('rul.al.pick')}</summary>
            <fieldset className={s.fieldset}>
              <legend className={s.muted}>{t('rul.al.pickLegend')}</legend>
              {sum.rows.map(r => (
                <label key={r.t} className={s.check}>
                  <input type="checkbox" checked={wantsAlert(prefs, r.t)} disabled={prefs.all}
                    onChange={e => setPrefs(toggleAsset(prefs, r.t, e.target.checked))} aria-label={t('rul.al.asset', { t: r.label })} />
                  <span>{r.label}</span>
                </label>
              ))}
            </fieldset>
          </details>
          <p className={s.muted}>{t('rul.al.how')} {t(`rul.al.ch.${chKey}`)} {t('rul.al.closed')}</p>
        </div>
      )}

      <p className={s.edu} role="note"><Info size={14} strokeWidth={2} aria-hidden="true" />{t('rul.edu')}</p>
    </section>
  )
}
