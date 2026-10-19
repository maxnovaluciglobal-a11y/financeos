// scripts/bundleBudget.js — presupuesto de carga inicial (auditoría 360, ING-1/C-32).
// Lo corre build.js después de `vite build`: falla si la entrada precarga el
// motor de PDF, los gráficos o exceljs, o si el JS inicial (entrada + preloads)
// pasa de MAX_INITIAL_GZIP. Antes eran ~790 kB gzip; tras C-32, ~250 kB.
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

export const MAX_INITIAL_GZIP = 300 * 1024
const HEAVY = /^assets\/(pdf|charts|exceljs)-/

// JS que el index.html carga de entrada: el <script type=module> y los modulepreload.
export function initialScripts(html) {
  const out = new Set()
  for (const m of html.matchAll(/<script[^>]+type="module"[^>]+src="\/app\/([^"]+\.js)"/g)) out.add(m[1])
  for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/app\/([^"]+\.js)"/g)) out.add(m[1])
  return [...out]
}

export function checkBudget(html, sizeOf) {
  const files = initialScripts(html)
  const errors = []
  const heavy = files.filter(f => HEAVY.test(f))
  if (heavy.length) errors.push(`la entrada precarga chunks pesados: ${heavy.join(', ')}`)
  const total = files.reduce((s, f) => s + sizeOf(f), 0)
  if (total > MAX_INITIAL_GZIP) errors.push(`JS inicial ${Math.round(total / 1024)} kB gzip > ${MAX_INITIAL_GZIP / 1024} kB`)
  return { files, total, errors }
}

export function checkDist(distApp) {
  const html = fs.readFileSync(path.join(distApp, 'index.html'), 'utf8')
  return checkBudget(html, (f) => zlib.gzipSync(fs.readFileSync(path.join(distApp, f))).length)
}
