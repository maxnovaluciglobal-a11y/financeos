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
