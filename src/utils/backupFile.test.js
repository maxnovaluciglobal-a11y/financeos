import { describe, it, expect } from 'vitest'
import { encryptBackupFile, decryptBackupFile, isEncryptedBackupText, passphraseOk } from './backupFile.js'

const backup = { _meta: { app: 'MOY IQ' }, incomes: [{ id: 'a', source: 'Sueldo ñandú', amount: 1000 }], expenses: [] }

describe('respaldo local cifrado (DAT-15)', () => {
  it('ida y vuelta; el archivo no contiene los datos en claro', async () => {
    const file = await encryptBackupFile(backup, 'una frase larga y segura')
    expect(isEncryptedBackupText(file)).toBe(true)
    expect(file).not.toContain('Sueldo')
    expect(await decryptBackupFile(file, 'una frase larga y segura')).toEqual(backup)
  })
  it('dos cifrados del mismo respaldo difieren (sal e IV nuevos)', async () => {
    const a = await encryptBackupFile(backup, 'una frase larga y segura')
    const b = await encryptBackupFile(backup, 'una frase larga y segura')
    expect(a).not.toBe(b)
  })
  it('contraseña incorrecta: wrong_key', async () => {
    const file = await encryptBackupFile(backup, 'una frase larga y segura')
    await expect(decryptBackupFile(file, 'otra frase larga y distinta')).rejects.toThrow('wrong_key')
  })
  it('archivo alterado o truncado nunca devuelve datos a medias', async () => {
    const file = await encryptBackupFile(backup, 'una frase larga y segura')
    await expect(decryptBackupFile(file.slice(0, -20), 'una frase larga y segura')).rejects.toThrow()
  })
  it('exige una contraseña de al menos 10 caracteres', async () => {
    expect(passphraseOk('corta')).toBe(false)
    expect(passphraseOk('   corta    ')).toBe(false)
    expect(passphraseOk('una frase larga')).toBe(true)
    await expect(encryptBackupFile(backup, 'corta')).rejects.toThrow('weak_passphrase')
  })
  it('un JSON normal no se confunde con un respaldo cifrado', () => {
    expect(isEncryptedBackupText(JSON.stringify(backup))).toBe(false)
    expect(isEncryptedBackupText('')).toBe(false)
  })
})
