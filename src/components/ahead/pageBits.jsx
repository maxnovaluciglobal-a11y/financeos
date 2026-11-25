// src/components/ahead/pageBits.jsx — piezas chicas de cuotas y "pagado este
// mes" para pantallas que ya existen (Fijos, Suscripciones). Las pantallas las
// cargan con lazy(): así no suman imports estáticos nuevos a sus trozos y el
// mapa de precarga de la entrada no crece (scripts/bundleBudget.js). Cada
// pieza se pinta recién cuando sus textos están en el idioma activo.
import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { FormGroup, FormRow } from '../ui/index.jsx'
import { monthPlan } from '../../utils/recurring.js'
import { monthStatusOf, ruleInstallmentAt } from '../../utils/ahead.js'
import { useAheadStrings } from '../../i18n/ahead/index.js'
import s from './ahead.module.css'

// Id de la regla de una suscripción (subRuleId de recurringSources.js), sin
// importarlo: la entrada tendría que exportarlo.
const subRuleId = (id) => `rs-${id}`

function Paid({ t }) {
  return <span className={s.paid}><Check size={14} strokeWidth={2.4} aria-hidden="true" />{t('ahead.paid')}</span>
}

// Meta de una regla en la lista de Fijos: "Cuota 4 de 12" (de la próxima
// ocurrencia) y ✓ "Pagado este mes". `plan` = monthPlan del mes calendario.
export function RuleAheadMeta({ rule, next, plan, today }) {
  const { t, ready } = useAheadStrings()
  if (!ready) return null
  const inst = next ? ruleInstallmentAt(rule, next) : null
  const paid = monthStatusOf(rule.id, plan, today) === 'paid'
  return (
    <>
      {inst && <span className="num">{t('ahead.inst', inst)}</span>}
      {paid && <Paid t={t} />}
    </>
  )
}

// Campos opcionales de cuotas del formulario de un fijo manual.
export function InstallmentFields({ total, before, onChange }) {
  const { t, ready } = useAheadStrings()
  if (!ready) return null
  return (
    <>
      <FormRow>
        <FormGroup label={t('ahead.form.instTotal')}>
          <input type="number" inputMode="numeric" min="0" step="1" value={total} placeholder="0" onChange={e => onChange('instTotal', e.target.value)} />
        </FormGroup>
        <FormGroup label={t('ahead.form.instBefore')}>
          <input type="number" inputMode="numeric" min="0" step="1" value={before} placeholder="0" disabled={!(Number(total) > 0)} onChange={e => onChange('instBefore', e.target.value)} />
        </FormGroup>
      </FormRow>
      <p className={s.sub} style={{ marginTop: -4 }}>{t('ahead.form.instHint')}</p>
    </>
  )
}

// ✓ "Pagado este mes" de una suscripción (su regla de fijos, ya confirmada).
export function SubPaidMark({ subId, recurring, incomes, expenses, today }) {
  const { t, ready } = useAheadStrings()
  const plan = useMemo(() => monthPlan((recurring || []).filter(r => r?.id === subRuleId(subId)), today.slice(0, 7), { incomes, expenses, today }),
    [recurring, subId, incomes, expenses, today])
  if (!ready || monthStatusOf(subRuleId(subId), plan, today) !== 'paid') return null
  return <span style={{ display: 'flex', marginTop: 2 }}><Paid t={t} /></span>
}
