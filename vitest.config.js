import { defineConfig } from 'vite'

// Config de test separada de vite.config.js a propósito: los tests de acá son
// funciones puras de src/utils/ y api/ (sin DOM, sin React) — no hace falta
// cargar el plugin de React ni VitePWA (que genera manifest/service worker,
// trabajo innecesario y lento para correr matemática pura).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'api/**/*.test.js', 'supabase/functions/**/*.test.ts', 'scripts/**/*.test.js'],
  },
})
