// Ícono de categoría único (UI-M4): lucide monocromo en un cuadrado tintado,
// sin punto de color; emoji solo si el usuario lo activó en Ajustes.
import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CategoryIcon, { CATEGORY_ICONS, categoryVisual } from './CategoryIcon.jsx'
import { AppContext } from '../context/AppContext.jsx'
import { CATS_EXPENSE, CATS_INCOME } from '../utils/index.js'

describe('CategoryIcon (UI-M4)', () => {
  it('toda categoría canónica tiene ícono propio y ninguna usa el rojo de error (--cat-6)', () => {
    for (const c of [...CATS_EXPENSE, ...CATS_INCOME]) expect(CATEGORY_ICONS[c], c).toBeTruthy()
    for (const [, slot] of Object.values(CATEGORY_ICONS)) expect(slot).not.toBe(6)
  })
  it('una categoría libre recibe un tinte estable, nunca --cat-6', () => {
    const a = categoryVisual('Mi gasto raro'), b = categoryVisual('Mi gasto raro')
    expect(a.slot).toBe(b.slot)
    expect(a.slot).not.toBe(6)
  })
  it('dibuja un svg monocromo sin emoji ni punto de color por defecto', () => {
    const html = renderToStaticMarkup(h(CategoryIcon, { category: 'Vivienda' }))
    expect(html).toContain('<svg')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('var(--cat-1) 12%')
    expect(html).not.toContain('🏠')
  })
  it('con showCategoryEmoji muestra el emoji', () => {
    const html = renderToStaticMarkup(h(AppContext.Provider, { value: { settings: { showCategoryEmoji: true } } }, h(CategoryIcon, { category: 'Vivienda' })))
    expect(html).toContain('🏠')
    expect(html).not.toContain('<svg')
  })
})

// V3 (30-oct-2026): ícono por palabra clave para las categorías de plantillas
// y las que escribe el usuario. Wallet solo para lo genérico.
import { Wallet, PawPrint, GraduationCap, Truck, CreditCard, HandCoins, House, Receipt, Store, Repeat, Car, Briefcase, Lightbulb, Scissors, PiggyBank, Package, Smartphone } from 'lucide-react'
import { iconByKeyword, CATEGORY_KEYWORDS, normalizeCategory } from './CategoryIcon.jsx'
import { TEMPLATES } from '../data/templates.js'
import config from '../config.js'

describe('CategoryIcon V3: ícono por palabra clave', () => {
  const all = [...new Set([
    ...TEMPLATES.flatMap(tp => [...tp.categoriesIncome, ...tp.categoriesExpense]),
    ...config.categoriesIncome, ...config.categoriesExpense, ...CATS_EXPENSE, ...CATS_INCOME,
  ])]

  it('ninguna categoría de plantillas ni de config cae en Wallet', () => {
    expect(all.length).toBeGreaterThan(40)
    const fallback = all.filter(c => categoryVisual(c).Icon === Wallet)
    expect(fallback).toEqual([])
  })

  it('los casos que antes caían en Wallet reciben un ícono con sentido', () => {
    const cases = {
      'Mascotas': PawPrint, 'Educación hijos': GraduationCap, 'Educación / Cursos': GraduationCap, 'Proveedores': Truck,
      'Pago tarjeta crédito': CreditCard, 'Pago crédito consumo': HandCoins, 'Pago crédito hipotecario': House,
      'Provisión impuestos': Receipt, 'Impuestos negocio': Receipt, 'Gastos operativos negocio': Store,
      'Sueldo del dueño': Briefcase, 'Salario cónyuge 1': Briefcase, 'Servicios profesionales': Briefcase,
      'Servicios (luz/agua/internet)': Lightbulb, 'Servicios básicos': Lightbulb, 'Servicios personales': Scissors,
      'Ahorro meta principal': PiggyBank, 'Transporte personal': Car, 'Vivienda personal': House,
    }
    for (const [c, Icon] of Object.entries(cases)) expect(categoryVisual(c).Icon, c).toBe(Icon)
  })

  it('sin tildes ni mayúsculas, y en pt/en/de', () => {
    expect(iconByKeyword('EDUCACION HIJOS')).toBe(GraduationCap)
    expect(iconByKeyword('Animais de estimação · pets')).toBe(PawPrint)
    expect(iconByKeyword('Cartão de crédito')).toBe(CreditCard)
    expect(iconByKeyword('Credit card payment')).toBe(CreditCard)
    expect(iconByKeyword('Handyvertrag')).toBe(Smartphone)
    expect(normalizeCategory('Poupança Ação')).toBe('poupanca acao')
  })

  it('la clave empieza una palabra; con "=" es la palabra entera', () => {
    expect(iconByKeyword('Business lunch')).toBe(Store)     // "=bus" no matchea "business"
    expect(iconByKeyword('Bus al trabajo')).toBe(Car)
    expect(iconByKeyword('Taxi')).toBe(Car)                 // "=tax" no matchea "taxi"
    expect(iconByKeyword('Abogado')).not.toBe(Repeat)       // "=abo" no matchea "abogado"
    expect(iconByKeyword('Cargos varios')).toBe(Package)    // "=car" no matchea "cargos"
    expect(iconByKeyword('Gastos del mes')).toBeNull()      // genérico: Wallet
    expect(categoryVisual('Gastos del mes').Icon).toBe(Wallet)
    expect(iconByKeyword('')).toBeNull()
  })

  it('una categoría libre conserva su tinte aunque cambie el ícono', () => {
    const oldSlot = (c) => { let h = 0; for (const ch of c) h = (h * 31 + ch.codePointAt(0)) >>> 0; return [1, 2, 3, 4, 5, 7, 8][h % 7] }
    for (const c of ['Mascotas', 'Proveedores', 'Pago tarjeta crédito', 'Gastos del mes']) {
      expect(categoryVisual(c).slot, c).toBe(oldSlot(c))
      expect(categoryVisual(c).slot).not.toBe(6)
    }
  })

  it('las exactas no cambian y las claves están normalizadas', () => {
    expect(categoryVisual('Vivienda')).toEqual({ Icon: CATEGORY_ICONS.Vivienda[0], slot: 1 })
    for (const [Icon, keys] of CATEGORY_KEYWORDS) {
      expect(Icon).toBeTruthy()
      for (const k of keys) expect(k.replace(/^=/, ''), k).toBe(normalizeCategory(k.replace(/^=/, '')))
    }
  })
})
