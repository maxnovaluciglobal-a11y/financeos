// Comparación de secretos en tiempo constante (auditoría 360, SEG-11): `!==`
// corta en el primer carácter distinto y filtra por tiempo cuánto acertó el
// atacante. Recorre siempre el largo del esperado y no corta antes.
export function secretEquals(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!expected || typeof provided !== "string") return false;
  const enc = new TextEncoder();
  const a = enc.encode(provided);
  const b = enc.encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}
