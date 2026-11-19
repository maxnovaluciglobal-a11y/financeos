// src/components/ErrorBoundary.jsx
// Red de seguridad global: si CUALQUIER componente tira un error de render,
// en vez de dejar la pantalla en blanco/negra (React desmonta todo el árbol),
// mostramos una tarjeta con opciones de recuperación. Los datos del usuario
// están intactos en IndexedDB — solo falló el render.

import { Component } from 'react'
import { translate, detectLanguage } from '../i18n/translate.js'
import { logClientError } from '../utils/errorLog.js'
import { BRAND } from '../styles/tokens.js'

// Está FUERA de AppProvider (envuelve a <App/>): no hay useT(). El idioma sale
// de <html lang>, que AppContext/DemoContext mantienen con settings.language;
// si ese diccionario no alcanzó a cargarse, translate() cae a español.
const tr = (key, vars) => translate(document.documentElement.lang || detectLanguage(), key, vars)

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Sin telemetría externa (privacidad): queda en el registro local, que la
    // persona puede copiar desde Ajustes para soporte (ING-4 / D-16).
    console.error('[moyiq] Error de render capturado:', error, info?.componentStack)
    const firstFrame = String(info?.componentStack || '').trim().split('\n')[0]?.trim().slice(0, 120)
    logClientError({ type: 'render', message: error?.message || String(error), source: firstFrame || undefined })
  }

  handleReload = () => {
    // Recarga tomando la última versión (útil si fue un chunk viejo tras deploy)
    try { sessionStorage.removeItem('fnos_chunk_reload_at') } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }
    window.location.reload()
  }

  handleHome = () => {
    this.setState({ hasError: false, error: null })
    try { window.location.hash = '' } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }
    window.location.assign('/app/')
  }

  render() {
    if (!this.state.hasError) return this.props.children

    // Hex de la paleta (tokens.js) en vez de var(): esta pantalla tiene que
    // verse aunque el CSS no haya cargado. Marca nueva: hoja blanca, tarjeta en
    // morado 50, botón morado 700 con texto blanco (12,05:1), radios 16/12.
    const wrap = {
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: BRAND.white, padding: 20, fontFamily: "InterVariable, Inter, system-ui, -apple-system, sans-serif",
    }
    const card = {
      background: BRAND.purple50, border: 0, borderRadius: 16,
      padding: '28px 24px', maxWidth: 380, width: '100%', textAlign: 'center',
    }
    const btnP = {
      width: '100%', minHeight: 44, padding: '11px', borderRadius: 12, border: 'none',
      background: BRAND.purple, color: BRAND.white, fontSize: 'var(--t-headline)', fontWeight: 600,
      cursor: 'pointer', marginTop: 14,
    }
    const btnG = {
      width: '100%', minHeight: 44, padding: '9px', borderRadius: 12, border: 'none',
      background: 'transparent', color: BRAND.muted, fontSize: 'var(--t-subhead)', cursor: 'pointer', marginTop: 8,
    }

    const [before, after = ''] = tr('errorBoundary.body').split('{safe}')

    return (
      <div style={wrap}>
        <div style={card}>
          <div style={{ fontSize: 'var(--t-large-title)', marginBottom: 10 }}>🔧</div>
          <div style={{ fontSize: 'var(--t-headline)', fontWeight: 600, color: BRAND.graphite, marginBottom: 8 }}>
            {tr('errorBoundary.title')}
          </div>
          <p style={{ fontSize: 'var(--t-subhead)', color: BRAND.ink, lineHeight: 1.6, marginBottom: 4 }}>
            {before}<strong>{tr('errorBoundary.safe')}</strong>{after}
          </p>
          <button style={btnP} onClick={this.handleReload}>{tr('errorBoundary.reload')}</button>
          <button style={btnG} onClick={this.handleHome}>{tr('errorBoundary.home')}</button>
        </div>
      </div>
    )
  }
}
