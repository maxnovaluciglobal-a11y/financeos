// src/hooks/useNetWorth.js — Patrimonio neto de la persona, UNA sola cuenta
// para toda pantalla que lo muestre (QA pre-tiendas 23-nov-2026, B3/I1):
// Patrimonio, Panorama, Inicio, Reportes y Modo Asesor (pantalla y PDF).
// calcNetWorth (lo registrado) + la estimación de Inversiones cuando el módulo
// está encendido y hay tasa con fecha (withInvest). Antes Modo Asesor y
// Reportes usaban solo calcNetWorth y mostraban otra cifra con el mismo nombre.
import { useMemo } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { calcNetWorth } from '../utils/netWorth.js'
import { withInvest } from '../utils/investNetWorth.js'
import { useInvestPortfolio } from './useInvestPortfolio.js'

export function useNetWorth() {
  const { goals, debts, receivables, incomes, expenses, settings } = useApp() || {}
  const base = useMemo(() => calcNetWorth({ goals, debts, receivables, incomes, expenses, settings }),
    [goals, debts, receivables, incomes, expenses, settings])
  const { inv } = useInvestPortfolio()
  const nw = useMemo(() => withInvest(base, inv), [base, inv])
  return { base, inv, nw }
}
