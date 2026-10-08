// src/pages/Settings/SecuritySection.jsx — tarjeta "Seguridad" de Ajustes (T14).
//
// Bloquear al abrir (PIN obligatorio, biometría opcional), tiempo de
// auto-bloqueo, cambiar PIN, bloquear ahora y desactivar (pide el PIN actual).
// Todo inline dentro de la tarjeta, sin modales. No se muestra en modo demo
// (useAppLock() es null fuera de AppLockGate).
import { useEffect, useId, useRef, useState } from 'react'
import { Fingerprint } from 'lucide-react'
import { Card, CardHeader, Btn } from '../../components/ui/index.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { useAppLock } from '../../components/lock/AppLockGate.jsx'
import {
  isValidPin, hashPin, verifyPin, biometricsAvailable, createBiometricCredential,
  LOCK_TIMEOUTS_MIN, DEFAULT_TIMEOUT_MIN, PIN_MAX_LENGTH,
} from '../../core/appLock.js'
import { saveLockConfig, updateLockConfig, disableLock, resetAttempts } from '../../core/appLockStore.js'

const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '0.5px solid var(--brd)' }
const lbl = { fontSize: 14, fontWeight: 500, color: 'var(--tx)' }
const sub = { fontSize: 12, color: 'var(--tm)', lineHeight: 1.55, marginTop: 3 }

export default function SecuritySection() {
  const lock = useAppLock()
  const isDemo = typeof window !== 'undefined' && window.location.search.includes('demo=true')
  if (!lock || isDemo) return null
  return <SecurityCard lock={lock} />
}

function SecurityCard({ lock }) {
  const { t } = useT()
  const { showToast } = useApp()
  const cfg = lock.config
  const enabled = !!cfg
  const [bioAvail, setBioAvail] = useState(false)
  // flow: null | 'setup' | 'change' | 'disable' | 'bio'
  const [flow, setFlow] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { biometricsAvailable().then(setBioAvail) }, [])

  async function run(fn, okMsg) {
    setBusy(true)
    try {
      await fn()
      await lock.refresh()
      setFlow(null)
      if (okMsg) showToast(okMsg, 'ok')
    } catch {
      showToast(t('lock.toast.error'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function setTimeoutMin(min) {
    if (!enabled || cfg.timeoutMin === min) return
    await run(() => updateLockConfig({ timeoutMin: min }))
  }

  async function disableBio() {
    await run(() => updateLockConfig({ biometric: null }), t('lock.toast.bioOff'))
  }

  return (
    <Card>
      <CardHeader title={t('lock.settings.title')} />

      <div style={{ ...row, borderBottom: enabled || flow ? row.borderBottom : 'none', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={lbl} id="lock-toggle-label">{t('lock.settings.toggle')}</div>
          <div style={sub}>{t('lock.settings.desc')}</div>
        </div>
        <Switch
          checked={enabled}
          labelledBy="lock-toggle-label"
          disabled={busy || (flow && flow !== 'setup' && flow !== 'disable')}
          onChange={() => setFlow(f => (f ? null : enabled ? 'disable' : 'setup'))}
        />
      </div>

      {flow === 'setup' && (
        <SetupFlow t={t} bioAvail={bioAvail} busy={busy}
          onCancel={() => setFlow(null)}
          onDone={(pin, biometric) => run(async () => {
            await saveLockConfig({ pin, biometric, timeoutMin: DEFAULT_TIMEOUT_MIN })
            await resetAttempts()
          }, t('lock.toast.enabled'))}
        />
      )}

      {flow === 'disable' && (
        <CurrentPinStep t={t} pinRecord={cfg.pin} busy={busy}
          submitLabel={t('lock.setup.confirmDisable')} danger
          onCancel={() => setFlow(null)}
          onOk={() => run(disableLock, t('lock.toast.disabled'))}
        />
      )}

      {enabled && !flow && (
        <>
          <div style={{ ...row, flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <div>
              <div style={lbl} id="lock-timeout-label">{t('lock.settings.timeout')}</div>
              <div style={sub}>{t('lock.settings.timeoutSub')}</div>
            </div>
            <div role="group" aria-labelledby="lock-timeout-label" style={{ display: 'flex', gap: 6 }}>
              {LOCK_TIMEOUTS_MIN.map(m => (
                <button key={m} type="button" className="fos-chip fos-chip--tall" style={{ flex: 1 }}
                  aria-pressed={cfg.timeoutMin === m} disabled={busy} onClick={() => setTimeoutMin(m)}>
                  <span className="num">{t('lock.settings.minutes', { n: m })}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ ...row, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Fingerprint size={16} strokeWidth={1.7} aria-hidden="true" />{t('lock.settings.bio')}
              </div>
              <div style={sub}>{bioAvail || cfg.biometric ? t('lock.settings.bioDesc') : t('lock.settings.bioUnavailable')}</div>
            </div>
            {cfg.biometric
              ? <Btn variant="ghost" size="sm" onClick={disableBio} disabled={busy} style={{ flexShrink: 0 }}>{t('lock.settings.disableBio')}</Btn>
              : bioAvail && <Btn variant="primary" size="sm" onClick={() => setFlow('bio')} disabled={busy} style={{ flexShrink: 0 }}>{t('lock.settings.enable')}</Btn>}
          </div>

          <div style={{ ...row, borderBottom: 'none', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 8 }}>
            <Btn variant="ghost" size="sm" onClick={() => setFlow('change')} disabled={busy}>{t('lock.settings.changePin')}</Btn>
            <Btn variant="ghost" size="sm" onClick={lock.lockNow} disabled={busy}>{t('lock.settings.lockNow')}</Btn>
          </div>
        </>
      )}

      {flow === 'change' && (
        <ChangeFlow t={t} pinRecord={cfg.pin} busy={busy}
          onCancel={() => setFlow(null)}
          onDone={(pin) => run(async () => { await updateLockConfig({ pin }); await resetAttempts() }, t('lock.toast.pinChanged'))}
        />
      )}

      {flow === 'bio' && (
        <CurrentPinStep t={t} pinRecord={cfg.pin} busy={busy}
          submitLabel={t('lock.setup.bioYes')}
          onCancel={() => setFlow(null)}
          onOk={async () => {
            setBusy(true)
            let cred = null
            try { cred = await createBiometricCredential() } catch { cred = null }
            setBusy(false)
            if (!cred) { showToast(t('lock.settings.bioFailed'), 'error'); setFlow(null); return }
            await run(() => updateLockConfig({ biometric: cred }), t('lock.toast.bioOn'))
          }}
        />
      )}
    </Card>
  )
}

// Interruptor con área táctil de 44px (el dibujo es 44×24, como los de Ajustes).
function Switch({ checked, onChange, labelledBy, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-labelledby={labelledBy}
      onClick={onChange} disabled={disabled}
      style={{ flexShrink: 0, minWidth: 44, minHeight: 44, padding: '10px 0', background: 'none', border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .5 : 1, display: 'inline-flex', alignItems: 'center' }}>
      <span aria-hidden="true" style={{ width: 44, height: 24, borderRadius: 12, position: 'relative', display: 'block',
        background: checked ? 'var(--grn)' : 'var(--brd2)', transition: 'background var(--dur) var(--ease)' }}>
        <span style={{ position: 'absolute', top: 3, left: 3, width: 18, height: 18, borderRadius: '50%',
          background: 'var(--sur)', boxShadow: 'var(--sh-1)', display: 'block',
          transform: checked ? 'translateX(20px)' : 'none', transition: 'transform var(--dur) var(--ease)' }} />
      </span>
    </button>
  )
}

// Campo de PIN: oculto, teclado numérico en móvil, solo dígitos, máx. 6.
function PinField({ label, value, onChange, onEnter, error, autoFocus }) {
  const id = useId()
  const ref = useRef(null)
  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={id} style={lbl}>{label}</label>
      <input
        ref={ref} id={id} type="password" inputMode="numeric" pattern="[0-9]*"
        autoComplete="off" name="moyiq-lock-pin" maxLength={PIN_MAX_LENGTH}
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, PIN_MAX_LENGTH))}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onEnter?.() } }}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        style={{ fontFamily: 'var(--mono)', letterSpacing: '.3em', fontSize: 20, minHeight: 48, maxWidth: 220 }}
      />
      {error && <div id={`${id}-err`} role="alert" style={{ fontSize: 13, color: 'var(--neg)' }}>{error}</div>}
    </div>
  )
}

function StepBox({ children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 0 4px' }}>{children}</div>
}

function StepActions({ t, onCancel, onSubmit, submitLabel, disabled, busy, danger }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {/* Btn no trae estilo :disabled propio; sin esto el botón deshabilitado
          se ve igual que el activo. */}
      <Btn variant={danger ? 'danger' : 'primary'} onClick={onSubmit} disabled={disabled || busy} aria-busy={busy || undefined}
        style={disabled || busy ? { opacity: .5, cursor: 'not-allowed' } : undefined}>
        {busy ? t('lock.setup.working') : submitLabel}
      </Btn>
      <Btn variant="ghost" onClick={onCancel} disabled={busy}>{t('common.cancel')}</Btn>
    </div>
  )
}

// Nuevo PIN + confirmación. onDone(pin) con el PIN en claro SOLO en memoria.
function NewPinSteps({ t, newLabel, busy, onCancel, onDone, submitLabel }) {
  const [step, setStep] = useState('new')
  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState(null)

  function next() {
    if (!isValidPin(pin1)) { setError(t('lock.setup.invalid')); return }
    setError(null); setStep('confirm')
  }
  function confirm() {
    if (pin2 !== pin1) { setPin1(''); setPin2(''); setStep('new'); setError(t('lock.setup.mismatch')); return }
    onDone(pin1)
  }

  return step === 'new' ? (
    <StepBox>
      <PinField key="new" label={newLabel} value={pin1} onChange={setPin1} onEnter={next} error={error} autoFocus />
      <StepActions t={t} onCancel={onCancel} onSubmit={next} submitLabel={t('lock.setup.next')} disabled={pin1.length < 4} busy={busy} />
    </StepBox>
  ) : (
    <StepBox>
      <PinField key="confirm" label={t('lock.setup.confirm')} value={pin2} onChange={setPin2} onEnter={confirm} autoFocus />
      <StepActions t={t} onCancel={onCancel} onSubmit={confirm} submitLabel={submitLabel} disabled={pin2.length < 4} busy={busy} />
    </StepBox>
  )
}

function SetupFlow({ t, bioAvail, busy, onCancel, onDone }) {
  const [pin, setPin] = useState(null)       // PIN ya confirmado (en memoria)
  const [hashing, setHashing] = useState(false)
  const [bioError, setBioError] = useState(null)

  async function finish(plainPin, wantBio) {
    setHashing(true)
    let biometric = null
    if (wantBio) {
      setBioError(null)
      try { biometric = await createBiometricCredential() } catch { biometric = null }
      // Falló o se canceló: no activamos nada todavía; la persona elige
      // reintentar o seguir solo con PIN.
      if (!biometric) { setBioError(t('lock.setup.bioFailed')); setHashing(false); return }
    }
    const record = await hashPin(plainPin)
    setHashing(false)
    onDone(record, biometric)
  }

  if (!pin) {
    return (
      <>
        <div style={{ ...sub, marginTop: 12, padding: '10px 12px', background: 'var(--sur2)', borderRadius: 'var(--r)' }}>
          {t('lock.setup.forgetWarn')}
        </div>
        <NewPinSteps t={t} newLabel={t('lock.setup.new')} busy={busy || hashing} onCancel={onCancel}
          submitLabel={bioAvail ? t('lock.setup.next') : t('lock.setup.save')}
          onDone={(p) => { if (bioAvail) setPin(p); else finish(p, false) }} />
      </>
    )
  }

  return (
    <StepBox>
      <div>
        <div style={lbl}>{t('lock.setup.bioAsk')}</div>
        <div style={sub}>{t('lock.settings.bioDesc')}</div>
      </div>
      {bioError && <div role="alert" style={{ fontSize: 13, color: 'var(--neg)' }}>{bioError}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn variant="primary" onClick={() => finish(pin, true)} disabled={busy || hashing}>
          <Fingerprint size={16} strokeWidth={1.7} aria-hidden="true" />
          {hashing ? t('lock.setup.working') : t('lock.setup.bioYes')}
        </Btn>
        <Btn variant="ghost" onClick={() => finish(pin, false)} disabled={busy || hashing}>{t('lock.setup.bioNo')}</Btn>
      </div>
    </StepBox>
  )
}

// Pide el PIN actual y llama onOk si coincide.
function CurrentPinStep({ t, pinRecord, busy, onCancel, onOk, submitLabel, danger }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(false)

  async function submit() {
    if (!isValidPin(value)) { setError(t('lock.setup.invalid')); return }
    setChecking(true)
    const ok = await verifyPin(value, pinRecord).catch(() => false)
    setChecking(false)
    if (!ok) { setValue(''); setError(t('lock.screen.wrongPlain')); return }
    setError(null)
    onOk()
  }

  return (
    <StepBox>
      <PinField label={t('lock.setup.current')} value={value} onChange={setValue} onEnter={submit} error={error} autoFocus />
      <StepActions t={t} onCancel={onCancel} onSubmit={submit} submitLabel={submitLabel}
        disabled={value.length < 4} busy={busy || checking} danger={danger} />
    </StepBox>
  )
}

function ChangeFlow({ t, pinRecord, busy, onCancel, onDone }) {
  const [verified, setVerified] = useState(false)
  const [hashing, setHashing] = useState(false)
  if (!verified) {
    return <CurrentPinStep t={t} pinRecord={pinRecord} busy={busy} submitLabel={t('lock.setup.next')}
      onCancel={onCancel} onOk={() => setVerified(true)} />
  }
  return (
    <NewPinSteps t={t} newLabel={t('lock.setup.newChange')} busy={busy || hashing} onCancel={onCancel}
      submitLabel={t('lock.setup.confirmChange')}
      onDone={async (p) => { setHashing(true); const rec = await hashPin(p); setHashing(false); onDone(rec) }} />
  )
}
