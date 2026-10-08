// src/components/Money.jsx — ocultar montos (T13)
//
// Con settings.hideAmounts activo, toda cifra de dinero se reemplaza por "•••".
// No es un blur de CSS: el número real no llega al DOM, así que tampoco lo lee
// un lector de pantalla ni aparece en una captura. El "•••" visual va con
// aria-hidden y al lado un texto sr-only ("Monto oculto").
//
// Dos formas de usarlo:
//   <Money>{fmtMoney(x, sym)}</Money>   → cifra visible en JSX
//   const { m } = useMoney(); m(fmtMoney(x, sym))
//                                        → cifra dentro de un string (frases i18n,
//                                          aria-label, tickFormatter de recharts)
//
// Lo que NO pasa por acá a propósito: los PDF de reportes y el Modo Asesor
// (documentos que se generan para compartir, siempre con las cifras reales).

import { useContext, useMemo } from 'react'
import { AppContext } from '../context/AppContext.jsx'
import { useT } from '../i18n/useT.js'
import { MONEY_MASK, maskMoney } from '../utils/money.js'

export { MONEY_MASK, maskMoney }

// No usa useApp() para no lanzar fuera del provider (ej. un componente
// compartido renderizado en una pantalla previa al login): sin contexto, nunca oculta.
export function useMoney() {
  const ctx = useContext(AppContext)
  const hidden = !!ctx?.settings?.hideAmounts
  return useMemo(() => ({
    hidden,
    m: (s) => maskMoney(hidden, s),
  }), [hidden])
}

export default function Money({ children }) {
  const { hidden } = useMoney()
  if (!hidden) return <>{children}</>
  return <MaskedAmount />
}

function MaskedAmount() {
  const { t } = useT()
  return (
    <span className="money-masked">
      <span aria-hidden="true">{MONEY_MASK}</span>
      <span className="sr-only">{t('money.hidden')}</span>
    </span>
  )
}
