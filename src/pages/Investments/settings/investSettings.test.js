// Ajustes › Inversiones (F7): textos en 4 idiomas, lógica de estados y del
// borrado, y que reutilice lo que ya existe (sin duplicar lógica).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import es from './strings.es.js'
import en from './strings.en.js'
import pt from './strings.pt.js'
import de from './strings.de.js'
import { es as mainEs } from '../../../i18n/es.js'
import { eraseWordOk, ERASE_TABLES, PLANS_STEP } from '../../../core/investErase.js'
import { buildProfile } from '../../../utils/investProfile.js'
import { eraseOutcome, ERASE_STEPS, profileAnswers, profileSummary, pushView } from './model.js'
import InvestSettings from './InvestSettings.jsx'
import { AppContext } from '../../../context/AppContext.jsx'

const L = { es, en, pt, de }
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join()
const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')
const withApp = (settings, el) => h(AppContext.Provider, { value: { settings, showToast: () => {} } }, el)
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('Ajustes › Inversiones: textos', () => {
  for (const lang of ['en', 'pt', 'de']) {
    it(`${lang}: mismas claves y variables que el español`, () => {
      expect(Object.keys(L[lang]).sort()).toEqual(Object.keys(es).sort())
      for (const k of Object.keys(es)) expect(vars(L[lang][k]), k).toBe(vars(es[k]))
    })
  }
  it('no repiten el diccionario principal, y los títulos de bloque sí están en él (buscador)', () => {
    expect(Object.keys(es).filter(k => k in mainEs)).toEqual([])
    for (const k of ['profile', 'rule', 'alerts', 'data', 'erase', 'help']) expect(typeof mainEs[`settings.inv.${k}`]).toBe('string')
  })
  it('cada estado de avisos y cada paso del borrado tiene su texto', () => {
    for (const d of Object.values(L)) {
      for (const st of ['on', 'off', 'blocked', 'unsupported', 'noLicense', 'demo']) expect(d[`is.al.s.${st}`], st).toBeTruthy()
      for (const st of ['blocked', 'unsupported', 'noLicense', 'demo']) expect(d[`is.al.${st}`], st).toBeTruthy()
      for (const st of ERASE_STEPS) expect(d[`is.del.step.${st}`], st).toBeTruthy()
      for (const e of ['session_required', 'auth_unavailable', 'network']) expect(d[`is.del.err.${e}`], e).toBeTruthy()
    }
  })
  it('la palabra de confirmación de cada idioma la acepta el borrado; ELIMINAR vale en todos', () => {
    expect(es['is.del.word']).toBe('ELIMINAR')
    for (const d of Object.values(L)) {
      expect(eraseWordOk(d['is.del.word'].toLowerCase(), d['is.del.word'])).toBe(true)
      expect(eraseWordOk('eliminar', d['is.del.word'])).toBe(true)
      expect(d['is.del.type']).toContain('{word}')
    }
  })
  it('español neutro con "tú"; alemán con "Sie"; pie educativo', () => {
    const vos = /(?<![\p{L}])(tenés|podés|querés|sabés|elegí|tocá|mirá|buscá|agregá|escribí|probá|hacé|usá|guardá|revisá|activá|creá|volvé|descargá|completá|iniciá|vos)(?![\p{L}])/iu
    for (const [k, v] of Object.entries(es)) expect(vos.test(v), k).toBe(false)
    expect(de['is.noAccount']).toMatch(/Sie/)
    expect(es['is.foot']).toBe('moyiq · Inversiones · análisis educativo · no es asesoría financiera.')
  })
  it('el borrado dice qué se borra, qué se mantiene y que no se puede deshacer', () => {
    expect(es['is.del.keep']).toMatch(/cuenta, tus finanzas, tu suscripción/)
    expect(es['is.del.irreversible']).toMatch(/No se puede deshacer/)
    expect(es['is.del.intro']).toMatch(/no se tocan/)
  })
})

describe('Ajustes › Inversiones: lógica', () => {
  it('pushView: el estado de PushOffer y "bloqueadas" si el navegador negó el permiso', () => {
    expect(pushView('off', 'denied')).toBe('blocked')
    expect(pushView('off', 'default')).toBe('off')
    for (const st of ['on', 'demo', 'unsupported', 'noLicense']) expect(pushView(st, 'denied')).toBe(st)
  })
  it('profileSummary / profileAnswers', () => {
    const p = buildProfile({ experience: 'some', horizon: 'long', risk: 'medium' }, new Date('2026-11-20T10:00:00Z'))
    expect(profileSummary(p)).toEqual({ complete: true, answers: [['experience', 'some'], ['horizon', 'long'], ['risk', 'medium']], ackAt: '2026-11-20T10:00:00.000Z' })
    expect(profileSummary(null).complete).toBe(false)
    expect(profileSummary({ experience: 'some' }).complete).toBe(false)
    expect(profileAnswers({ experience: 'some', horizon: 'x', risk: 'low' })).toEqual({ experience: 'some', risk: 'low' })
  })
  it('eraseOutcome: ok, demo, nada borrado por sesión o red, y borrado parcial con hueco de permisos', () => {
    expect(eraseOutcome({ ok: true, done: ERASE_STEPS })).toEqual({ kind: 'ok' })
    expect(eraseOutcome({ ok: false, error: 'demo' })).toEqual({ kind: 'demo' })
    expect(eraseOutcome({ ok: false, error: 'session_required', done: [], failed: [] })).toEqual({ kind: 'nothing', errorKey: 'is.del.err.session_required', gap: [] })
    expect(eraseOutcome({ ok: false, error: 'timeout', done: [], failed: ERASE_STEPS.map(step => ({ step, error: 'not_tried' })) }).errorKey).toBe('is.del.err.network')
    const p = eraseOutcome({ ok: false, error: 'partial', done: ['invest_alerts', PLANS_STEP], skipped: [], failed: [{ step: 'watchlist', error: 'not_deleted' }, { step: 'portfolio_holdings', error: 'delete_failed' }] })
    expect(p).toEqual({ kind: 'partial', done: ['invest_alerts', PLANS_STEP], unsure: [], failed: ['watchlist', 'portfolio_holdings'], gap: ['watchlist'] })
    // Corte de red a mitad: se dice lo que sí se borró.
    expect(eraseOutcome({ ok: false, error: 'network', done: ['invest_alerts'], failed: [{ step: 'watchlist', error: 'network' }] }).kind).toBe('partial')
  })
  it('eraseOutcome: sin nada borrado ni sin confirmar nunca dice "se borró solo una parte"', () => {
    // Fetch caído desde el principio (forma real tras investErase): nada intentado.
    const down = eraseOutcome({ ok: false, error: 'network', done: [], skipped: [], failed: ERASE_STEPS.map(step => ({ step, error: 'not_tried' })) })
    expect(down).toEqual({ kind: 'nothing', errorKey: 'is.del.err.network', gap: [] })
    // El servidor rechazó cada paso: nada borrado, con el motivo y el hueco de permisos.
    const all = eraseOutcome({ ok: false, error: 'partial', done: [], skipped: ['invest_operations'], failed: [{ step: 'invest_alerts', error: 'denied' }, { step: 'watchlist', error: 'delete_failed' }] })
    expect(all).toEqual({ kind: 'nothing', errorKey: 'is.del.err.failed', gap: ['invest_alerts'] })
    for (const d of Object.values(L)) expect(d['is.del.err.failed']).toBeTruthy()
    expect(es['is.del.err.failed']).toMatch(/no se borró nada/)
    expect(es['is.del.partial']).toMatch(/Se borró solo una parte/)
  })
  it('eraseOutcome: si un DELETE salió y no hubo respuesta, nunca dice "no se borró nada"', () => {
    const notTried = ERASE_STEPS.slice(1).map(step => ({ step, error: 'not_tried' }))
    for (const error of ['timeout', 'network']) {
      const o = eraseOutcome({ ok: false, error, done: [], skipped: [], failed: [{ step: 'invest_alerts', error, sent: true }, ...notTried] })
      expect(o.kind).toBe('unsure')
      expect(o.unsure).toEqual(['invest_alerts'])
      expect(o.failed).toEqual(ERASE_STEPS.slice(1))
    }
    expect(eraseOutcome({ ok: false, error: 'network', done: ['invest_alerts'], failed: [{ step: 'watchlist', error: 'network', sent: true }] }).kind).toBe('partial')
  })
  it('el aviso de "sin confirmar" existe y no dice que no se borró nada', () => {
    for (const d of Object.values(L)) {
      expect(d['is.del.unsure']).toContain('{list}')
      expect(d['is.del.unsureHead']).toBeTruthy()
    }
    expect(es['is.del.unsureHead']).toMatch(/puede que se haya borrado una parte/)
    expect(es['is.del.unsureHead']).not.toMatch(/no se borró nada/)
    expect(ERASE_STEPS).toEqual([...ERASE_TABLES, PLANS_STEP])
  })
})

describe('Ajustes › Inversiones: pantalla', () => {
  it('la copia JSON de Ajustes no se descarga sin la lista de seguimiento', () => {
    const src = read('./InvestSettings.jsx')
    expect(src).toMatch(/if \(f\.error\) \{ setMsg\(\{ err: true, text: t\('is\.data\.backupErr'\) \}\)/)
    expect(es['is.data.backupErr']).toMatch(/no se descargó/)
  })
  it('reutiliza exports.js, usePushOffer, ProfileSheet, investErase y la ayuda diferida', () => {
    const src = read('./InvestSettings.jsx')
    expect(src).toContain("from '../portfolio/exports.js'")
    expect(src).toContain('usePushOffer(demo)')
    expect(src).toContain("import ProfileSheet from '../ProfileSheet.jsx'")
    expect(src).toContain("from '../../../core/investErase.js'")
    expect(src).toMatch(/lazy\(\(\) => import\('\.\.\/help\/InvestHelp\.jsx'\)\)/)
    expect(src).not.toMatch(/holdingsCsv|operationsCsv|backupJson|\.delete\(\)/)
    for (const id of ['invProfile', 'invRule', 'invAlerts', 'invData', 'invDelete', 'invHelp']) expect(src).toContain(`id="${id}"`)
  })
  it('en el demo: aviso, sin perfil guardado, avisos de demo, todos los bloques y el pie', () => {
    const html = text(renderToStaticMarkup(withApp({ isDemo: true, language: 'es' }, h(InvestSettings, { isDemo: true, setPage: () => {} }))))
    expect(html).toContain(es['is.demo'])
    expect(html).toContain(es['is.prof.demo'])
    expect(html).toContain(es['is.al.demo'])
    for (const k of ['profile', 'rule', 'alerts', 'data', 'erase', 'help']) expect(html).toContain(mainEs[`settings.inv.${k}`])
    expect(html).toContain(es['is.del.btn'])
    expect(html).toContain(es['is.foot'])
  })
  it('con el módulo apagado: solo el aviso y el botón a Funciones', () => {
    const html = text(renderToStaticMarkup(withApp({ language: 'es' }, h(InvestSettings, { setPage: () => {}, onOpenFeatures: () => {} }))))
    expect(html).toContain(es['is.off'])
    expect(html).toContain(es['is.off.go'])
    expect(html).not.toContain(es['is.del.btn'])
  })
})
