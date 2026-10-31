// src/components/ui/EmptyPreview.jsx — lo que verá la persona cuando cargue datos
// (bloque "Ahora", 31-oct-2026). Solo formas, sin cifras: no se puede confundir
// con datos reales ni necesita traducción. Es decorativo para el lector de
// pantalla: el título y el texto del estado vacío ya dicen todo.
import s from './emptyPreview.module.css'

const Row = ({ w, tone = 'pos' }) => (
  <div className={s.row}>
    <span className={s.dot} />
    <span className={s.rowBody}>
      <span className={s.label} />
      <span className={s.track}><span className={s.fill} data-tone={tone} style={{ transform: `scaleX(${w})` }} /></span>
    </span>
  </div>
)

function Ring() {
  return (
    <svg className={s.ring} viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="26" className={s.ringBg} />
      <circle cx="32" cy="32" r="26" className={s.ringOn} pathLength="100" strokeDasharray="68 100" transform="rotate(-90 32 32)" />
    </svg>
  )
}

const KINDS = {
  budgets: <><Ring /><div className={s.rows}><Row w={0.72} /><Row w={0.46} /><Row w={0.91} tone="warn" /></div></>,
  goals: <div className={s.rows}><Row w={0.34} /><Row w={0.62} /><Row w={0.18} /></div>,
  debts: <div className={s.rows}><Row w={0.8} tone="neg" /><Row w={0.52} tone="neg" /><Row w={0.27} /></div>,
}

export default function EmptyPreview({ kind }) {
  return <div className={s.preview} aria-hidden="true">{KINDS[kind]}</div>
}
