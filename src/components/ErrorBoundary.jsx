// src/components/ErrorBoundary.jsx
// Red de seguridad global: si CUALQUIER componente tira un error de render,
// en vez de dejar la pantalla en blanco/negra (React desmonta todo el árbol),
// mostramos una tarjeta con opciones de recuperación. Los datos del usuario
// están intactos en IndexedDB — solo falló el render.

import { Component } from 'react'
import { translate, detectLanguage } from '../i18n/translate.js'

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
    // Sin telemetría externa (privacidad). Solo consola para depurar en soporte.
    console.error('[FinanceOS] Error de render capturado:', error, info?.componentStack)
  }

  handleReload = () => {
    // Recarga tomando la última versión (útil si fue un chunk viejo tras deploy)
    try { sessionStorage.removeItem('fnos_chunk_reload_at') } catch {}
    window.location.reload()
  }

  handleHome = () => {
    this.setState({ hasError: false, error: null })
    try { window.location.hash = '' } catch {}
    window.location.assign('/app/')
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const wrap = {
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F1EEE6', padding: 20, fontFamily: 'system-ui, -apple-system, sans-serif',
    }
    const card = {
      background: '#FAF8F2', border: '0.5px solid #E4DFD1', borderRadius: 12,
      padding: '28px 24px', maxWidth: 380, width: '100%', textAlign: 'center',
      boxShadow: '0 20px 50px rgba(20,33,61,.10)',
    }
    const btnP = {
      width: '100%', padding: '11px', borderRadius: 8, border: 'none',
      background: '#B8863B', color: '#14213D', fontSize: 14, fontWeight: 600,
      cursor: 'pointer', marginTop: 14,
    }
    const btnG = {
      width: '100%', padding: '9px', borderRadius: 8, border: '0.5px solid #E4DFD1',
      background: 'transparent', color: '#63604F', fontSize: 12, cursor: 'pointer', marginTop: 8,
    }

    const [before, after = ''] = tr('errorBoundary.body').split('{safe}')

    return (
      <div style={wrap}>
        <div style={card}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🔧</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
            {tr('errorBoundary.title')}
          </div>
          <p style={{ fontSize: 13, color: '#6b6a63', lineHeight: 1.6, marginBottom: 4 }}>
            {before}<strong>{tr('errorBoundary.safe')}</strong>{after}
          </p>
          <button style={btnP} onClick={this.handleReload}>{tr('errorBoundary.reload')}</button>
          <button style={btnG} onClick={this.handleHome}>{tr('errorBoundary.home')}</button>
        </div>
      </div>
    )
  }
}
