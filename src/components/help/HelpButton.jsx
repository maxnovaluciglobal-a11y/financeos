// src/components/help/HelpButton.jsx — el "?" de la barra superior (ayuda en la
// app, 26-nov-2026). Es lo único de la ayuda que va en el JS inicial: abre el
// panel (HelpHost.jsx, diferido) y muestra cuántas novedades hay sin leer.
import { CircleHelp } from 'lucide-react'

export const HELP_BUTTON_ID = 'fos-help-btn'

export default function HelpButton({ onClick, unread = 0, open = false, className, t }) {
  const label = unread > 0 ? t('help.buttonUnread', { n: unread }) : t('help.button')
  return (
    <button type="button" id={HELP_BUTTON_ID} className={className} onClick={onClick}
      aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={open}
      style={{ position: 'relative' }}>
      <CircleHelp size={18} strokeWidth={1.7} aria-hidden="true" />
      {unread > 0 && (
        <span aria-hidden="true" className="num" style={{
          position: 'absolute', top: 4, right: 2, minWidth: 16, height: 16, padding: '0 4px',
          borderRadius: 'var(--r-pill)', background: 'var(--color-accent)', color: 'var(--purple-900)',
          font: '700 10px/16px var(--sans)', textAlign: 'center', pointerEvents: 'none',
        }}>{unread > 9 ? '9+' : unread}</span>
      )}
    </button>
  )
}
