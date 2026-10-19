// src/utils/taxCalcDE.js
// Cálculo orientativo de descuentos salariales — Alemania (Lohnabzüge)
// NO constituye asesoría tributaria. Estimación simplificada: no reemplaza
// al cálculo real de Lohnsteuer (que depende de Steuerklasse, Freibeträge
// individuales y la tabla oficial del BMF). Asume Steuerklasse I (soltero).
// Cifras vigentes 2026 — actualizar anualmente contra bmf-steuerrechner.de

// Tarifas de contribuciones sociales (Sozialversicherung) — parte del empleado.
// Fuente: valores de referencia 2026, aportes compartidos empleado/empleador al 50%.
const RENTENVERSICHERUNG = 0.093   // 18.6% total → 9.3% empleado
const ARBEITSLOSENVERS   = 0.013   // 2.6% total → 1.3% empleado
const PFLEGEVERSICHERUNG = 0.018   // 3.6% total → 1.8% empleado (reparto normal 50/50)
const KRANKENVERS_BASE   = 0.073   // 14.6% total → 7.3% empleado
const KRANKENVERS_ZUSATZ = 0.0145  // Zusatzbeitrag promedio 2026: 2.9% total → 1.45% empleado

// Pflegeversicherung — dos particularidades del reparto:
// 1) Sajonia (SN) nunca eliminó el Buß- und Bettag como feriado, así que el
//    reparto NO es 50/50: el empleado paga 2.3% y el empleador 1.3%.
// 2) Kinderlosenzuschlag: +0.6% a cargo ÍNTEGRO del empleado si tiene más de
//    23 años y no tiene hijos (§55 Abs. 3 SGB XI).
const PFLEGEVERSICHERUNG_SN = 0.023 // Sajonia: 2.3% empleado / 1.3% empleador
const PFLEGE_KINDERLOS_ZUSCHLAG = 0.006

// Beitragsbemessungsgrenze (tope de cotización) 2026
const BBG_RV_MENSUAL = 8450   // € — tope RV/ALV (101.400 €/año)
const BBG_KV_MENSUAL = 5812.5 // € — tope KV/PV (69.750 €/año)

// Solidaritätszuschlag 2026: 5.5% del impuesto, con Freigrenze y Milderungszone.
// Por debajo de la Freigrenze no se paga nada; justo por encima el Soli se
// limita al 11.9% de la diferencia (§4 SolzG) hasta converger con el 5.5% plano.
const SOLI_FREIGRENZE_ANUAL = 20350 // € de Lohnsteuer anual (soltero; matrimonio: 40.700)
const SOLI_TASA = 0.055
const SOLI_MILDERUNG_TASA = 0.119

// Kirchensteuer por Bundesland — 8% en Baviera y Baden-Württemberg, 9% el resto
const KIRCHENSTEUER_8PCT_STATES = ['BY', 'BW']

// Deducciones a tanto alzado que reducen la base imponible (zvE) de todo empleado
export const ARBEITNEHMER_PAUSCHBETRAG = 1230 // € — Werbungskosten-Pauschbetrag (§9a EStG)
export const SONDERAUSGABEN_PAUSCHBETRAG = 36 // € — §10c EStG

// Parámetros para aproximar la Vorsorgepauschale (§39b Abs. 2 EStG):
// la parte de KV que se considera "Basisversorgung" se calcula al Beitragssatz
// ermäßigt (14.0% total → 7.0% empleado) y se reduce un 4% por el componente
// de Krankengeld (§10 Abs. 1 Nr. 3a EStG).
const KV_ERMAESSIGT_EMPLEADO = 0.07
const KV_KRANKENGELD_ABSCHLAG = 0.04

// Auditoría 2026-08-27: a diferencia de UTM/UF de Chile (fetch en vivo contra
// mindicador.cl), TODAS las cifras de este archivo — Beitragsbemessungsgrenzen,
// tasas de Sozialversicherung, umbrales de Soli, tarifa §32a — son constantes
// sin ninguna fuente en vivo (Alemania no publica un indicador público
// equivalente). Envejecen en silencio cada Jahreswechsel si nadie vuelve acá.
// Este chequeo no las actualiza, pero al menos avisa en consola en vez de
// mostrar con total confianza cifras del año pasado.
const DE_VIGENTE_DESDE_ANO = 2026
if (new Date().getFullYear() > DE_VIGENTE_DESDE_ANO) {
  console.warn(
    `[MOY IQ] taxCalcDE.js está calibrado para ${DE_VIGENTE_DESDE_ANO} — revisar Beitragsbemessungsgrenzen/tarifa §32a contra bmf-steuerrechner.de y actualizar DE_VIGENTE_DESDE_ANO.`
  )
}

/**
 * Parámetros de la tarifa del §32a EStG para 2026.
 * Se exportan porque la escala de tasa marginal (config/deducciones/de.js)
 * deriva de aquí — una sola fuente de verdad para los umbrales.
 */
export const ESTG_2026 = {
  grundfreibetrag: 12348, // fin zona 1
  zona2Fin: 17799,
  zona3Fin: 69878,
  zona4Fin: 277825,
  z2a: 914.51, z2b: 1400,
  z3a: 173.10, z3b: 2397, z3c: 1034.87,
  z4m: 0.42, z4b: 11135.63,
  z5m: 0.45, z5b: 19470.38,
}

// Tasa de Pflegeversicherung a cargo del empleado según Bundesland e hijos.
function pflegeTasaEmpleado(bundesland, hatKinder) {
  const base = bundesland === 'SN' ? PFLEGEVERSICHERUNG_SN : PFLEGEVERSICHERUNG
  return base + (hatKinder ? 0 : PFLEGE_KINDERLOS_ZUSCHLAG)
}

/**
 * Contribuciones sociales mensuales a cargo del empleado.
 * @param {number} bruttoMensual
 * @param {object} opts
 * @param {string}  opts.bundesland — 'SN' cambia el reparto de Pflegeversicherung
 * @param {boolean} opts.hatKinder  — true = tiene hijos → sin Kinderlosenzuschlag
 */
export function calcSozialversicherung(bruttoMensual, opts = {}) {
  const { bundesland = 'NW', hatKinder = false } = opts
  const baseRV = Math.min(bruttoMensual, BBG_RV_MENSUAL)
  const baseKV = Math.min(bruttoMensual, BBG_KV_MENSUAL)

  const rentenversicherung = Math.round(baseRV * RENTENVERSICHERUNG)
  const arbeitslosenversicherung = Math.round(baseRV * ARBEITSLOSENVERS)
  const pflegeversicherung = Math.round(baseKV * pflegeTasaEmpleado(bundesland, hatKinder))
  const krankenversicherung = Math.round(baseKV * (KRANKENVERS_BASE + KRANKENVERS_ZUSATZ))

  const total = rentenversicherung + arbeitslosenversicherung + pflegeversicherung + krankenversicherung

  return { rentenversicherung, arbeitslosenversicherung, pflegeversicherung, krankenversicherung, total }
}

/**
 * Aproximación de la Vorsorgepauschale (§39b Abs. 2 Satz 5 Nr. 3 EStG): la parte
 * de las cotizaciones sociales del empleado que reduce la base del Lohnsteuer.
 *
 * ⚠ APROXIMACIÓN, no la fórmula oficial completa. La norma real tiene reglas más
 * finas (Mindestvorsorgepauschale, topes por Steuerklasse, tratamiento distinto
 * para asegurados privados y para el Arbeitgeberzuschuss). Aquí se usa:
 *   · Rentenversicherung: 100% del aporte del empleado (deducible al 100% desde 2023)
 *   · Krankenversicherung: aporte calculado al Beitragssatz ermäßigt (7.0%) + Zusatzbeitrag,
 *     reducido un 4% por el componente de Krankengeld
 *   · Pflegeversicherung: 100% del aporte del empleado (incluye Sajonia y Kinderlosenzuschlag)
 * Todo sujeto a las Beitragsbemessungsgrenzen.
 *
 * @returns {number} importe ANUAL deducible
 */
export function calcVorsorgepauschale(bruttoAnual, opts = {}) {
  const { bundesland = 'NW', hatKinder = false } = opts
  const b = Math.max(0, Number(bruttoAnual) || 0)
  const baseRV = Math.min(b, BBG_RV_MENSUAL * 12)
  const baseKV = Math.min(b, BBG_KV_MENSUAL * 12)

  const teilRV = baseRV * RENTENVERSICHERUNG
  const teilKV = baseKV * (KV_ERMAESSIGT_EMPLEADO + KRANKENVERS_ZUSATZ) * (1 - KV_KRANKENGELD_ABSCHLAG)
  const teilPV = baseKV * pflegeTasaEmpleado(bundesland, hatKinder)

  return teilRV + teilKV + teilPV
}

/**
 * Base imponible anual (zu versteuerndes Einkommen, zvE) a partir del bruto anual.
 * Resta, en orden: Werbungskosten (reales si superan el Pauschbetrag de 1.230 €,
 * si no el Pauschbetrag), Sonderausgaben-Pauschbetrag (36 €) y Vorsorgepauschale.
 */
export function calcZvE(bruttoAnual, opts = {}) {
  const { werbungskostenAnual = 0, bundesland = 'NW', hatKinder = false } = opts
  const b = Math.max(0, Number(bruttoAnual) || 0)
  const werbungskosten = Math.max(Number(werbungskostenAnual) || 0, ARBEITNEHMER_PAUSCHBETRAG)
  const vorsorge = calcVorsorgepauschale(b, { bundesland, hatKinder })
  return Math.max(0, b - werbungskosten - SONDERAUSGABEN_PAUSCHBETRAG - vorsorge)
}

/**
 * Einkommensteuer anual — fórmula continua del §32a EStG 2026 (sin redondear).
 * Cinco zonas: exención, dos zonas de progresión polinómica y dos lineales.
 * @param {number} zvE — renta imponible anual en €
 */
export function impuestoESt(zvE) {
  const x = Math.max(0, Number(zvE) || 0)
  const P = ESTG_2026

  if (x <= P.grundfreibetrag) return 0
  if (x <= P.zona2Fin) {
    const y = (x - P.grundfreibetrag) / 10000
    return (P.z2a * y + P.z2b) * y
  }
  if (x <= P.zona3Fin) {
    const z = (x - P.zona2Fin) / 10000
    return (P.z3a * z + P.z3b) * z + P.z3c
  }
  if (x <= P.zona4Fin) return P.z4m * x - P.z4b
  return P.z5m * x - P.z5b
}

/**
 * Igual que impuestoESt pero redondeado a euros enteros, como manda la ley
 * (el importe de la tarifa se redondea al euro inferior; aquí al más cercano
 * porque la diferencia es irrelevante para una estimación).
 */
export function estimarImpuestoAnual(zvE) {
  return Math.round(impuestoESt(zvE))
}

/**
 * Solidaritätszuschlag anual con Freigrenze y Milderungszone (§4 SolzG).
 * Por encima de la Freigrenze el recargo se limita al 11.9% del exceso hasta
 * que ese límite alcanza el 5.5% plano — se aplica el menor de los dos.
 */
export function calcSoliAnual(lohnsteuerAnual) {
  const t = Math.max(0, Number(lohnsteuerAnual) || 0)
  if (t <= SOLI_FREIGRENZE_ANUAL) return 0
  return Math.min(SOLI_TASA * t, SOLI_MILDERUNG_TASA * (t - SOLI_FREIGRENZE_ANUAL))
}

/**
 * Calcula el desglose completo de descuentos salariales alemanes.
 * @param {number} bruttoMensual — sueldo bruto mensual en EUR
 * @param {object} opts
 * @param {boolean} opts.kirchensteuerpflichtig — si paga impuesto eclesiástico
 * @param {string}  opts.bundesland — código de 2 letras (BY, BW, NW, SN, ...)
 * @param {boolean} opts.hatKinder — true si tiene hijos (evita el Kinderlosenzuschlag)
 * @param {number}  opts.werbungskostenAnual — gastos laborales reales anuales
 */
export function calcDescuentosDE(bruttoMensual, opts = {}) {
  const {
    kirchensteuerpflichtig = false,
    bundesland = 'NW',
    hatKinder = false,
    werbungskostenAnual = 0,
  } = opts

  if (!bruttoMensual || bruttoMensual <= 0) {
    return {
      sozialversicherung: { rentenversicherung: 0, arbeitslosenversicherung: 0, pflegeversicherung: 0, krankenversicherung: 0, total: 0 },
      lohnsteuer: 0, soli: 0, kirchensteuer: 0, totalAbzuege: 0, netto: 0, tasaEfectiva: 0,
      zvE: 0, impuestoAnual: 0,
    }
  }

  const sozialversicherung = calcSozialversicherung(bruttoMensual, { bundesland, hatKinder })

  const bruttoAnual = bruttoMensual * 12
  const zvE = calcZvE(bruttoAnual, { werbungskostenAnual, bundesland, hatKinder })

  // Se conserva el valor sin redondear para derivar Soli y Kirchensteuer sin
  // arrastrar el error de redondeo intermedio.
  const impuestoAnualExacto = impuestoESt(zvE)
  const impuestoAnual = Math.round(impuestoAnualExacto)
  const lohnsteuerMensual = Math.round(impuestoAnualExacto / 12)

  const soliMensual = Math.round(calcSoliAnual(impuestoAnualExacto) / 12)

  const tasaKirche = KIRCHENSTEUER_8PCT_STATES.includes(bundesland) ? 0.08 : 0.09
  // NOTA: la Kirchensteuer real se calcula sobre una Bemessungsgrundlage que
  // aplica el Kinderfreibetrag aunque no se use en el Lohnsteuer — aquí se
  // omite (efecto de decenas de € al año, solo con hijos).
  const kirchensteuerMensual = kirchensteuerpflichtig
    ? Math.round((impuestoAnualExacto * tasaKirche) / 12)
    : 0

  const totalAbzuege = sozialversicherung.total + lohnsteuerMensual + soliMensual + kirchensteuerMensual
  const netto = Math.round(bruttoMensual - totalAbzuege)
  const tasaEfectiva = bruttoMensual > 0 ? totalAbzuege / bruttoMensual : 0

  return {
    sozialversicherung,
    lohnsteuer: lohnsteuerMensual,
    soli: soliMensual,
    kirchensteuer: kirchensteuerMensual,
    totalAbzuege,
    netto,
    tasaEfectiva,
    zvE,
    impuestoAnual,
  }
}

export const BUNDESLAENDER = [
  { code: 'BW', label: 'Baden-Württemberg' },
  { code: 'BY', label: 'Bayern' },
  { code: 'BE', label: 'Berlin' },
  { code: 'BB', label: 'Brandenburg' },
  { code: 'HB', label: 'Bremen' },
  { code: 'HH', label: 'Hamburg' },
  { code: 'HE', label: 'Hessen' },
  { code: 'MV', label: 'Mecklenburg-Vorpommern' },
  { code: 'NI', label: 'Niedersachsen' },
  { code: 'NW', label: 'Nordrhein-Westfalen' },
  { code: 'RP', label: 'Rheinland-Pfalz' },
  { code: 'SL', label: 'Saarland' },
  { code: 'SN', label: 'Sachsen' },
  { code: 'ST', label: 'Sachsen-Anhalt' },
  { code: 'SH', label: 'Schleswig-Holstein' },
  { code: 'TH', label: 'Thüringen' },
]
