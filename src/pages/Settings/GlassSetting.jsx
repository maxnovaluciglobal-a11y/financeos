// src/pages/Settings/GlassSetting.jsx — Ajustes › Apariencia › Transparencias
// (24-nov-2026). Material de vidrio de la barra de pestañas y de las hojas
// (tokens.css: --tabbar-bg/--tabbar-blur, --sheet-bg/--sheet-blur).
// Preferencia de ESTE dispositivo (localStorage 'fos_glass', como el tema):
// public/theme-boot.js la aplica antes de pintar (html[data-glass="off"]), así
// no viaja en respaldos ni en el sync. Si el sistema pide "Reducir
// transparencia", la CSS ya usa fondos sólidos y acá se dice.
import { useState } from 'react'
import { useT } from '../../i18n/useT.js'
import { ExtrasStringsGate } from '../../extras/strings.js'
import { srow, slbl, ssub, Switch, Setting } from './settingsUi.jsx'

export const GLASS_KEY = 'fos_glass'

export function glassOn() {
  try { return localStorage.getItem(GLASS_KEY) !== 'off' } catch { return true }
}

export function setGlass(on, doc = document) {
  try { if (on) localStorage.removeItem(GLASS_KEY); else localStorage.setItem(GLASS_KEY, 'off') } catch { /* sin almacenamiento: vale hasta recargar */ }
  if (on) delete doc.documentElement.dataset.glass
  else doc.documentElement.dataset.glass = 'off'
}

export default function GlassSetting() {
  return <ExtrasStringsGate><Inner /></ExtrasStringsGate>
}

function Inner() {
  const { t } = useT()
  const [on, setOn] = useState(glassOn)
  const systemReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches
  return (
    <Setting id="glass" style={{ ...srow, borderTop: '0.5px solid var(--brd)', borderBottom: 'none' }}>
      <div style={{ minWidth: 0 }}>
        <div style={slbl} id="settings-glass-label">{t('glass.label')}</div>
        <div style={ssub}>{t(systemReduced ? 'glass.systemOff' : 'glass.sub')}</div>
      </div>
      <Switch checked={on && !systemReduced} labelledBy="settings-glass-label"
        onChange={() => { if (systemReduced) return; const next = !on; setGlass(next); setOn(next) }} />
    </Setting>
  )
}
