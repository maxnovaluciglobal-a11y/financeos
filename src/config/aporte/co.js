// src/config/aporte/co.js
// Colombia — Aportes a AFC / Pensiones Voluntarias con beneficio fiscal (renta exenta).
// Fuente: DIAN (Art. 126-1 / 126-4 / 206 num. 10 / 241 / 336 ET). Vigencia 2026. UVT 2026 = $52.374.
//
// Dos límites que se suman (APP-CO-336, auditoría 360):
//   1. Art. 126-1 / 126-4: el aporte exento es el menor entre 30 % del ingreso y 3.800 UVT.
//   2. Art. 336 (Ley 2277 de 2022): TODAS las rentas exentas y deducciones de la cédula
//      general (AFC, pensión voluntaria, la renta exenta del 25 % del art. 206 num. 10, intereses
//      de vivienda, prepagada…) no pueden pasar del 40 % del ingreso neto (ingreso menos ingresos
//      no constitutivos de renta, como los aportes obligatorios a pensión y salud) ni de 1.340 UVT.
//   El 25 % (tope 790 UVT) se calcula sobre el ingreso neto después de restar las demás rentas
//   exentas y deducciones: por eso aportar X a la AFC baja la renta gravable menos que X.
// Ejemplo de la guía de la landing (blog/afc-pension-voluntaria-renta-exenta-colombia):
// ingreso $120M, neto $108M, AFC $24M → la renta gravable baja $16,2M y el ahorro es $3.078.000.

import { tasaMarginal, impuestoProgresivo } from '../../utils/marginal.js'

export const UVT = 52374                 // DIAN Res. 000238 de 2025
export const TOPE_UVT_PENSION = 3800     // Art. 126-1 / 126-4: menor entre 30 % del ingreso y 3.800 UVT
export const TOPE_UVT_GLOBAL = 1340      // Art. 336: menor entre 40 % del ingreso neto y 1.340 UVT
export const TOPE_UVT_25 = 790           // Art. 206 num. 10: renta exenta del 25 %, hasta 790 UVT al año
export const PCT_OBLIGATORIOS = 0.08     // Estimación si no se informa: 4 % pensión + 4 % salud del trabajador

// Tarifa cédula general (renta líquida gravable, en UVT). Art. 241 ET.
const BR_UVT = [
  { hasta: 1090,     rate: 0.00 },
  { hasta: 1700,     rate: 0.19 },
  { hasta: 4100,     rate: 0.28 },
  { hasta: 8670,     rate: 0.33 },
  { hasta: 18970,    rate: 0.35 },
  { hasta: 31000,    rate: 0.37 },
  { hasta: Infinity, rate: 0.39 },
]
// Brackets en COP (UVT × valor)
const BR = BR_UVT.map(b => ({ hasta: b.hasta === Infinity ? Infinity : b.hasta * UVT, rate: b.rate }))

const fmtCOP = (n) => '$' + Math.round(n).toLocaleString('es-CO')

// Renta líquida gravable de la cédula general con un aporte exento `afc` (ya limitado al 30 % / 3.800 UVT).
export function rentaGravableCO({ ingresoNeto, afc, otras }) {
  const base25 = Math.max(0, ingresoNeto - afc - otras)
  const exenta25 = Math.min(0.25 * base25, TOPE_UVT_25 * UVT)
  const topeGlobal = Math.min(0.40 * ingresoNeto, TOPE_UVT_GLOBAL * UVT)
  const beneficios = Math.min(afc + otras + exenta25, Math.max(0, topeGlobal))
  return Math.max(0, ingresoNeto - beneficios)
}

export default {
  pais: 'CO',
  nombre: 'Colombia',
  moneda: 'COP',
  sym: '$',
  vigencia: 2026,
  fuente: 'DIAN',
  titulo: 'Ahorro fiscal por aportes a AFC / Pensión Voluntaria',
  subtitulo: 'Estima cuánto baja tu renta gravable aportando a cuentas con beneficio fiscal',
  disclaimer: 'Estimación educativa, no asesoría tributaria. Aplica los dos límites: 30 % / 3.800 UVT del aporte (Art. 126-1 y 126-4 ET) y el global de 40 % / 1.340 UVT (Art. 336 ET), compartido con la renta exenta del 25 %. No incluye dependientes ni la permanencia mínima. Consulta a un contador o a la DIAN.',
  ingresoLabel: 'Ingreso laboral anual (COP)',
  aporteLabel: 'Aporte anual planeado a AFC/Pensión Voluntaria (COP)',
  // Campos adicionales que renderiza AhorroFiscal (opcionales: vacíos usan la estimación del hint).
  campos: [
    {
      key: 'aportesObligatorios',
      label: 'Aportes obligatorios a pensión y salud del año (COP)',
      hint: 'Si lo dejas vacío se estima en 8 % del ingreso (4 % pensión + 4 % salud).',
    },
    {
      key: 'otrasDeducciones',
      label: 'Otras deducciones y rentas exentas del año (COP)',
      hint: 'Intereses de vivienda, medicina prepagada y similares. Comparten el límite global del 40 %.',
    },
  ],
  resumenTope: 'Límites: el aporte exento es el menor entre 30 % del ingreso y 3.800 UVT (' + fmtCOP(TOPE_UVT_PENSION * UVT) + '); todas las rentas exentas y deducciones juntas, incluido el 25 %, no pasan del 40 % del ingreso neto ni de 1.340 UVT (' + fmtCOP(TOPE_UVT_GLOBAL * UVT) + ').',

  calcular({ ingresoAnual = 0, aporteAnual = 0, aportesObligatorios, otrasDeducciones = 0 }) {
    const ingreso = Math.max(0, Number(ingresoAnual) || 0)
    const aporte = Math.max(0, Number(aporteAnual) || 0)
    const oblig = aportesObligatorios === undefined || aportesObligatorios === null || aportesObligatorios === ''
      ? ingreso * PCT_OBLIGATORIOS
      : Math.max(0, Number(aportesObligatorios) || 0)
    const otras = Math.max(0, Number(otrasDeducciones) || 0)
    const ingresoNeto = Math.max(0, ingreso - oblig)

    const tope30 = Math.min(0.30 * ingreso, TOPE_UVT_PENSION * UVT)
    const gravable = (a) => rentaGravableCO({ ingresoNeto, afc: Math.min(a, tope30), otras })

    const gravableSin = gravable(0)
    const gravableCon = gravable(aporte)
    const reduccion = gravableSin - gravableCon
    const ahorro = impuestoProgresivo(BR, gravableSin) - impuestoProgresivo(BR, gravableCon)

    // Tope útil: el aporte a partir del cual la renta gravable ya no baja (por el 30 % o por el 40 %).
    // La renta gravable es no creciente en el aporte: búsqueda binaria al peso.
    const piso = gravable(tope30)
    let lo = 0, hi = tope30
    while (hi - lo > 1) {
      const mid = (lo + hi) / 2
      if (gravable(mid) > piso) lo = mid
      else hi = mid
    }
    const tope = tope30 > 0 && gravableSin > piso ? hi : 0
    const topePct = tope > 0 ? Math.min(100, (aporte / tope) * 100) : (aporte > 0 ? 100 : 0)
    const faltaParaTope = Math.max(0, tope - aporte)

    const nota = aporte > 0 && Math.round(reduccion) < Math.round(Math.min(aporte, tope30))
      ? 'Aportas ' + fmtCOP(aporte) + ' y tu renta gravable baja ' + fmtCOP(reduccion) + ': el límite global del 40 % / 1.340 UVT y la renta exenta del 25 %, que se reduce con el aporte, absorben la diferencia.'
      : null

    return {
      ahorro: Math.round(ahorro),
      deducible: Math.round(reduccion),
      tope: Math.round(tope),
      topePct,
      faltaParaTope: Math.round(faltaParaTope),
      marginal: tasaMarginal(BR, gravableSin),
      gravableSin: Math.round(gravableSin),
      gravableCon: Math.round(gravableCon),
      nota,
      resumen: 'Ahorro = impuesto sin el aporte − impuesto con él (tarifa Art. 241 ET), después del límite global del Art. 336.',
    }
  },
}
