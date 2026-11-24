// src/pages/Settings/AutoEntryScreen.jsx — Ajustes › Registro automático (19-nov-2026).
// Guía para crear el Atajo de iOS que abre moyiq al pagar con Apple Pay, y
// cómo dictar un gasto en el "+". El contrato de la URL está en
// utils/autoEntry.js y docs/registro-automatico.md.
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { speechSupported } from '../../hooks/useSpeechEntry.js'
import { slbl, ssub, Setting } from './settingsUi.jsx'
import { nativePlatform } from '../../native/platform.js'

// TODO(Walter): enlace de iCloud del Atajo ya armado. Pasos en
// docs/registro-automatico.md ("Atajo para compartir"). Vacío = "Pronto".
export const SHORTCUT_ICLOUD_URL = ''

export const INTAKE_BASE = 'https://app.moyiq.app/app/?add=gasto&fuente=applepay'
// App de iOS (Capacitor): el Atajo abre la app con su esquema, mismo contrato
// (native/nativeLinks.js › INTAKE_PARAMS). Sin enlaces universales publicados,
// la URL https abriría Safari y no la app.
export const NATIVE_INTAKE_BASE = 'moyiq://add?add=gasto&fuente=applepay'
export const intakeTemplate = (amountVar, merchantVar, base = INTAKE_BASE) => `${base}&monto=[${amountVar}]&comercio=[${merchantVar}]`

const box = { padding: '10px 12px', borderRadius: 'var(--rl)', background: 'var(--fill)', fontSize: 13, lineHeight: 1.5, color: 'var(--tx)' }

export default function AutoEntryScreen() {
  const { showToast } = useApp() || {}
  const { t } = useT()
  // Por plataforma (AND-10, B2/I11 de la revisión pre-tiendas): en la app de
  // Android no hay Atajos de Apple Pay, así que solo se ve el dictado; en la de
  // iOS el Atajo abre la app (moyiq://) y no se muestran los avisos de la web
  // ("abre Safari", "app de iPhone en preparación", "Pronto").
  const platform = nativePlatform()
  const native = platform !== 'web'
  const showApplePay = platform !== 'android'
  const url = intakeTemplate(t('auto.url.amountVar'), t('auto.url.merchantVar'), native ? NATIVE_INTAKE_BASE : INTAKE_BASE)
  const steps = ['auto.step1', 'auto.step2', 'auto.step3', 'auto.step4']
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); showToast?.(t('auto.url.copied'), 'ok') } catch { showToast?.(t('qa.intake.copyFail'), 'err') }
  }
  return (
    <div style={{ display: 'grid', gap: 14, paddingTop: 10 }}>
      {showApplePay && <>
      <Setting id="applePay">
        <h3 style={{ ...slbl, fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>{t('auto.applePay.label')}</h3>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--tm)', margin: 0 }}>{t('auto.intro')}</p>
      </Setting>

      {!native && <div style={box} role="note">
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{t('auto.honest.title')}</div>
        {t('auto.honest.body')}
      </div>}

      <section aria-labelledby="auto-steps">
        <h3 id="auto-steps" style={{ ...slbl, fontSize: 14, fontWeight: 600, margin: '0 0 6px' }}>{t('auto.steps.title')}</h3>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8, fontSize: 13, lineHeight: 1.5, color: 'var(--tx)' }}>
          {steps.map(k => <li key={k}>{t(k)}</li>)}
        </ol>
      </section>

      <div>
        <div style={{ ...ssub, fontSize: 12, marginBottom: 4 }} id="auto-url-label">{t('auto.url.label')}</div>
        <code aria-labelledby="auto-url-label" data-testid="auto-url"
          style={{ display: 'block', padding: '10px 12px', borderRadius: 'var(--r)', background: 'var(--sur2)', fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.5, overflowWrap: 'anywhere', color: 'var(--tx)' }}>
          {url}
        </code>
        <button type="button" className="fos-btn-secondary" onClick={copy} style={{ marginTop: 8, minHeight: 44 }}>{t('auto.url.copy')}</button>
        <p style={{ ...ssub, fontSize: 12, lineHeight: 1.5, margin: '8px 0 0' }}>{t('auto.url.note')}</p>
      </div>

      {(SHORTCUT_ICLOUD_URL || !native) && <div style={box}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{t('auto.shortcut.title')}</div>
        {SHORTCUT_ICLOUD_URL
          ? <a href={SHORTCUT_ICLOUD_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blu)' }}>{t('auto.shortcut.get')}</a>
          : t('auto.shortcut.soon')}
      </div>}
      </>}

      <Setting id="voice" style={showApplePay ? { borderTop: '0.5px solid var(--brd)', paddingTop: 12 } : undefined}>
        <h3 style={{ ...slbl, fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>{t('auto.voice.label')}</h3>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--tx)', margin: '0 0 6px' }}>{t('auto.voice.body')}</p>
        {!speechSupported() && <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--tm)', margin: '0 0 6px' }}>{t('auto.voice.unsupported')}</p>}
        <p style={{ ...ssub, fontSize: 12, lineHeight: 1.5, margin: 0 }}>{t('auto.voice.privacy')}</p>
        {!native && <p style={{ ...ssub, fontSize: 12, lineHeight: 1.5, margin: '6px 0 0' }}>{t('auto.android')}</p>}
      </Setting>
    </div>
  )
}
