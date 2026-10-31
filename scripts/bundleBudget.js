// scripts/bundleBudget.js — presupuesto de carga inicial (auditoría 360, ING-1/C-32).
// Lo corre build.js después de `vite build`: falla si la entrada precarga el
// motor de PDF, los gráficos o exceljs, o si el JS inicial (entrada + preloads)
// pasa de MAX_INITIAL_GZIP. Antes eran ~790 kB gzip; tras C-32, ~286 kB; tras V4,
// ver el valor de abajo. También falla si un chunk importa estáticamente un
// diccionario entero: Metas traía en y pt (115 kB gzip) y, como prefetchTabs la
// precarga, se bajaban en cada arranque en frío sin que esta línea lo mostrara.
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

export const MAX_INITIAL_GZIP = 246 * 1024
const HEAVY = /^assets\/(pdf|charts|exceljs)-/
const LANG_CHUNK = /^(en|pt|de)-[\w-]+\.js$/

// JS que el index.html carga de entrada: el <script type=module>, los modulepreload
// y (con readChunk) los imports estáticos de esos chunks.
export function initialScripts(html) {
  const out = new Set()
  for (const m of html.matchAll(/<script[^>]+type="module"[^>]+src="\/app\/([^"?]+\.js)/g)) out.add(m[1])
  for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/app\/([^"?]+\.js)/g)) out.add(m[1])
  return [...out]
}

// Imports estáticos de un chunk ya emitido (import{..}from"./x.js" / import"./x.js").
export function staticImports(code) {
  return [...String(code).matchAll(/import(?:[\w${},\s*]+from)?\s*"\.\/([\w.-]+\.js)"/g)].map(m => m[1])
}

export function checkBudget(html, sizeOf, readChunk = null) {
  const files = initialScripts(html).map(f => f.replace(/\?.*$/, ''))
  if (readChunk) {
    for (let i = 0; i < files.length; i++) {
      for (const dep of staticImports(readChunk(files[i]))) {
        const f = 'assets/' + dep
        if (!files.includes(f)) files.push(f)
      }
    }
  }
  const errors = []
  const heavy = files.filter(f => HEAVY.test(f))
  if (heavy.length) errors.push(`la entrada precarga chunks pesados: ${heavy.join(', ')}`)
  const total = files.reduce((s, f) => s + sizeOf(f), 0)
  if (total > MAX_INITIAL_GZIP) errors.push(`JS inicial ${Math.round(total / 1024)} kB gzip > ${MAX_INITIAL_GZIP / 1024} kB`)
  return { files, total, errors }
}

// Chunks que importan estáticamente un diccionario: solo langCache.js debe
// llegar a ellos, con import() dinámico. Formato "<chunk> -> <diccionario>".
export function staticLangImports(chunkNames, readChunk) {
  return chunkNames.flatMap(name => staticImports(readChunk(name))
    .filter(dep => LANG_CHUNK.test(dep))
    .map(dep => `${name} -> ${dep}`))
}

export function checkDist(distApp) {
  const html = fs.readFileSync(path.join(distApp, 'index.html'), 'utf8')
  const read = (f) => fs.readFileSync(path.join(distApp, f), 'utf8')
  const result = checkBudget(html, (f) => zlib.gzipSync(fs.readFileSync(path.join(distApp, f))).length, read)
  const chunks = fs.readdirSync(path.join(distApp, 'assets')).filter(f => f.endsWith('.js'))
  const langs = staticLangImports(chunks, (f) => read(`assets/${f}`))
  if (langs.length) result.errors.push(`diccionarios importados estáticamente: ${langs.join(', ')}`)
  return result
}
