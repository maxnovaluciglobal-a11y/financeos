// src/utils/keypad.js
// Lógica pura del teclado numérico propio de QuickAdd. El monto se maneja como
// string con coma decimal ("1234,5"), nunca con punto: así lo que deja el
// pegado de SMS (toKeypadAmount en smsParser.js) y lo que escribe el teclado
// usan siempre el mismo formato, y la tecla "," no puede armar "12.5,3".

export const KEY_BACKSPACE = '⌫'
export const KEY_DECIMAL = ','
export const KEY_THOUSAND = '000'

// Devuelve el monto nuevo tras tocar `key`. `decimals` es la cantidad máxima
// de decimales de la moneda (2 por defecto; 0 para CLP, COP, etc.).
export function pressKey(amount, key, decimals = 2) {
  const a = String(amount ?? '')
  if (key === KEY_BACKSPACE) return a.slice(0, -1)
  if (key === KEY_DECIMAL) {
    if (decimals <= 0 || a.includes(',')) return a
    return (a || '0') + ','
  }
  if (key === KEY_THOUSAND) {
    // "000" solo multiplica un monto que ya existe: sobre vacío o "0" no
    // agrega ceros a la izquierda.
    if (!a || a === '0') return a
    let next = a
    for (let i = 0; i < 3; i++) next = pressKey(next, '0', decimals)
    return next
  }
  if (!/^\d$/.test(key)) return a
  // dígito: máximo `decimals` decimales tras la coma, sin ceros a la izquierda repetidos
  const [, dec] = a.split(',')
  if (dec != null && dec.length >= Math.max(decimals, 0)) return a
  if (key === '0' && a === '0') return a
  return a === '0' ? key : a + key
}

// "1234,5" -> 1234.5 (0 si está vacío o no es un número)
export function keypadToNumber(amount) {
  return parseFloat(String(amount ?? '').replace(',', '.')) || 0
}
