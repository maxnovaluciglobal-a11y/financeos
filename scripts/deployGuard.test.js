// Guard de deploy.sh (auditoría 360, C-06). Cada caso arma un repo temporal
// (origin bare + clon con deploy.sh commiteado) y corre `deploy.sh`. Un `npm`
// y un `npx` falsos al frente del PATH registran cualquier llamada: si el guard
// deja pasar un paso (tests, build, vercel) el registro deja de estar vacío.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 })

const DEPLOY_SH = join(dirname(fileURLToPath(import.meta.url)), '..', 'deploy.sh')

const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_TERMINAL_PROMPT: '0',
}

let root, origin, work, binDir, stubLog

function run(cmd, args, cwd, extraEnv = {}) {
  const r = spawnSync(cmd, args, {
    cwd, encoding: 'utf8',
    env: { ...process.env, ...GIT_ENV, PATH: `${binDir}:${process.env.PATH}`, STUB_LOG: stubLog, ...extraEnv },
  })
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }
}
const git = (cwd, ...args) => {
  const r = run('git', args, cwd)
  if (r.code !== 0) throw new Error(`git ${args.join(' ')} falló: ${r.out}`)
  return r.out.trim()
}
const commitFile = (cwd, name, content) => {
  writeFileSync(join(cwd, name), content)
  git(cwd, 'add', '-A')
  git(cwd, 'commit', '-q', '-m', `edit ${name}`)
}
const deploy = (args = []) => run('bash', ['deploy.sh', ...args], work)
const stubCalls = () => (existsSync(stubLog) ? readFileSync(stubLog, 'utf8').trim() : '')

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'deploy-guard-'))
  origin = join(root, 'origin.git')
  work = join(root, 'work')
  binDir = join(root, 'bin')
  stubLog = join(root, 'stub.log')
  mkdirSync(binDir)
  for (const name of ['npm', 'npx']) {
    writeFileSync(join(binDir, name), '#!/bin/sh\necho "$(basename "$0") $*" >> "$STUB_LOG"\n')
    chmodSync(join(binDir, name), 0o755)
  }
  git(root, 'init', '-q', '--bare', '-b', 'main', origin)
  git(root, 'init', '-q', '-b', 'main', work)
  copyFileSync(DEPLOY_SH, join(work, 'deploy.sh'))
  writeFileSync(join(work, 'app.txt'), 'v1\n')
  git(work, 'add', '-A')
  git(work, 'commit', '-q', '-m', 'init')
  git(work, 'remote', 'add', 'origin', origin)
  git(work, 'push', '-q', '-u', 'origin', 'main')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('deploy.sh --check (guard de despliegue)', () => {
  it('pasa en main, sin cambios y al día con origin/main, y no corre ningún paso de deploy', () => {
    const r = deploy(['--check'])
    expect(r.code, r.out).toBe(0)
    expect(r.out).toContain('Guard OK')
    expect(stubCalls()).toBe('')
  })

  it('los archivos NO rastreados no cuentan', () => {
    writeFileSync(join(work, 'suelto.txt'), 'basura\n')
    writeFileSync(join(work, '.DS_Store'), 'x')
    expect(deploy(['--check']).code).toBe(0)
  })

  it('aborta en otra rama y dice cuál es', () => {
    git(work, 'switch', '-q', '-c', 'security/otra-rama')
    const r = deploy(['--check'])
    expect(r.code).toBe(1)
    expect(r.out).toContain("'security/otra-rama'")
    expect(r.out).toContain("no 'main'")
    expect(r.out).toContain('worktree')
  })

  it('aborta con HEAD desacoplado', () => {
    git(work, 'checkout', '-q', '--detach')
    const r = deploy(['--check'])
    expect(r.code).toBe(1)
    expect(r.out).toContain('desacoplado')
  })

  it('aborta con un cambio rastreado sin commitear y lo lista', () => {
    writeFileSync(join(work, 'app.txt'), 'v1 editado\n')
    const r = deploy(['--check'])
    expect(r.code).toBe(1)
    expect(r.out).toContain('sin commitear')
    expect(r.out).toContain('app.txt')
  })

  it('aborta con un cambio rastreado ya en el índice (git add sin commit)', () => {
    writeFileSync(join(work, 'app.txt'), 'v1 en el índice\n')
    git(work, 'add', 'app.txt')
    expect(deploy(['--check']).code).toBe(1)
  })

  it('aborta con un archivo nuevo agregado al índice sin commitear', () => {
    writeFileSync(join(work, 'nuevo.txt'), 'nuevo\n')
    git(work, 'add', 'nuevo.txt')
    const r = deploy(['--check'])
    expect(r.code).toBe(1)
    expect(r.out).toContain('nuevo.txt')
  })

  it('aborta si main tiene commits sin push (adelante) y pide el push', () => {
    commitFile(work, 'app.txt', 'v2 local\n')
    const r = deploy(['--check'])
    expect(r.code).toBe(1)
    expect(r.out).toContain('1 commit(s) que no están en origin/main')
    expect(r.out).toContain('git push origin main')
  })

  it('aborta si origin/main tiene commits que main no tiene (atrás) y pide el pull', () => {
    const otro = join(root, 'otro')
    git(root, 'clone', '-q', origin, otro)
    commitFile(otro, 'app.txt', 'v2 remoto\n')
    git(otro, 'push', '-q', 'origin', 'main')
    const r = deploy(['--check'])
    expect(r.code).toBe(1)
    expect(r.out).toContain('1 commit(s) atrás de origin/main')
    expect(r.out).toContain('git pull --ff-only')
  })

  it('aborta si main y origin/main divergieron', () => {
    const otro = join(root, 'otro')
    git(root, 'clone', '-q', origin, otro)
    commitFile(otro, 'remoto.txt', 'remoto\n')
    git(otro, 'push', '-q', 'origin', 'main')
    commitFile(work, 'local.txt', 'local\n')
    const r = deploy(['--check'])
    expect(r.code).toBe(1)
    expect(r.out).toContain('divergieron')
  })

  it('aborta si no puede consultar origin (sin red o remoto roto)', () => {
    git(work, 'remote', 'set-url', 'origin', join(root, 'no-existe.git'))
    const r = deploy(['--check'])
    expect(r.code).toBe(1)
    expect(r.out).toContain('git fetch')
  })

  it('rechaza argumentos desconocidos sin correr nada', () => {
    const r = deploy(['--dry-run'])
    expect(r.code).toBe(2)
    expect(r.out).toContain('uso:')
    expect(stubCalls()).toBe('')
  })
})

describe('deploy.sh sin --check: el guard va antes de cualquier paso', () => {
  it.each([
    ['otra rama', () => git(work, 'switch', '-q', '-c', 'feat/x')],
    ['cambio rastreado sin commitear', () => writeFileSync(join(work, 'app.txt'), 'sucio\n')],
    ['commit sin push', () => commitFile(work, 'app.txt', 'v2 local\n')],
  ])('con %s no se llama a npm ni a npx', (_, setup) => {
    setup()
    const r = deploy()
    expect(r.code).toBe(1)
    expect(r.out).toContain('deploy abortado, no se tocó nada')
    expect(stubCalls()).toBe('')
  })

  it('con el guard en verde sí arranca el flujo (primer paso: npm test)', () => {
    const r = deploy()
    expect(r.out).toContain('Guard OK')
    expect(stubCalls().split('\n')[0]).toBe('npm test')
  })
})
