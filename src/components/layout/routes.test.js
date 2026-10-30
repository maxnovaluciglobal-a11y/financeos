// Cada destino del NAV tiene su `case` en los dos enrutadores (App y demo).
// Poda P1: Panorama faltaba en DemoShell y el demo caía al Inicio.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ALL_ITEMS } from './navConfig.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const src = (f) => readFileSync(join(root, f), 'utf8')

describe('rutas de cada destino del NAV', () => {
  for (const file of ['App.jsx', 'demo/DemoShell.jsx']) {
    it(file, () => {
      const code = src(file)
      for (const it_ of ALL_ITEMS) {
        if (it_.id === 'dashboard') continue
        expect(code.includes(`case '${it_.id}'`), `${file}: ${it_.id}`).toBe(true)
      }
    })
  }
})
