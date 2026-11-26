// src/pages/Investments/reglas/rulePrefs.js — la regla vigente de la persona
// (escalera y condición de RSI), compartida entre Planificar › Tus tramos, que
// la edita, y "Tus reglas hoy" en Resumen, que la lee. Sin tickers: solo la
// clave de la escalera y un 0/1. Si el almacenamiento no está (modo privado),
// vale lo de por defecto.
import { LADDERS } from '../../../utils/investPlan.js'
import { DEFAULT_LADDER, DEFAULT_RSI_RULE } from '../oportunidades/capital.js'

export const LADDER_PREF = 'fos_invest_opp_ladder'
export const RSI_PREF = 'fos_invest_opp_rsi'

const store = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null } }
const get = (k) => { try { return store()?.getItem(k) ?? null } catch { return null } }
const set = (k, v) => { try { store()?.setItem(k, v) } catch { /* modo privado: vale en esta visita */ } }

export function readLadder() {
  const v = get(LADDER_PREF)
  return LADDERS[v] ? v : DEFAULT_LADDER
}
export function writeLadder(v) { if (LADDERS[v]) set(LADDER_PREF, v) }

export function readRsiRule() {
  const v = get(RSI_PREF)
  return v === '0' ? false : v === '1' ? true : DEFAULT_RSI_RULE
}
export function writeRsiRule(on) { set(RSI_PREF, on ? '1' : '0') }

export const readRule = () => ({ ladder: readLadder(), rsiRule: readRsiRule() })
