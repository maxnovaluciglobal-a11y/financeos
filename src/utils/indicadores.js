// src/utils/indicadores.js
// Indicadores economicos Chile — fuente: mindicador.cl (datos SII/BCCh)
// Cache localStorage 24h · Fallback a constantes si offline o API falla
// NO constituye asesoría financiera ni tributaria

const LS_KEY = 'fnos_indicadores_v1'
const TTL_MS = 24 * 60 * 60 * 1000
const BASE    = 'https://mindicador.cl/api'

// Estos tres valores envejecen apenas mindicador.cl esté caído más de 24h — no
// hay forma de que este archivo "se mantenga solo" al día. Por eso el consumidor
// (Debts/index.jsx) expone result.source al usuario cuando cae acá, en vez de
// mostrar el valor de respaldo como si fuera el del día.
export const FALLBACK = {
  utm:   71649,  // UTM agosto 2026
  uf:    40854,  // UF agosto 2026
  dolar: 975,    // USD/CLP referencial
}

// ── Parámetros previsionales Chile ─────────────────────────────────────────
// Viven acá, junto a UTM/UF, porque son del mismo tipo: valores que caducan
// cada año y hay que renovar a mano. mindicador.cl NO los publica, así que no
// hay forma de refrescarlos por API — la única vía es editar este bloque.
//
// Topes imponibles 2026 — Superintendencia de Pensiones, vigentes desde las
// remuneraciones de febrero 2026 (art. 16 DL 3.500 y art. 6 Ley 19.728).
// Fuente: www.spensiones.cl/portal/institucional/594/w3-article-16921.html
// (comunicado del 10-feb-2026; consultado el 19-oct-2026: 90,0 UF y 135,2 UF).
// Histórico: 2025 fueron 87,8 UF y 131,9 UF.
export const TOPE_AFP_SALUD_UF = 90.0   // AFP + salud + ley de accidentes del trabajo
export const TOPE_CESANTIA_UF  = 135.2  // seguro de cesantía

// Auditoría 2026-08-27: estos dos topes (y COMISION_AFP_PROMEDIO_PCT abajo) no
// tienen ninguna fuente en vivo — a diferencia de UTM/UF, envejecen en silencio
// si nadie vuelve a este archivo cada enero. Este chequeo no los actualiza (no
// hay forma de hacerlo automático sin una fuente pública), pero al menos deja
// de ser silencioso: avisa en consola si el año corriente ya pasó el vigente.
const TOPES_VIGENTES_DESDE_ANO = 2026
if (new Date().getFullYear() > TOPES_VIGENTES_DESDE_ANO) {
  console.warn(
    `[MOY IQ] TOPE_AFP_SALUD_UF/TOPE_CESANTIA_UF/COMISION_AFP_PROMEDIO_PCT en indicadores.js están vigentes desde ${TOPES_VIGENTES_DESDE_ANO} — revisar contra spensiones.cl y actualizar TOPES_VIGENTES_DESDE_ANO.`
  )
}

// Comisión de administración AFP, en % de la renta imponible. Es un PROMEDIO
// simple de las 7 AFP, NO la comisión exacta de la AFP del usuario. Fuente:
// www.spensiones.cl/portal/institucional/594/w3-article-2810.html
// (consultado el 19-oct-2026): Capital 1,44 · Cuprum 1,44 · Habitat 1,27 ·
// Modelo 0,58 · PlanVital 1,16 · Provida 1,45 · Uno 0,46 → 7,80 / 7 = 1,11.
// (C-43: el código decía 1,17 y un mínimo de 0,49; la más barata hoy es Uno, 0,46.)
// El formulario todavía no permite elegir AFP; cuando lo permita, reemplazar
// este promedio por la comisión real.
export const COMISION_AFP_PROMEDIO_PCT = 1.11
export const COMISION_AFP_MIN_PCT = 0.46
export const COMISION_AFP_MAX_PCT = 1.45

// C-43: revisión de estos parámetros. officialValues.test.js falla después de
// `proximaRevision`: actualizar contra las fuentes de arriba y mover la fecha.
export const REVISION_PREVISIONAL_CL = { verificadoEl: '2026-10-19', proximaRevision: '2027-02-15' }

function getCached() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Date.now() - data.ts > TTL_MS) return null
    return data
  } catch { return null }
}

async function fetchVal(code) {
  const res  = await fetch(`${BASE}/${code}`)
  const data = await res.json()
  return data.serie?.[0]?.valor ?? null
}

export async function loadIndicadores() {
  const cached = getCached()
  if (cached) return cached

  try {
    const [utm, uf, dolar] = await Promise.all([
      fetchVal('utm'),
      fetchVal('uf'),
      fetchVal('dolar'),
    ])
    if (!utm || !uf) throw new Error('sin datos')
    const result = {
      utm, uf,
      dolar: dolar || FALLBACK.dolar,
      ts:     Date.now(),
      source: 'api',
    }
    localStorage.setItem(LS_KEY, JSON.stringify(result))
    return result
  } catch {
    return { ...FALLBACK, ts: Date.now(), source: 'fallback' }
  }
}
