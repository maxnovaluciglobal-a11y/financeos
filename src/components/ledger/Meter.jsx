// src/components/ledger/Meter.jsx — barra de avance con role="meter" (UI-M5, patrón coss ui Meter)
//
// Un medidor dice cuánto de un total se usó (presupuesto, meta). Va con
// role="meter" y aria-valuetext con la frase completa, porque el número solo
// ("80") no le dice nada a un lector de pantalla. Si `value` supera `max`, la
// barra se llena y el exceso se dibuja como un tramo rayado al final; el valor
// accesible se acota a `max` (ARIA no admite valuenow fuera de rango) y la
// frase dice el número real.
import s from './ledger.module.css'

export default function Meter({ value, max, tone = 'ok', label, valueText, className }) {
  const v = Math.max(0, Number(value) || 0)
  const m = Math.max(0, Number(max) || 0)
  const ratio = m > 0 ? v / m : 0
  const fill = Math.min(ratio, 1)
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={m}
      aria-valuenow={Math.min(v, m)}
      aria-valuetext={valueText}
      className={[s.meter, className].filter(Boolean).join(' ')}
      data-tone={tone}
    >
      <span className={s.meterFill} style={{ transform: `scaleX(${fill})` }} />
      {ratio > 1 && <span className={s.meterOver} />}
    </div>
  )
}
