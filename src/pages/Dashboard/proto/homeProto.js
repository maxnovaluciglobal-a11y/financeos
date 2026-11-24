// src/pages/Dashboard/proto/homeProto.js — interruptor de los prototipos del
// Inicio v2 (24-nov-2026, rama proto/home-v2, para que Walter los compare en el
// teléfono). `?home=a|b|c` elige una variante y la recuerda en la pestaña
// (sessionStorage), así sobrevive a ir a Movimientos y volver; `?home=off` (o
// cualquier otro valor) vuelve al Inicio de siempre. Sin el parámetro y sin
// nada guardado, el Inicio es el de producción, sin cambios.

export const HOME_PROTO_KEY = 'fos_home_proto'
export const HOME_PROTO_VARIANTS = Object.freeze(['a', 'b', 'c'])

/** Variante activa ('a' | 'b' | 'c') o null. Pura: recibe search y storage. */
export function homeProtoVariant({ search = '', session = null } = {}) {
  let q = null
  try { q = new URLSearchParams(search).get('home') } catch { q = null }
  if (q != null) {
    const v = String(q).trim().toLowerCase()
    const ok = HOME_PROTO_VARIANTS.includes(v) ? v : null
    try { ok ? session?.setItem(HOME_PROTO_KEY, ok) : session?.removeItem(HOME_PROTO_KEY) } catch { /* modo privado: solo vale la URL */ }
    return ok
  }
  try {
    const saved = session?.getItem(HOME_PROTO_KEY)
    return HOME_PROTO_VARIANTS.includes(saved) ? saved : null
  } catch { return null }
}

/** Lectura en el navegador (location + sessionStorage). */
export function currentHomeProto() {
  let session = null
  try { session = typeof sessionStorage !== 'undefined' ? sessionStorage : null } catch { session = null }
  return homeProtoVariant({ search: typeof location !== 'undefined' ? location.search : '', session })
}
