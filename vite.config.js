import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/app/',
  build: {
    outDir: 'dist/app',
    rollupOptions: {
      output: {
        // Auditoría 360, ING-1/C-32: con `manualChunks` en forma de objeto,
        // Rollup metía react, jsx-runtime y otras dependencias compartidas
        // (tslib, events, @babel/runtime, lodash…) dentro de los chunks `pdf`
        // y `charts`, y la entrada los precargaba (~590 kB gzip) en cada
        // apertura, incluso en la pantalla de acceso. Ahora solo react va a
        // un chunk manual; PDF, gráficos y exceljs se parten solos por los
        // import() de las páginas lazy. El nombre pdf-/charts-/exceljs- lo
        // pone chunkFileNames (el service worker excluye pdf-* y exceljs-* del
        // precache). Lo verifica scripts/bundleBudget.test.js.
        manualChunks(id) {
          // Solo el react de la raíz: @react-pdf trae su propio scheduler anidado.
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id) && !id.includes('@react-pdf')) return 'vendor'
          if (/node_modules\/idb\//.test(id)) return 'idb'
          return undefined
        },
        chunkFileNames(chunk) {
          const ids = chunk.moduleIds || []
          if (ids.some(id => id.includes('node_modules/@react-pdf/'))) return 'assets/pdf-[hash].js'
          if (ids.some(id => id.includes('node_modules/exceljs/'))) return 'assets/exceljs-[hash].js'
          if (ids.some(id => id.includes('node_modules/recharts/'))) return 'assets/charts-[hash].js'
          return 'assets/[name]-[hash].js'
        }
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        // Sin `lang`: el manifest solo localiza name/short_name, que son la marca
        // (igual en los 4 idiomas). Declarar 'es' afirmaba un idioma que la app
        // no tiene fijo; el idioma real lo pone <html lang> en tiempo de ejecución.
        name: 'MOY IQ', short_name: 'MOY IQ',
        theme_color: '#14213D', background_color: '#F1EEE6',
        display: 'standalone', start_url: '/app/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // FIX pantalla negra (2026-07-11): el SW nuevo toma control INMEDIATO al
        // instalarse (skipWaiting) y reclama las pestañas abiertas (clientsClaim).
        // Sin esto, el SW viejo seguía sirviendo chunks precacheados de una versión
        // anterior hasta que el usuario cerraba la app por completo — en iOS esos
        // chunks se desalojan del caché y la navegación quedaba en negro.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Inyecta los listeners de push/notificationclick al SW autogenerado,
        // sin tocar la lógica de caché/offline (ver public/push-sw.js).
        importScripts: ['push-sw.js'],
        navigateFallback: '/app/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/(?!app)/],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // El precache por defecto trae TODOS los chunks en la primera visita, sin
        // importar qué página use el usuario — el motor de PDF (@react-pdf/renderer,
        // usado solo en Reports/Advisor) y exceljs (usado solo si se sube un .xlsx en
        // Import) no deberían bajar solo por abrir el Dashboard. Quedan afuera del
        // precache inicial; la regla runtimeCaching de /app/assets/.* de abajo los
        // cachea igual, recién la primera vez que la página que los usa se visita
        // de verdad. pdf.worker (pdfjs-dist) ya queda afuera por su extensión .mjs,
        // que no matchea los globPatterns por defecto — mismo resultado, sin listarlo acá.
        globIgnores: ['**/pdf-*.js', '**/exceljs-*.js'],
        // Ya no hay regla de runtimeCaching para Google Fonts (2026-09-06,
        // RGPD): las fuentes ahora son estáticas locales en public/fonts/, así
        // que Workbox las toma en el PRECACHE por defecto (junto con el resto
        // de dist/app/) — mejor que el cache-first anterior, que recién
        // cacheaba en la primera visita.
        runtimeCaching: [
          {
            // Chunks JS/CSS lazy de la propia app — stale-while-revalidate
            urlPattern: /\/app\/assets\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'fos-assets',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      }
    })
  ]
})
