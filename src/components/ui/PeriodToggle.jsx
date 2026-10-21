// src/components/ui/PeriodToggle.jsx
// Selector Anual / Mensual de Pro (LicenseGate y Ajustes), igual que el de la
// landing: el anual lleva el ahorro calculado desde config.pricing. Botones con
// aria-pressed, como los demás chips de la app. Auditoría 360, C-03 / COM-3.
import { useT } from '../../i18n/useT.js'
import { annualSavingPct } from '../../utils/pricing.js'
import { fmtPctPoints } from '../../utils/index.js'

export default function PeriodToggle({ value, onChange }) {
  const { t } = useT()
  const options = [
    { value: 'annual', label: `${t('billing.period.annual')} ${t('billing.period.save', { pct: fmtPctPoints(annualSavingPct()) })}` },
    { value: 'monthly', label: t('billing.period.monthly') },
  ]
  return (
    <div role="group" aria-label={t('billing.period.label')} style={{ display: 'flex', gap: 8 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="fos-chip fos-chip--tall"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          style={{ flex: 1, whiteSpace: 'nowrap' }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
