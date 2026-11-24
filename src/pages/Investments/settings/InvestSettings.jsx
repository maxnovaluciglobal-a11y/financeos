// src/pages/Investments/settings/InvestSettings.jsx — Ajustes › Inversiones (F7).
// Reúne en un lugar lo que Invest tenía en sus Ajustes, sin duplicar lógica:
//  · perfil de inversionista (useInvestAccess + ProfileSheet);
//  · regla de riesgo y capital (los valores de usePortfolioBook; se cambian
//    en Planificar, donde vive RuleCard);
//  · alertas: el mismo estado de avisos que PushOffer (usePushOffer) y un
//    enlace a Siguiendo › Alertas;
//  · tus datos: exportar con portfolio/exports.js (importar sigue en Portafolio);
//  · "Eliminar mis datos de Inversiones" (core/investErase.js);
//  · ayuda (help/InvestHelp.jsx, diferida) y privacidad.
// Se carga con lazy() desde Ajustes (Settings/InvestScreen.jsx): ni la
// pantalla ni sus textos pesan en la carga inicial.
import { Suspense, lazy, useId, useMemo, useRef, useState } from 'react'
import Sheet from '../../../components/ui/Sheet.jsx'
import { useApp } from '../../../context/AppContext.jsx'
import { useInvestAccess } from '../../../hooks/useInvestAccess.js'
import { moduleOn } from '../../../utils/modules.js'
import { queueFollow, queueInvestTab } from '../../../utils/investNav.js'
import { investData } from '../../../core/investData.js'
import { investAlerts } from '../../../core/investAlerts.js'
import { createInvestErase, eraseWordOk } from '../../../core/investErase.js'
import { InvestStringsGate } from '../i18n/investStrings.js'
import ProfileSheet from '../ProfileSheet.jsx'
import { usePortfolioBook } from '../portfolio/usePortfolioBook.js'
import { makeFmt } from '../portfolio/format.js'
import { usePT } from '../portfolio/text.js'
import { setTargetsValue } from '../portfolio/targetsStore.js'
import { backupFile, download, operationsFile, positionsFile } from '../portfolio/exports.js'
import { notifPermission, usePushOffer } from '../follow/shared.js'
import { ruleDecimals } from '../planificar/Calculator.jsx'
import { useInvSetT } from './dict.js'
import { SUPPORT_EMAIL, eraseOutcome, profileAnswers, profileSummary, pushView } from './model.js'
import s from './investSettings.module.css'

const InvestHelp = lazy(() => import('../help/InvestHelp.jsx'))
const USD = { ccy: 'USD', rate: 1, fallback: false, missing: false }

export default function InvestSettings(props) {
  return <InvestStringsGate><Screen {...props} /></InvestStringsGate>
}

// Bloque con título (la etiqueta del buscador de Ajustes) y data-setting para
// que el buscador pueda saltar hasta él.
function Block({ id, title, children, danger = false }) {
  const hid = `inv-set-${id}`
  return (
    <section data-setting={id} className={s.block} aria-labelledby={hid}>
      <h3 id={hid} className={s.blockTitle} data-tone={danger ? 'danger' : undefined}>{title}</h3>
      {children}
    </section>
  )
}

function Screen({ setPage, onOpenFeatures, isDemo = false }) {
  const { t, ready, lang } = useInvSetT()
  const app = useApp() || {}
  const settings = app.settings || {}
  const demo = !!settings.isDemo || isDemo
  const on = moduleOn(settings, 'investments') || demo
  const access = useInvestAccess()
  const [help, setHelp] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const helpBtn = useRef(null)

  const go = (fn) => { fn(); setPage?.('investments') }

  if (!ready) return <p className={s.note} role="status">{t('is.loading')}</p>
  if (!on) {
    return (
      <div className={s.wrap}>
        <p className={s.note}>{t('is.off')}</p>
        {onOpenFeatures && <div className={s.actions}><button type="button" className={s.btn} onClick={onOpenFeatures}>{t('is.off.go')}</button></div>}
      </div>
    )
  }

  const status = access.status
  const hasAccount = demo || status === 'granted' || status === 'needs-profile'
  return (
    <div className={s.wrap}>
      {demo && <p className={s.notice} role="note">{t('is.demo')}</p>}
      {status === 'loading' && !demo && <p className={s.note} role="status">{t('is.loading')}</p>}
      {status === 'no-account' && !demo && <p className={s.notice} role="note">{t('is.noAccount')}</p>}

      {hasAccount && <ProfileBlock t={t} lang={lang} demo={demo} access={access} />}
      {(status === 'granted' || demo)
        ? <BookBlocks key={epoch} t={t} demo={demo} go={go} alerts={<AlertsBlock t={t} demo={demo} go={go} />} />
        : hasAccount && (
          <Block id="invRule" title={t('settings.inv.rule')}>
            <p className={s.note}>{t('is.rule.locked')}</p>
          </Block>
        )}
      {status === 'needs-profile' && !demo && <AlertsBlock t={t} demo={demo} go={go} />}
      {hasAccount && <EraseBlock t={t} demo={demo} onErased={() => setEpoch(n => n + 1)} />}

      <Block id="invHelp" title={t('settings.inv.help')}>
        <p className={s.note}>{t('is.help.intro')}</p>
        <div className={s.actions}>
          <button ref={helpBtn} type="button" className={s.btn} aria-haspopup="dialog" onClick={() => setHelp(true)}>{t('is.help.open')}</button>
          <button type="button" className={s.btnLink} onClick={() => setPage?.('privacy')}>{t('is.help.privacy')}</button>
        </div>
      </Block>
      {help && (
        <Suspense fallback={null}>
          <InvestHelp open={help} onClose={() => { setHelp(false); helpBtn.current?.focus() }} />
        </Suspense>
      )}
      <p className={s.foot} role="note">{t('is.foot')}</p>
    </div>
  )
}

function ProfileBlock({ t, lang, demo, access }) {
  const app = useApp() || {}
  const [open, setOpen] = useState(false)
  const sum = profileSummary(access.profile)
  const date = sum.ackAt ? new Date(sum.ackAt).toLocaleDateString(lang || 'es', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  async function save(answers) {
    await access.saveProfile(answers)
    setOpen(false)
    app.showToast?.(t('is.prof.saved'))
  }
  return (
    <Block id="invProfile" title={t('settings.inv.profile')}>
      <p className={s.note}>{t('is.prof.intro')}</p>
      {demo ? <p className={s.note}>{t('is.prof.demo')}</p> : sum.complete ? (
        <>
          <dl className={s.facts}>
            {sum.answers.map(([id, v]) => (
              <div key={id} className={s.fact}>
                <dt>{t(`is.prof.${id}`)}</dt>
                <dd>{t(`invest.profile.q.${id}.${v}`)}</dd>
              </div>
            ))}
          </dl>
          <p className={s.note}>{t('is.prof.done', { date })}</p>
        </>
      ) : <p className={s.note}>{t('is.prof.missing')}</p>}
      {!demo && (
        <div className={s.actions}>
          <button type="button" className={s.btn} aria-haspopup="dialog" onClick={() => setOpen(true)}>
            {t(sum.complete ? 'is.prof.edit' : 'is.prof.start')}
          </button>
        </div>
      )}
      {open && (
        <ProfileSheet open={open} onClose={() => setOpen(false)} onSave={save}
          initial={profileAnswers(access.profile)} saveLabel={t('is.prof.save')} />
      )}
    </Block>
  )
}

// Regla, capital y exportar: usan los datos del portafolio (una sola carga).
// `alerts` va entre los dos, en el orden de la pantalla.
function BookBlocks({ t, demo, go, alerts = null }) {
  const pb = usePortfolioBook({ demo })
  const { t: tp } = usePT()
  const app = useApp() || {}
  const settings = app.settings || {}
  const fmt = useMemo(() => makeFmt({ disp: USD, currency: settings.currency, language: settings.language }), [settings.currency, settings.language])
  const pct = (v) => fmt.pct(v / 100, { decimals: ruleDecimals(v) })
  const [msg, setMsg] = useState(null)
  const ready = pb.phase === 'ready' || pb.phase === 'refreshing'

  function done(f) { download(f); setMsg({ text: t('is.data.exported', { name: f.name }) }) }
  function exportOps() {
    if (!pb.ops.length) { setMsg({ text: t('is.data.noOps') }); return }
    done(operationsFile(pb, tp))
  }
  // Sin la lista de seguimiento no se descarga: la copia parecería completa.
  async function exportBackup() {
    const f = await backupFile({ pb, demo })
    if (f.error) { setMsg({ err: true, text: t('is.data.backupErr') }); return }
    done(f)
  }

  return (
    <>
      <Block id="invRule" title={t('settings.inv.rule')}>
        <p className={s.note}>{t('is.rule.intro')}</p>
        {pb.phase === 'error' ? (
          <div className={s.actions}>
            <p className={s.error} role="alert">{t('is.rule.err')}</p>
            <button type="button" className={s.btn} onClick={pb.reload}>{t('is.retry')}</button>
          </div>
        ) : !ready ? <p className={s.note} role="status">{t('is.loading')}</p> : (
          <dl className={s.facts}>
            <div className={s.fact}><dt>{t('is.rule.risk')}</dt><dd>{pct(pb.rule.risk)}</dd></div>
            <div className={s.fact}><dt>{t('is.rule.limit')}</dt><dd>{pct(pb.rule.limit)}</dd></div>
            <div className={s.fact}><dt>{t('is.rule.capital')}</dt><dd>{pb.capital > 0 ? fmt.money(pb.capital) : t('is.rule.noCapital')}</dd></div>
          </dl>
        )}
        <div className={s.actions}>
          <button type="button" className={s.btn} onClick={() => go(() => queueInvestTab('planificar'))}>{t('is.rule.change')}</button>
        </div>
      </Block>

      {alerts}

      <Block id="invData" title={t('settings.inv.data')}>
        <p className={s.note}>{t('is.data.intro')}</p>
        {pb.phase === 'error' && <p className={s.error} role="alert">{t('is.data.err')}</p>}
        <div className={s.actions}>
          <button type="button" className={s.btn} disabled={!ready} onClick={() => done(positionsFile(pb, tp))}>{t('is.data.positions')}</button>
          <button type="button" className={s.btn} disabled={!ready} onClick={exportOps}>{t('is.data.ops')}</button>
          <button type="button" className={s.btn} disabled={!ready} onClick={exportBackup}>{t('is.data.backup')}</button>
        </div>
        <p className={s.note} role="status">{msg && !msg.err ? msg.text : ''}</p>
        {msg?.err && <p className={s.error} role="alert">{msg.text}</p>}
        <p className={s.note}>{t('is.data.importNote')}</p>
        <div className={s.actions}>
          <button type="button" className={s.btnLink} onClick={() => go(() => queueInvestTab('portafolio', 'posiciones'))}>{t('is.data.import')}</button>
        </div>
      </Block>
    </>
  )
}

function AlertsBlock({ t, demo, go }) {
  const push = usePushOffer(demo)
  const [msg, setMsg] = useState(null)
  const view = pushView(push.state, notifPermission())
  async function enable() {
    const r = await push.enable()
    setMsg(r.ok ? { tone: 'ok', text: t('is.al.ok') } : r.error === 'permission_denied' || r.error === 'failed' ? { tone: 'err', text: t(`is.al.err.${r.error}`) } : null)
  }
  return (
    <Block id="invAlerts" title={t('settings.inv.alerts')}>
      <p className={s.note}>{t('is.al.intro')}</p>
      <dl className={s.facts}>
        <div className={s.fact}><dt>{t('is.al.state')}</dt><dd data-push={view}>{t(`is.al.s.${view}`)}</dd></div>
      </dl>
      {view !== 'on' && view !== 'off' && <p className={s.note}>{t(`is.al.${view}`)}</p>}
      <div className={s.actions}>
        {view === 'off' && (
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={enable} disabled={push.busy} aria-busy={push.busy || undefined}>
            {push.busy ? t('is.al.busy') : t('is.al.enable')}
          </button>
        )}
        <button type="button" className={s.btnLink} onClick={() => go(() => queueFollow({ sub: 'alertas' }))}>{t('is.al.go')}</button>
      </div>
      {msg && <p className={msg.tone === 'ok' ? s.ok : s.error} role={msg.tone === 'ok' ? 'status' : 'alert'}>{msg.text}</p>}
    </Block>
  )
}

const eraser = createInvestErase({
  resets: [() => investData.clear(), () => investAlerts.clear(), () => setTargetsValue(null)],
})

export function EraseBlock({ t, demo, erase = eraser.eraseAll, onErased = null }) {
  const app = useApp() || {}
  const id = useId()
  const [open, setOpen] = useState(false)
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  const [mismatch, setMismatch] = useState(false)
  const btnRef = useRef(null)
  const inputRef = useRef(null)
  const local = t('is.del.word')
  const items = ['holdings', 'ops', 'watch', 'alerts', 'plans', 'local']

  function close() { if (busy) return; setOpen(false); setWord(''); setRes(null); setMismatch(false); btnRef.current?.focus() }
  async function confirm(e) {
    e.preventDefault()
    if (!eraseWordOk(word, local)) { setMismatch(true); inputRef.current?.focus(); return }
    if (demo) { setRes({ kind: 'demo' }); return }
    setBusy(true); setRes(null)
    let out
    try { out = eraseOutcome(await erase()) } catch { out = eraseOutcome({ ok: false, error: 'network' }) }
    setBusy(false)
    if (out.kind === 'ok') {
      setOpen(false); setWord('')
      app.showToast?.(t('is.del.done'))
      onErased?.()
      btnRef.current?.focus()
      return
    }
    setRes(out)
  }
  const list = (steps) => steps.map(st => t(`is.del.step.${st}`)).join(', ')

  return (
    <Block id="invDelete" title={t('settings.inv.erase')} danger>
      <p className={s.note}>{t('is.del.intro')}</p>
      <div className={s.actions}>
        <button ref={btnRef} type="button" className={`${s.btn} ${s.btnDanger}`} aria-haspopup="dialog" onClick={() => setOpen(true)}>{t('is.del.btn')}</button>
      </div>
      <Sheet open={open} onClose={close} ariaLabel={t('is.del.title')} initialFocusRef={inputRef}>
        <form className={s.sheet} onSubmit={confirm} noValidate>
          <h2 className={s.sheetTitle}>{t('is.del.title')}</h2>
          <p className={s.note}>{t('is.del.what')}</p>
          <ul className={s.list}>{items.map(k => <li key={k}>{t(`is.del.i.${k}`)}</li>)}</ul>
          <p className={s.note}>{t('is.del.keep')}</p>
          <p className={s.warn} role="note">{t('is.del.irreversible')}</p>
          <label className={s.field} htmlFor={`${id}-word`}>
            <span className={s.fieldLabel}>{t('is.del.type', { word: local })}</span>
            <input id={`${id}-word`} ref={inputRef} className={s.input} value={word} autoComplete="off" autoCapitalize="characters" spellCheck={false}
              onChange={e => { setWord(e.target.value); setMismatch(false) }}
              aria-invalid={mismatch || undefined} aria-describedby={mismatch ? `${id}-err` : undefined} />
          </label>
          {mismatch && <p id={`${id}-err`} className={s.error} role="alert">{t('is.del.mismatch', { word: local })}</p>}
          {res && (
            <div className={s.result} data-tone={res.kind === 'demo' ? 'info' : undefined} role="alert">
              {res.kind === 'demo' && <p>{t('is.del.demo')}</p>}
              {res.kind === 'nothing' && <p>{t(res.errorKey)}</p>}
              {res.kind === 'partial' && (
                <>
                  <p>{t(res.unsure.length && !res.done.length ? 'is.del.unsureHead' : 'is.del.partial')}</p>
                  {res.done.length > 0 && <p>{t('is.del.partialDone', { list: list(res.done) })}</p>}
                  {res.unsure.length > 0 && <p>{t('is.del.unsure', { list: list(res.unsure) })}</p>}
                  {res.failed.length > 0 && <p>{t('is.del.partialFail', { list: list(res.failed) })}</p>}
                  {res.gap.length > 0 && <p>{t('is.del.gap', { list: list(res.gap), email: SUPPORT_EMAIL })}</p>}
                </>
              )}
            </div>
          )}
          <div className={s.actions}>
            <button type="submit" className={`${s.btn} ${s.btnDangerSolid}`} disabled={busy} aria-busy={busy || undefined}>
              {busy ? t('is.del.busy') : res && res.kind !== 'demo' ? t('is.retry') : t('is.del.confirm')}
            </button>
            <button type="button" className={s.btn} onClick={close} disabled={busy}>{t('is.del.cancel')}</button>
          </div>
        </form>
      </Sheet>
    </Block>
  )
}
