// src/components/lock/AppLock.jsx — pantalla de bloqueo (T14).
//
// Se monta EN LUGAR de la app (ver AppLockGate.jsx): mientras está bloqueada
// no existe nada de la app en el DOM — ni montos, ni la TabBar, ni Sheets —,
// no es un overlay encima. Por eso tampoco usa AppContext: el idioma sale del
// atributo `lang` del documento (lo fija el gate al arrancar y AppProvider
// después) y los datos de "Olvidé mi PIN" se tocan con core/db directo.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Delete, Fingerprint, ArrowLeft } from 'lucide-react'
import Logo from '../Logo.jsx'
import { useTFor } from '../../i18n/useT.js'
import {
  verifyPin, hashPin, verifyBiometric, registerFailure, remainingLockoutMs,
  FREE_ATTEMPTS, PBKDF2_ITERATIONS, PIN_MAX_LENGTH,
} from '../../core/appLock.js'
import { getAttempts, saveAttempts, resetAttempts, updateLockConfig } from '../../core/appLockStore.js'
import { wipeLocalDevice, importAllData } from '../../core/db/index.js'
import { signOutAuth } from '../../core/auth.js'
import { validateBackupFile } from '../backup/BackupManager.jsx'
import s from './appLock.module.css'

const LANGS = ['es', 'en', 'pt', 'de']
function docLang() {
  const l = typeof document !== 'undefined' ? document.documentElement.lang : 'es'
  return LANGS.includes(l) ? l : 'es'
}

function fmtWait(ms) {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const sec = String(total % 60).padStart(2, '0')
  return `${m}:${sec}`
}

export default function AppLock({ config, onUnlocked }) {
  const { t } = useTFor(docLang())
  const [view, setView] = useState('pin') // pin | forgot | confirmWipe | confirmRestore | restoreFailed
  return view === 'pin'
    ? <PinView t={t} config={config} onUnlocked={onUnlocked} onForgot={() => setView('forgot')} />
    : <ForgotFlow t={t} view={view} setView={setView} />
}

// ─── PIN + biometría ──────────────────────────────────────────────────────────
function PinView({ t, config, onUnlocked, onForgot }) {
  const pinLen = Math.min(Math.max(config?.pin?.length || PIN_MAX_LENGTH, 4), PIN_MAX_LENGTH)
  const hasBio = !!config?.biometric?.credentialId
  const [entry, setEntry] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)        // { text, error }
  const [shake, setShake] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [attempts, setAttempts] = useState({ count: 0, lockedUntil: 0 })
  const [now, setNow] = useState(Date.now())
  const titleRef = useRef(null)

  const waitMs = remainingLockoutMs(attempts, now)
  const lockedOut = waitMs > 0

  useEffect(() => {
    getAttempts().then(a => {
      setAttempts(a)
      const w = remainingLockoutMs(a, Date.now())
      if (w > 0) setAnnounce(t('lock.screen.wait', { time: fmtWait(w) }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { titleRef.current?.focus() }, [])

  // Cuenta regresiva de la espera — un tick por segundo solo mientras dura.
  useEffect(() => {
    if (!lockedOut) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [lockedOut])

  const submit = useCallback(async (pin) => {
    setBusy(true)
    setMsg({ text: t('lock.screen.checking'), error: false })
    let ok = false
    try { ok = await verifyPin(pin, config.pin) } catch { ok = false }
    if (ok) {
      await resetAttempts().catch(() => {})
      // Re-hash transparente si el registro es de antes de subir las iteraciones.
      if (config.pin.iterations < PBKDF2_ITERATIONS) {
        try { await updateLockConfig({ pin: await hashPin(pin) }) } catch {}
      }
      onUnlocked()
      return
    }
    const next = registerFailure(await getAttempts(), Date.now())
    await saveAttempts(next).catch(() => {})
    setAttempts(next)
    setNow(Date.now())
    entryRef.current = ''
    setEntry('')
    setBusy(false)
    setShake(true)
    const left = FREE_ATTEMPTS - next.count
    const text = left > 0 ? t('lock.screen.wrong', { n: left }) : t('lock.screen.wrongPlain')
    setMsg({ text, error: true })
    const wait = remainingLockoutMs(next, Date.now())
    setAnnounce(wait > 0 ? `${text} ${t('lock.screen.wait', { time: fmtWait(wait) })}` : text)
  }, [config, onUnlocked, t])

  // entryRef: el valor actual sin depender de un updater de setState (en
  // StrictMode un updater puede correr dos veces y verificaríamos el PIN dos
  // veces, contando dos fallos).
  const entryRef = useRef('')
  const press = useCallback((k) => {
    if (busy || lockedOut) return
    const cur = entryRef.current
    if (k === 'back') { entryRef.current = cur.slice(0, -1); setEntry(entryRef.current); return }
    if (cur.length >= pinLen) return
    setMsg(null)
    const next = cur + k
    entryRef.current = next
    setEntry(next)
    if (next.length === pinLen) submit(next)
  }, [busy, lockedOut, pinLen, submit])

  // Teclado físico: dígitos, Backspace.
  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key) }
      else if (e.key === 'Backspace') { e.preventDefault(); press('back') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press])

  async function unlockBio() {
    if (busy) return
    setBusy(true)
    setMsg(null)
    let ok = false
    try { ok = await verifyBiometric(config.biometric.credentialId) } catch { ok = false }
    if (ok) {
      await resetAttempts().catch(() => {})
      onUnlocked()
      return
    }
    setBusy(false)
    setMsg({ text: t('lock.screen.bioFail'), error: true })
    setAnnounce(t('lock.screen.bioFail'))
  }

  const statusText = lockedOut ? t('lock.screen.wait', { time: fmtWait(waitMs) }) : msg?.text
  const statusError = lockedOut || msg?.error
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'back']

  return (
    <main className={s.screen}>
      <div className={s.col}>
        <Logo size={30} style={{ marginBottom: 28 }} />
        <h1 ref={titleRef} tabIndex={-1} className={s.title}>{t('lock.screen.title')}</h1>
        <p className={s.sub}>{t('lock.screen.sub')}</p>

        <div
          role="img"
          aria-label={t('lock.screen.pinProgress', { n: entry.length, total: pinLen })}
          className={[s.dots, statusError && !lockedOut ? s.dotsError : '', shake ? s.shake : ''].join(' ')}
          onAnimationEnd={() => setShake(false)}
        >
          {Array.from({ length: pinLen }, (_, i) => (
            <span key={i} className={[s.dot, i < entry.length ? s.dotOn : ''].join(' ')} />
          ))}
        </div>

        {/* Visible: puede ser una cuenta regresiva que cambia cada segundo, así
            que va oculta al lector de pantalla; lo que se anuncia (una vez por
            evento) está en la región viva de abajo. */}
        <div aria-hidden="true" className={[s.status, statusError ? s.statusError : ''].join(' ')}>
          {statusText}
        </div>
        <div role="alert" aria-live="assertive" aria-atomic="true" className={s.srOnly}>{announce}</div>

        {hasBio && (
          <button type="button" className={`fos-btn-primary ${s.bioBtn}`} onClick={unlockBio} disabled={busy}>
            <Fingerprint size={20} strokeWidth={1.7} aria-hidden="true" />
            {t('lock.screen.unlockBio')}
          </button>
        )}

        <div role="group" aria-label={t('lock.screen.keypad')} className={s.pad}>
          {keys.map((k, i) => k === null
            ? <span key={i} className={s.keySpacer} aria-hidden="true" />
            : (
              <button
                key={k}
                type="button"
                className={[s.key, k === 'back' ? s.keyQuiet : ''].join(' ')}
                onClick={() => press(k)}
                disabled={busy || lockedOut || (k === 'back' && !entry)}
                aria-label={k === 'back' ? t('lock.screen.backspace') : k}
              >
                {k === 'back' ? <Delete size={22} strokeWidth={1.7} aria-hidden="true" /> : k}
              </button>
            ))}
        </div>

        <button type="button" className={`fos-link ${s.forgot}`} onClick={onForgot}>
          {t('lock.screen.forgot')}
        </button>
      </div>
    </main>
  )
}

// ─── Olvidé mi PIN ────────────────────────────────────────────────────────────
// Dos salidas, las dos borran lo local (incluido el PIN) y cierran la sesión;
// no existe recuperación por servidor (privacy-first). Ninguna deja la app
// inutilizable: si algo falla después de borrar, el bloqueo ya no existe y
// "Empezar de cero" recarga a una app vacía.
function ForgotFlow({ t, view, setView }) {
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [backup, setBackup] = useState(null) // { name, data, count, date }
  const fileRef = useRef(null)
  const headRef = useRef(null)
  const lang = docLang()

  useEffect(() => { headRef.current?.focus(); setAck(false) }, [view])

  async function finish() {
    try { await signOutAuth() } catch {}
    window.location.reload()
  }

  async function doWipe() {
    setBusy(true); setError(null)
    try {
      await wipeLocalDevice()
    } catch {
      setBusy(false); setError(t('lock.forgot.wipeFailed')); return
    }
    await finish()
  }

  async function doRestore() {
    if (!backup) return
    setBusy(true); setError(null)
    try {
      await wipeLocalDevice()
    } catch {
      setBusy(false); setError(t('lock.forgot.wipeFailed')); return
    }
    try {
      await importAllData(backup.data)
    } catch {
      setBusy(false); setView('restoreFailed'); return
    }
    await finish()
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    let data
    try { data = JSON.parse(await file.text()) } catch { setError(t('lock.forgot.invalidFile')); return }
    const { valid, errors } = validateBackupFile(data, t)
    if (!valid) {
      // "No es un respaldo"/"formato" ya los dice invalidFile; el resto (demo,
      // versión, sección rota) agrega información útil.
      const generic = [t('backup.err.notBackup'), t('backup.err.format')]
      const extra = errors.filter(m => !generic.includes(m))
      setError([t('lock.forgot.invalidFile'), ...extra].join(' '))
      return
    }
    const count = ['incomes', 'expenses', 'budgets', 'debts', 'goals', 'subscriptions']
      .reduce((n, k) => n + (Array.isArray(data[k]) ? data[k].length : 0), 0)
    const created = data._meta?.createdAt || data.exportedAt
    let date = '—'
    try { if (created) date = new Date(created).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' }) } catch {}
    setBackup({ name: file.name, data, count, date })
    setView('confirmRestore')
  }

  const fileInput = (
    <input ref={fileRef} type="file" accept=".json,application/json" onChange={onFile}
      className={s.srOnly} tabIndex={-1} aria-hidden="true" />
  )
  const errorBox = error && <div role="alert" className={s.alert}>{error}</div>
  const backBtn = (to) => (
    <button type="button" className="fos-link" onClick={() => { setError(null); setView(to) }} disabled={busy}
      style={{ alignSelf: 'flex-start' }}>
      <ArrowLeft size={16} strokeWidth={1.7} aria-hidden="true" />
      {to === 'pin' ? t('lock.forgot.back') : t('lock.forgot.backOptions')}
    </button>
  )

  if (view === 'forgot') {
    return (
      <main className={s.screen}>
        <div className={s.panel}>
          {backBtn('pin')}
          <div className={s.panelHead}>
            <h1 ref={headRef} tabIndex={-1} className={s.panelTitle}>{t('lock.forgot.title')}</h1>
            <p className={s.body}>{t('lock.forgot.body')}</p>
          </div>
          {errorBox}
          <section className={s.option} aria-labelledby="lock-opt-restore">
            <h2 id="lock-opt-restore" className={s.optionTitle}>{t('lock.forgot.restoreTitle')}</h2>
            <p className={s.body}>{t('lock.forgot.restoreBody')}</p>
            <button type="button" className="fos-btn-secondary" onClick={() => fileRef.current?.click()}>
              {t('lock.forgot.restoreBtn')}
            </button>
            {fileInput}
          </section>
          <section className={s.option} aria-labelledby="lock-opt-wipe">
            <h2 id="lock-opt-wipe" className={s.optionTitle}>{t('lock.forgot.wipeTitle')}</h2>
            <p className={s.body}>{t('lock.forgot.wipeBody')}</p>
            <button type="button" className="fos-btn-secondary" onClick={() => { setError(null); setView('confirmWipe') }}>
              {t('lock.forgot.wipeBtn')}
            </button>
          </section>
          <p className={s.note}>{t('lock.forgot.signoutNote')}</p>
        </div>
      </main>
    )
  }

  if (view === 'confirmWipe' || view === 'confirmRestore') {
    const isRestore = view === 'confirmRestore'
    return (
      <main className={s.screen}>
        <div className={s.panel}>
          {backBtn('forgot')}
          <div className={s.panelHead}>
            <h1 ref={headRef} tabIndex={-1} className={s.panelTitle}>
              {isRestore ? t('lock.forgot.confirmRestoreTitle') : t('lock.forgot.confirmWipeTitle')}
            </h1>
            <p className={s.body}>
              {isRestore
                ? t('lock.forgot.confirmRestoreBody', { file: backup?.name || '', date: backup?.date || '—', count: backup?.count ?? 0 })
                : t('lock.forgot.confirmWipeBody')}
            </p>
          </div>
          <p className={s.note}>{t('lock.forgot.signoutShort')}</p>
          <label className={s.ack}>
            <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} disabled={busy} />
            <span>{isRestore ? t('lock.forgot.ackRestore') : t('lock.forgot.ack')}</span>
          </label>
          {errorBox}
          <div className={s.actions}>
            <button type="button" className={s.dangerBtn} disabled={!ack || busy}
              onClick={isRestore ? doRestore : doWipe} aria-busy={busy || undefined}>
              {busy ? t('lock.forgot.working') : isRestore ? t('lock.forgot.confirmRestoreBtn') : t('lock.forgot.confirmWipeBtn')}
            </button>
            <button type="button" className="fos-btn-secondary" onClick={() => setView('forgot')} disabled={busy}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </main>
    )
  }

  // restoreFailed: lo local ya se borró (y con eso el PIN). Dos salidas útiles.
  return (
    <main className={s.screen}>
      <div className={s.panel}>
        <div className={s.panelHead}>
          <h1 ref={headRef} tabIndex={-1} className={s.panelTitle}>{t('lock.forgot.restoreTitle')}</h1>
          <div role="alert" className={s.alert}>{t('lock.forgot.restoreFailed')}</div>
        </div>
        {errorBox}
        <div className={s.actions}>
          <button type="button" className="fos-btn-secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            {t('lock.forgot.otherFile')}
          </button>
          {fileInput}
          <button type="button" className="fos-btn-primary" onClick={finish} disabled={busy}>
            {t('lock.forgot.startEmpty')}
          </button>
        </div>
      </div>
    </main>
  )
}
