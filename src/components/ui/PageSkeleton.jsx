// src/components/ui/PageSkeleton.jsx
// Reemplaza el "Cargando..." de texto plano entre el cambio de página lazy-loaded
// (App.jsx / DemoShell.jsx) por bloques pulsantes con la silueta genérica de una
// página del dashboard (título + fila de KPIs + card grande) — no es exacto por
// página (eso requeriría un skeleton a medida por cada una de las 26+ páginas),
// pero evita el "flash de texto" que es uno de los tells más notorios de web.
import styles from './pageSkeleton.module.css'

export default function PageSkeleton() {
  return (
    <div aria-hidden="true" style={{ padding: '14px 0' }}>
      <div className={styles.bar} style={{ width: '40%', height: 22, marginBottom: 18 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[0, 1, 2].map(i => <div key={i} className={styles.bar} style={{ height: 74 }} />)}
      </div>
      <div className={styles.bar} style={{ height: 160 }} />
    </div>
  )
}
