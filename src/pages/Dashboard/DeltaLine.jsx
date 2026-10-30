// src/pages/Dashboard/DeltaLine.jsx — variación vs. el mes anterior (M5).
// Ícono + texto, nunca solo color: flecha arriba/abajo o "=" con la frase
// completa ("−6 % vs. septiembre", "igual que septiembre"). El color dice si el
// cambio es bueno (verde) o malo (rojo) según la métrica — en Gastos bajar es
// bueno — pero la dirección se lee igual sin él.
// R5a (ola A1): cuando el porcentaje no informa (delta.usePct === false) y hay
// `sym`, la frase lleva el monto ("+Bs.53.000 vs. sept al día 29"). El monto
// pasa por la máscara de "ocultar montos" (T13): el porcentaje no revelaba
// cifras, el monto sí.
import Delta from '../../components/ledger/Delta.jsx'
import { useMoney } from '../../components/Money.jsx'
import { useT } from '../../i18n/useT.js'
import { fmtMoney } from '../../utils/index.js'
import { fmtSignedPct, monthName } from './dashboardModel.js'

export function deltaAmountText(abs, sym) {
  const n = Number(abs) || 0
  return (n > 0 ? '+' : n < 0 ? '−' : '') + fmtMoney(Math.abs(n), sym)
}

// delta: resultado de monthDelta() o null (no se muestra nada).
// valueText: reemplaza el porcentaje (ej. "+3 pts" del IQ Score).
// sym: símbolo de la moneda; sin él la línea sigue en porcentaje.
// formatAmount: formatea la diferencia en otra moneda (héroe en US$, R12).
// untilDay: la comparación es contra el mes anterior hasta ese día (FIN-14).
export default function DeltaLine({ delta, prevMonth, valueText, sym, formatAmount, style, untilDay = null }) {
  const { t, lang } = useT()
  const { m } = useMoney()
  if (!delta) return null
  const month = monthName(prevMonth, lang, untilDay != null ? 'short' : 'long')
  const flat = delta.dir === 'flat'
  const amount = !valueText && (sym != null || formatAmount) && delta.usePct === false
  const amountText = () => formatAmount ? formatAmount(delta.abs) : deltaAmountText(delta.abs, sym)
  const pct = valueText ?? (amount ? m(amountText()) : fmtSignedPct(delta.pct))
  const text = untilDay != null
    ? (flat ? t('home.delta.flatDay', { month, d: untilDay }) : t('home.delta.vsDay', { pct, month, d: untilDay }))
    : (flat ? t('home.delta.flat', { month }) : t('home.delta.vs', { pct, month }))
  return <Delta dir={delta.dir} good={delta.good} style={style}>{text}</Delta>
}
