// src/pages/Dashboard/MonthVerdict.jsx
// "Número héroe" del mes — una respuesta clara y grande: ¿te sobra o te falta?
// Inspirado en la claridad de apps como Kentra ("¿ganas o pierdes?"), pero con
// el dato honesto de FinanceOS: el DISPONIBLE REAL (freeFlow) = ingresos − gastos
// − deudas − suscripciones. No es el saldo del banco; es lo que de verdad queda.
import CountUp from '../../components/CountUp.jsx'
import Money from '../../components/Money.jsx'
import { useT } from '../../i18n/useT.js'
import { moneyLocale } from '../../utils/index.js'

// embedded: sin el chrome propio de .card (padding/fondo/borde) — para
// componerlo junto al anillo dentro de la card hero fusionada de Dashboard.
export default function MonthVerdict({ freeFlow, hasData, sym, month, embedded = false }) {
  const { t } = useT()

  const positive = freeFlow > 0
  const tight    = freeFlow === 0
  const color = !hasData ? 'var(--th)'
    : positive ? 'var(--pos)'
    : tight    ? 'var(--warn)'
    : 'var(--neg)'
  const bg = !hasData ? 'var(--sur)'
    : positive ? 'color-mix(in srgb, var(--pos) 8%, var(--sur))'
    : tight    ? 'color-mix(in srgb, var(--warn) 8%, var(--sur))'
    : 'color-mix(in srgb, var(--neg) 8%, var(--sur))'

  const label = !hasData ? '' : positive ? t('verdict.surplus') : tight ? t('verdict.tight') : t('verdict.deficit')
  const sub   = !hasData ? '' : positive || tight ? t('verdict.sub') : t('verdict.subDeficit')

  const content = (
    <>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--th)' }}>
        {t('verdict.eyebrow')} · {month}
      </div>

      {!hasData ? (
        <div style={{ fontSize: 15, color: 'var(--tm)', fontWeight: 500, marginTop: 2 }}>
          {t('verdict.noData')}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13.5, color: 'var(--tm)', fontWeight: 500 }}>{label}</div>
          <div className="num-hero" style={{
            // embedded comparte fila con el anillo (96px) — un fs-hero pensado para
            // el ancho completo de la card se metía debajo del anillo en pantallas
            // angostas. clamp() lo achica solo en ese modo, nunca en el standalone.
            fontSize: embedded ? 'clamp(26px, 9vw, 38px)' : 'var(--fs-hero)',
            color, lineHeight: 1.0, overflowWrap: 'anywhere',
          }}>
            {freeFlow < 0 ? '−' : ''}<Money>{sym}<CountUp value={Math.abs(freeFlow)} format={(v) => Math.round(v).toLocaleString(moneyLocale())} /></Money>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--th)', fontFamily: 'var(--mono)', marginTop: 2 }}>{sub}</div>
        </>
      )}
    </>
  )

  if (embedded) return <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>{content}</div>

  return (
    <div className="card rise" style={{
      padding: '18px 20px', height: '100%', background: bg,
      border: `.5px solid color-mix(in srgb, ${color} 35%, transparent)`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
    }}>
      {content}
    </div>
  )
}
