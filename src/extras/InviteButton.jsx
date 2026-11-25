// src/extras/InviteButton.jsx — botón "Invita a alguien" (pestaña Más).
// Textos en src/extras/strings.*.js.
import { Share2 } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/useT.js'
import { ExtrasStringsGate } from './strings.js'
import { inviteUrl, shareInvite } from './invite.js'

export default function InviteButton(props) {
  return <ExtrasStringsGate><Inner {...props} /></ExtrasStringsGate>
}

// `variant="row"`: fila con ícono, título y una línea (Ajustes); si no, la
// acción simple de la lista de Más (usa las clases que le pasan).
function Inner({ className, iconClass, labelClass, variant }) {
  const { showToast } = useApp() || {}
  const { t } = useT()
  async function onClick() {
    const r = await shareInvite({ title: t('invite.title'), text: t('invite.text') })
    if (r === 'copied') showToast?.(t('invite.copied'))
    else if (r === 'failed') showToast?.(t('invite.failed', { url: inviteUrl().replace(/^https:\/\//, '') }), 'error')
  }
  if (variant === 'row') {
    return (
      <button type="button" onClick={onClick} className={className}>
        <span className={iconClass} aria-hidden="true" style={{ color: 'var(--tm)' }}><Share2 size={18} strokeWidth={1.7} /></span>
        <span className={labelClass}>
          <span style={{ display: 'block' }}>{t('invite.label')}</span>
          <span style={{ display: 'block', fontSize: 'var(--t-subhead)', color: 'var(--th)', marginTop: 2, lineHeight: 'var(--t-subhead-lh)' }}>{t('invite.sub')}</span>
        </span>
      </button>
    )
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      <Share2 size={16} strokeWidth={1.7} aria-hidden="true" />{t('invite.label')}
    </button>
  )
}
