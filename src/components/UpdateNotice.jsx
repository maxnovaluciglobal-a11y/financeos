// src/components/UpdateNotice.jsx — H14 (ola A11): "Hay una versión nueva. Actualizar".
// Aviso discreto, una línea sobre la barra de pestañas; no interrumpe. Se
// muestra cuando el SW nuevo tomó control (core/swUpdate.js).
import { useEffect, useState } from 'react'
import { useT } from '../i18n/useT.js'
import { isUpdateReady, onUpdateReady } from '../core/swUpdate.js'
import s from './updateNotice.module.css'

export default function UpdateNotice() {
  const { t } = useT()
  const [show, setShow] = useState(isUpdateReady())
  useEffect(() => onUpdateReady(() => setShow(true)), [])
  if (!show) return null
  return (
    <div className={s.bar} role="status">
      <span>{t('app.update.ready')}</span>
      <button type="button" className={s.btn} onClick={() => window.location.reload()}>{t('app.update.action')}</button>
    </div>
  )
}
