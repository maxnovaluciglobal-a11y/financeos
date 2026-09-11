// src/components/LicenseGate.jsx
import { useState } from 'react'
import { validateLicense, setLicenseEmail } from '../utils/licenseValidator.js'
import { useT } from '../i18n/useT.js'
import Logo from './Logo.jsx'

function usePlans(t) {
  return [
    { name: 'Personal', price: 'US$19', desc: t('licenseGate.planPersonalDesc'), product: 'personal', highlight: false },
    { name: 'Pro',      price: 'US$29', desc: t('licenseGate.planProDesc'),      product: 'pro',      highlight: true },
  ]
}

// Stripe Payment Links (Live) — Personal US$19 / Pro US$29
const CHECKOUT_LINKS = {
  personal: 'https://buy.stripe.com/dRmeVf64WdSR85HgvD3wQ02',
  pro:      'https://buy.stripe.com/fZu5kFctk5ml1Hj3IR3wQ03',
}

async function startCheckout(product) {
  const url = CHECKOUT_LINKS[product] || 'https://financeospro.com/#pricing'
  window.location.href = url
}

export default function LicenseGate({ onActivate }) {
  const { t } = useT()
  const PLANS = usePlans(t)
  const [key, setKey]           = useState('')
  const [email, setEmail]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [buying, setBuying]     = useState(null)
  const [error, setError]       = useState('')
  const [showHelp, setShowHelp] = useState(false)

  async function handleActivate() {
    const clean = key.trim()
    if (!clean) return
    setLoading(true)
    setError('')
    try {
      const valid = await validateLicense(clean)
      if (valid) {
        // Best-effort: asocia el email para avisos/soporte. No bloquea la activación si falla.
        if (email.trim()) setLicenseEmail(email).catch(() => {})
        onActivate()
      } else {
        setError(t('licenseGate.errorInvalid'))
        setShowHelp(true)
      }
    } catch {
      setError(t('licenseGate.errorOffline'))
    }
    setLoading(false)
  }

  async function handleBuy(product) {
    setBuying(product)
    try {
      await startCheckout(product)
    } catch {
      setError(t('licenseGate.errorPayment'))
      setBuying(null)
    }
  }

  const s = {
    wrap: {
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'var(--sans)',
    },
    box: {
      background: 'var(--sur)',
      border: '1px solid var(--brd2)',
      borderRadius: 18,
      padding: '40px 36px',
      maxWidth: 440,
      width: '100%',
      boxShadow: 'var(--sh-2)',
    },
  }

  return (
    <div style={s.wrap}>
      <div style={s.box}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <Logo size={22} />
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--th)' }}>{t('licenseGate.version')}</div>
        </div>

        {/* Activate */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 6, fontFamily: 'var(--display)' }}>{t('licenseGate.title')}</div>
          <div style={{ fontSize: 12, color: 'var(--tm)', lineHeight: 1.6, marginBottom: 14, fontFamily: 'var(--sans)' }}>
            {t('licenseGate.subtitle')}{' '}
            <span style={{ fontFamily: 'var(--mono)', background: 'var(--sur3)', padding: '1px 6px', borderRadius: 4 }}>{t('licenseGate.keyFormat')}</span>
          </div>
          <input
            style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--brd)', borderRadius: 8, fontSize: 16, fontFamily: 'var(--mono)', background: 'var(--bg)', color: 'var(--tx)', letterSpacing: 1, marginBottom: 10, boxSizing: 'border-box', outline: 'none' }}
            type="text"
            placeholder={t('licenseGate.keyFormat')}
            value={key}
            onChange={e => { setKey(e.target.value.toUpperCase()); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleActivate()}
            autoFocus
            spellCheck={false}
          />

          <input
            style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--brd)', borderRadius: 8, fontSize: 16, fontFamily: 'var(--sans)', background: 'var(--bg)', color: 'var(--tx)', marginBottom: 4, boxSizing: 'border-box', outline: 'none' }}
            type="email"
            inputMode="email"
            placeholder={t('licenseGate.emailPlaceholder')}
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleActivate()}
            spellCheck={false}
          />
          <div style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--sans)', marginBottom: 10, lineHeight: 1.5 }}>
            {t('licenseGate.emailNote')}
          </div>

          {error && (
            <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 10, fontFamily: 'var(--mono)', padding: '8px 12px', background: 'var(--red-bg)', borderRadius: 7, lineHeight: 1.5 }}>
              ⚠ {error}
            </div>
          )}

          <button
            style={{ width: '100%', padding: 12, background: 'var(--laton)', color: 'var(--navy)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: loading || !key.trim() ? 'not-allowed' : 'pointer', opacity: loading || !key.trim() ? 0.55 : 1, fontFamily: 'var(--sans)', transition: 'opacity .15s' }}
            onClick={handleActivate}
            disabled={loading || !key.trim()}
          >
            {loading ? t('licenseGate.verifying') : t('licenseGate.activateBtn')}
          </button>

          {showHelp && (
            <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--sur2)', borderRadius: 8, fontSize: 11, color: 'var(--tm)', fontFamily: 'var(--mono)', lineHeight: 1.65 }}>
              <strong style={{ color: 'var(--tx)' }}>{t('licenseGate.helpTitle')}</strong><br />
              1. {t('licenseGate.helpStep1')}<br />
              2. {t('licenseGate.helpStep2')}<br />
              3. {t('licenseGate.helpStep3')}<br /><br />
              {t('licenseGate.helpNoEmail')}{' '}
              <a href="https://financeospro.com/activate.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--grn)' }}>
                {t('licenseGate.helpLink')}
              </a>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--brd)' }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--th)', flexShrink: 0 }}>{t('licenseGate.dividerNoLicense')}</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--brd)' }} />
        </div>

        {/* Purchase plans */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          {PLANS.map(p => (
            <button
              key={p.name}
              onClick={() => handleBuy(p.product)}
              disabled={buying !== null}
              style={{
                flex: 1,
                padding: '14px 12px',
                borderRadius: 10,
                textAlign: 'center',
                border: p.highlight ? '2px solid var(--grn)' : '1px solid var(--brd)',
                background: p.highlight ? 'var(--grn-tint)' : 'var(--bg)',
                cursor: buying !== null ? 'not-allowed' : 'pointer',
                opacity: buying && buying !== p.product ? 0.5 : 1,
                transition: 'transform .12s, opacity .15s',
              }}
              onMouseOver={e => { if (!buying) e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseOut={e => { e.currentTarget.style.transform = 'none' }}
            >
              <div style={{ fontFamily: 'var(--display)', fontSize: 13, fontWeight: 600, color: p.highlight ? 'var(--grn)' : 'var(--tx)', marginBottom: 3 }}>{p.name}</div>
              <div style={{ fontFamily: 'var(--display)', fontSize: 20, fontWeight: 700, color: 'var(--tx)', marginBottom: 3 }}>{p.price}</div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--th)', lineHeight: 1.45 }}>{p.desc}</div>
              {buying === p.product && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--grn)', marginTop: 6 }}>{t('licenseGate.redirecting')}</div>
              )}
            </button>
          ))}
        </div>

        {/* Demo link */}
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)' }}>
          <a href="https://demo.financeospro.com/app/?demo=true" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--grn)', textDecoration: 'none' }}>
            {t('licenseGate.demoLink')}
          </a>
        </div>

      </div>
    </div>
  )
}
