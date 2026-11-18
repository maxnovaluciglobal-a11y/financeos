#!/usr/bin/env node
// Fija la fecha del despliegue del rebranding en src/data/deployDate.js y borra
// la línea TODO(rebrand-deploy). De esa constante salen la vigencia de los
// legales y el id de la nota de Novedades.
//   node scripts/setDeployDate.mjs 2026-12-01
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export function setDeployDate(source, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T12:00:00Z`).getTime())) {
    throw new Error(`fecha inválida: ${date} (formato AAAA-MM-DD)`)
  }
  if (!/export const REBRAND_DEPLOY_DATE = '[^']*'/.test(source)) throw new Error('no encuentro REBRAND_DEPLOY_DATE')
  return source
    .split('\n').filter(l => !l.includes('TODO(rebrand-deploy)')).join('\n')
    .replace(/export const REBRAND_DEPLOY_DATE = '[^']*'/, `export const REBRAND_DEPLOY_DATE = '${date}'`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = fileURLToPath(new URL('../src/data/deployDate.js', import.meta.url))
  const date = process.argv[2]
  writeFileSync(file, setDeployDate(readFileSync(file, 'utf8'), date))
  console.log(`REBRAND_DEPLOY_DATE = '${date}' en src/data/deployDate.js (TODO quitado)`)
}
