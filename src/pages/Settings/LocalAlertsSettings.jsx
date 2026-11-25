// src/pages/Settings/LocalAlertsSettings.jsx — Ajustes › Notificaciones ›
// "Avisos de tus finanzas" (24-nov-2026). Los avisos se calculan en el
// dispositivo (core/localAlerts/plan.js). En la app de tienda: fila del
// permiso del teléfono (se pide por la hoja de ejemplos, primer.js) y un
// interruptor por tipo. En la web: los mismos interruptores; los avisos salen
// en el Inicio y, con el permiso del navegador, como notificación mientras
// moyiq está abierto.
import { useEffect, useState } from 'react'
import { Btn } from '../../components/ui/index.jsx'
import StateTag from '../../components/ledger/StateTag.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { isNativeApp } from '../../native/platform.js'
import { ExtrasStringsGate } from '../../extras/strings.js'
import { ALERT_TYPES, alertPrefs } from '../../core/localAlerts/plan.js'
import { requestLocalAlerts } from '../../core/localAlerts/primer.js'
import { srow, slbl, ssub, Switch, Setting } from './settingsUi.jsx'

export default function LocalAlertsSettings() {
  return <ExtrasStringsGate><Inner /></ExtrasStringsGate>
}

function Inner() {
  const { settings, updateSettings } = useApp()
  const { t } = useT()
  const native = isNativeApp()
  const prefs = alertPrefs({ ...settings, hideAmounts: false })
  // "Ocultar montos" (global) también los saca de los avisos: el interruptor
  // de montos lo muestra apagado y explica por qué.
  const amountsHidden = !!settings?.hideAmounts
  const [perm, setPerm] = useState(native ? 'loading' : null)
  const [busy, setBusy] = useState(false)

  // Al abrir y al volver a la app (la persona pudo cambiar el permiso en los
  // ajustes del teléfono mientras tanto).
  useEffect(() => {
    if (!native) return
    let alive = true
    const check = () => import('../../core/localAlerts/native.js').then(n => n.localPermission())
      .then(p => { if (alive) setPerm(p) }).catch(() => { if (alive) setPerm('unsupported') })
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    check()
    document.addEventListener('visibilitychange', onVisible)
    return () => { alive = false; document.removeEventListener('visibilitychange', onVisible) }
  }, [native])

  async function enable() {
    if (busy) return
    setBusy(true)
    try {
      const r = await requestLocalAlerts({ source: 'settings' })
      if (r.ok) setPerm('granted')
      else if (r.error === 'permission_denied') setPerm('denied')
    } finally { setBusy(false) }
  }

  function toggle(type) {
    const cur = (settings.localAlerts && typeof settings.localAlerts === 'object') ? settings.localAlerts : {}
    updateSettings({ ...settings, localAlerts: { ...cur, [type]: !prefs[type] } })
  }

  return (
    <div style={{ marginTop: 8 }}>
      <h3 style={{ margin: '12px 0 2px', fontSize: 'var(--t-headline)', fontWeight: 600, color: 'var(--tx)' }}>{t('la.settings.title')}</h3>
      <p style={{ ...ssub, margin: '0 0 6px', lineHeight: 1.6 }}>{t('la.settings.sub')}</p>
      {!native && <p style={{ ...ssub, margin: '0 0 6px', lineHeight: 1.6 }}>{t('la.settings.webNote')}</p>}

      {native && perm !== 'unsupported' && (
        <Setting id="localPush" style={{ ...srow, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: '1 1 220px' }}>
            <div style={slbl}>{t('la.settings.channel')}</div>
            <div style={{ marginTop: 8, fontSize: 'var(--t-footnote)' }} role="status">
              {perm === 'granted' ? <StateTag tone="ok" label={t('la.settings.state.on')} />
                : perm === 'denied' ? <StateTag tone="muted" label={t('la.settings.state.denied')} />
                : perm === 'loading' ? null
                : <StateTag tone="muted" label={t('la.settings.state.off')} />}
            </div>
            {perm === 'denied' && <div style={{ ...ssub, marginTop: 8, lineHeight: 1.6 }}>{t('la.settings.deniedHint')}</div>}
          </div>
          {perm === 'prompt' && (
            <Btn variant="ghost" onClick={enable} disabled={busy}>{t('la.settings.enable')}</Btn>
          )}
        </Setting>
      )}

      {[...ALERT_TYPES, 'amounts'].map((type, i, all) => (
        <Setting key={type} id={`la-${type}`} style={{ ...srow, ...(i === all.length - 1 ? { borderBottom: 'none' } : null) }}>
          <div style={{ minWidth: 0 }}>
            <div style={slbl} id={`la-${type}-label`}>{t(`la.type.${type}`)}</div>
            <div style={ssub} id={`la-${type}-sub`}>{t(type === 'amounts' && amountsHidden ? 'la.type.amounts.hiddenGlobal' : `la.type.${type}.sub`)}</div>
          </div>
          {type === 'amounts' && amountsHidden
            ? <Switch checked={false} disabled labelledBy={`la-${type}-label`} describedBy={`la-${type}-sub`} />
            : <Switch checked={prefs[type]} labelledBy={`la-${type}-label`} onChange={() => toggle(type)} />}
        </Setting>
      ))}
    </div>
  )
}
