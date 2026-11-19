// Guarda del lint: un componente JSX sin importar debe ser error, no un
// ReferenceError en runtime (ver src/components/backup/backupManager.test.js).
import { describe, it, expect } from 'vitest'
import { Linter } from 'eslint'
import config from '../eslint.config.js'

const lint = (code) => new Linter({ configType: 'flat' }).verify(code, config, 'src/x.jsx')
  .filter(m => m.ruleId === 'local/jsx-no-undef')

describe('local/jsx-no-undef', () => {
  it('marca un componente usado sin importar', () => {
    const msgs = lint("export default function A() { return <Missing /> }\n")
    expect(msgs).toHaveLength(1)
    expect(msgs[0].severity).toBe(2)
  })
  it('marca la raíz de un componente con punto sin importar', () => {
    expect(lint("export default function A() { return <Ns.Item /> }\n")).toHaveLength(1)
  })
  it('acepta componentes importados, locales y etiquetas HTML', () => {
    const code = "import B from './b.jsx'\nconst C = () => null\nexport default function A() { return <div><B /><C /></div> }\n"
    expect(lint(code)).toHaveLength(0)
  })
})
