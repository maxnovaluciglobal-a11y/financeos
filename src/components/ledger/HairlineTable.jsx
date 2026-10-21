// src/components/ledger/HairlineTable.jsx — tabla sin marco (firma "Hairline Table" de Invest, UI-L1)
//
// Sin caja, sin relleno, sin sombra: encabezado en Plex Sans 12/600 tinta
// secundaria con una línea del 18 %, filas con líneas del 10 %, primera y
// última columna al ras de la sección. Las columnas de cifras van a la
// derecha (`num: true`) y en .num (tabulares).
//
// columns: [{ key, label, num?, render?(row) }]
// rows:    [{ key, ...valores }]
// caption: título accesible de la tabla (puede ir oculto con hideCaption).
import s from './ledger.module.css'

export default function HairlineTable({ columns, rows, caption, hideCaption = false, foot, className }) {
  return (
    <table className={[s.table, className].filter(Boolean).join(' ')}>
      {caption && <caption className={hideCaption ? 'sr-only' : s.caption}>{caption}</caption>}
      <thead>
        <tr>
          {columns.map(c => <th key={c.key} scope="col" className={c.num ? s.numCell : undefined}>{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.key} data-highlight={r.highlight ? '' : undefined}>
            {columns.map((c, i) => {
              const content = c.render ? c.render(r) : r[c.key]
              const cls = c.num ? `num ${s.numCell}` : undefined
              return i === 0
                ? <th key={c.key} scope="row" className={cls}>{content}</th>
                : <td key={c.key} className={cls}>{content}</td>
            })}
          </tr>
        ))}
      </tbody>
      {foot && (
        <tfoot>
          <tr>
            {columns.map((c, i) => {
              const content = foot[c.key] ?? ''
              const cls = c.num ? `num ${s.numCell}` : undefined
              return i === 0
                ? <th key={c.key} scope="row" className={cls}>{content}</th>
                : <td key={c.key} className={cls}>{content}</td>
            })}
          </tr>
        </tfoot>
      )}
    </table>
  )
}
