// src/components/Amount.jsx — un monto con jerarquía (investigación UI oct-2026, UI-M2)
//
// Una sola fuente de formato: fmtMoneyParts (utils/index.js), la misma que
// fmtMoney/fmtSignedMoney. Lo que agrega es el dibujo:
//   - signo menos U+2212 (nunca el guion ASCII) y "+" opcional;
//   - en la variante `hero`, el símbolo y los centavos al ~65 % del tamaño y en
//     --tm, para que la parte entera sea la que se lee primero (Mercury,
//     getquin, Untitled UI);
//   - cifras en .num (IBM Plex Sans tabular, UI-M1);
//   - respeta "ocultar montos" (T13): con hideAmounts el número no llega al DOM.
//
// <Amount value={-1250} sym="$" />                 → "−$1.250"
// <Amount value={free} sym={sym} plus hero animate />  → cifra protagonista

import CountUp from './CountUp.jsx'
import Money from './Money.jsx'
import { fmtMoneyParts } from '../utils/index.js'

export function AmountText({ value, sym = '$', signed = true, plus = false }) {
  const p = fmtMoneyParts(value, sym, { signed, plus })
  return (
    <>
      {p.sign}
      {p.pre && <span className="amount-sym">{p.pre}</span>}
      {p.int}
      {p.frac && <span className="amount-frac">{p.frac}</span>}
      {p.post && <span className="amount-sym">{p.post}</span>}
    </>
  )
}

export default function Amount({ value, sym = '$', signed = true, plus = false, hero = false, animate = false, className, style }) {
  const cls = ['num', 'amount', hero ? 'amount-hero' : '', className].filter(Boolean).join(' ')
  const n = Number(value) || 0
  return (
    <span className={cls} style={style}>
      <Money>
        {animate
          ? <CountUp value={n} format={(v) => <AmountText value={v} sym={sym} signed={signed} plus={plus} />} />
          : <AmountText value={n} sym={sym} signed={signed} plus={plus} />}
      </Money>
    </span>
  )
}
