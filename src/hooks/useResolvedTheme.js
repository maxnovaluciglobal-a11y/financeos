// Tema que se ve ahora ('light' | 'dark'), siguiendo al sistema cuando la
// preferencia es 'system'. Para los atajos "Claro/Oscuro" del Menú y del riel.
import { useSyncExternalStore } from 'react'
import { resolveTheme, systemPrefersDark, watchSystemTheme } from '../utils/theme.js'

export function useResolvedTheme(setting) {
  const prefersDark = useSyncExternalStore(watchSystemTheme, systemPrefersDark, () => false)
  return resolveTheme(setting, prefersDark)
}
