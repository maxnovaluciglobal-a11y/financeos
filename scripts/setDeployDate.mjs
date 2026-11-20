#!/usr/bin/env node
// Fija una fecha de despliegue en src/data/deployDate.js y borra su línea TODO.
//   node scripts/setDeployDate.mjs 2026-12-01            → REBRAND_DEPLOY_DATE
//     (vigencia de los legales y nota de Novedades), quita TODO(rebrand-deploy)
//   node scripts/setDeployDate.mjs --privacy 2026-12-01  → PRIVACY_DEPLOY_DATE
//     (vigencia de la Política de Privacidad), quita TODO(privacy-deploy)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const TARGETS = {
  rebrand: { constant: 'REBRAND_DEPLOY_DATE', todo: 'TODO(rebrand-deploy)' },
  privacy: { constant: 'PRIVACY_DEPLOY_DATE', todo: 'TODO(privacy-deploy)' },
}

export function setDeployDate(source, date, target = 'rebrand') {
  const { constant, todo } = TARGETS[target] || {}
  if (!constant) throw new Error(`destino desconocido: ${target}`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T12:00:00Z`).getTime())) {
    throw new Error(`fecha inválida: ${date} (formato AAAA-MM-DD)`)
  }
  const re = new RegExp(`export const ${constant} = '[^']*'`)
  if (!re.test(source)) throw new Error(`no encuentro ${constant}`)
  return source
    .split('\n').filter(l => !l.includes(todo)).join('\n')
    .replace(re, `export const ${constant} = '${date}'`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = fileURLToPath(new URL('../src/data/deployDate.js', import.meta.url))
  const args = process.argv.slice(2)
  const target = args.includes('--privacy') ? 'privacy' : 'rebrand'
  const date = args.find(a => !a.startsWith('--'))
  writeFileSync(file, setDeployDate(readFileSync(file, 'utf8'), date, target))
  console.log(`${TARGETS[target].constant} = '${date}' en src/data/deployDate.js (TODO quitado)`)
}
