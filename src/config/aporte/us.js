// src/config/aporte/us.js
// USA — 401(k) Traditional contribution + tax saving projector.
// Fuente: IRS (brackets 2026, 401k limit 2026). Vigencia 2026.

import { tasaMarginal, impuestoProgresivo } from '../../utils/marginal.js'
import { STANDARD_DEDUCTION_2026, limite401k } from '../../utils/taxCalcUS.js'

const LIMIT_401K = 24500          // IRS elective deferral 2026 (IRA aparte: +$7.500)

// Federal income tax brackets 2026 — single filer (taxable income). IRS.
const BR = [
  { hasta: 12400,    rate: 0.10 },
  { hasta: 50400,    rate: 0.12 },
  { hasta: 105700,   rate: 0.22 },
  { hasta: 201775,   rate: 0.24 },
  { hasta: 256225,   rate: 0.32 },
  { hasta: 640600,   rate: 0.35 },
  { hasta: Infinity, rate: 0.37 },
]

export default {
  pais: 'US',
  nombre: 'USA',
  moneda: 'USD',
  sym: '$',
  vigencia: 2026,
  fuente: 'IRS',
  titulo: '401(k) contribution tax-savings projector',
  subtitulo: 'Estimate how much federal income tax you save with Traditional 401(k) contributions',
  disclaimer: 'Educational estimate, not tax advice. Single-filer federal brackets only (ignores state tax, credits, IRA). Consult a tax professional or the IRS.',
  ingresoLabel: 'Annual gross income (USD)',
  aporteLabel: 'Planned annual 401(k) contribution (USD)',
  // Textos visibles: claves i18n (QA pre-tiendas I9). Los literales de abajo
  // quedan solo como respaldo para quien lea el config sin `t`.
  i18n: {
    titulo: 'ahorroFiscal.us.title',
    subtitulo: 'ahorroFiscal.us.sub',
    disclaimer: 'ahorroFiscal.us.disclaimer',
    ingresoLabel: 'ahorroFiscal.us.incomeLabel',
    aporteLabel: 'ahorroFiscal.us.contribLabel',
    resumenTope: 'ahorroFiscal.us.capSummary',
    resumen: 'ahorroFiscal.us.resultSummary',
  },
  // Variables de capSummary (montos con el formato de la pantalla).
  i18nVars: { limit: LIMIT_401K, ira: 7500, std: STANDARD_DEDUCTION_2026.single },
  resumenTope: 'Tope deducible: límite 401(k) ' + LIMIT_401K.toLocaleString('en-US') + ' + catch-up según edad (la IRA suma otros $7.500 aparte). Se descuenta la standard deduction ($' + STANDARD_DEDUCTION_2026.single.toLocaleString('en-US') + ') antes de aplicar los tramos.',

  // ingresoAnual es BRUTO. Los tramos BR están definidos sobre taxable income,
  // así que hay que restar la standard deduction antes de aplicarlos — si no,
  // la tasa marginal sale inflada (un bruto de $52.000 daría 22% en vez de 12%).
  calcular({ ingresoAnual = 0, aporteAnual = 0, edad = 0 }) {
    const bruto = Number(ingresoAnual) || 0
    const aporte = Number(aporteAnual) || 0
    const gravable = Math.max(0, bruto - STANDARD_DEDUCTION_2026.single)
    const topeLegal = limite401k(edad).total
    const tope = Math.min(topeLegal, bruto) // no se puede diferir más que el ingreso
    const deducible = Math.min(aporte, tope)
    const ahorro = impuestoProgresivo(BR, gravable) - impuestoProgresivo(BR, Math.max(0, gravable - deducible))
    const topePct = tope > 0 ? Math.min(100, (aporte / tope) * 100) : 0
    const faltaParaTope = Math.max(0, tope - aporte)
    return {
      ahorro: Math.round(ahorro),
      deducible: Math.round(deducible),
      tope: Math.round(tope),
      topePct,
      faltaParaTope: Math.round(faltaParaTope),
      gravable: Math.round(gravable),
      marginal: tasaMarginal(BR, gravable),
      resumen: 'Saving = tax without the contribution − tax with it (federal brackets, single, after standard deduction).',
    }
  },
}
