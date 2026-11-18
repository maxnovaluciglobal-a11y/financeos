// La fuente de la app entra en el precache del service worker (revisión
// Entrega 1, B1): sin conexión y con la caché HTTP vacía no cae a system-ui.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const vite = readFileSync(fileURLToPath(new URL('../vite.config.js', import.meta.url)), 'utf8')

describe('precache de fuentes', () => {
  it('globPatterns incluye woff2 y deja afuera latin-ext', () => {
    expect(vite).toMatch(/globPatterns: \['\*\*\/\*\.\{js,wasm,css,html,woff2\}'\]/)
    expect(vite).toMatch(/'\*\*\/fonts\/\*latin-ext\*'/)
  })
})
