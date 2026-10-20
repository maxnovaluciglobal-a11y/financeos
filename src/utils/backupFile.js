// src/utils/backupFile.js — respaldo local cifrado con contraseña (DAT-15).
// Mismo sobre que el sync v2 (PBKDF2-SHA256 600 000 + AES-GCM, ver syncCrypto):
// el archivo es el texto 'fnos2:{…}'. La contraseña no sale del dispositivo y
// no se puede recuperar.
import {
  V2_PREFIX, V2_ITERATIONS, MIN_PASSPHRASE_LENGTH,
  deriveV2KeyBytes, newV2Salt, encryptV2, decryptV2, parseV2Envelope,
} from './syncCrypto.js'

export { MIN_PASSPHRASE_LENGTH }

export function isEncryptedBackupText(text) {
  return typeof text === 'string' && text.trimStart().startsWith(V2_PREFIX)
}

export function passphraseOk(passphrase) {
  return typeof passphrase === 'string' && [...passphrase.normalize('NFKC').trim()].length >= MIN_PASSPHRASE_LENGTH
}

export async function encryptBackupFile(backup, passphrase) {
  if (!passphraseOk(passphrase)) throw new Error('weak_passphrase')
  const salt = newV2Salt()
  const key = await deriveV2KeyBytes(passphrase, salt, V2_ITERATIONS)
  return encryptV2(backup, key, salt, V2_ITERATIONS)
}

// Lanza 'wrong_key' (contraseña incorrecta o archivo alterado), 'corrupt' o 'weak_kdf'.
export async function decryptBackupFile(text, passphrase) {
  const blob = text.trim()
  const { salt, iterations } = parseV2Envelope(blob)
  const key = await deriveV2KeyBytes(passphrase, salt, iterations)
  return decryptV2(blob, key)
}
