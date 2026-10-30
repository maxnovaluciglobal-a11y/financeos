// src/pages/Settings/settingsIndex.js — mapa de Ajustes (R10, ola C, 30-oct-2026).
// Lógica pura (sin React ni DOM) para testearla en el environment 'node':
// - SETTINGS_SECTIONS / SETTINGS_GROUPS: la raíz de Ajustes es una lista corta
//   de filas agrupadas; cada fila abre una subpantalla.
// - searchSettings(): el buscador filtra filas y también encuentra los ajustes
//   de adentro (por su etiqueta y palabras clave traducidas) para saltar a ellos.
// - CONTROL_MAP: dónde quedó cada control de la pantalla larga de antes. Es la
//   lista de verificación de "no se pierde nada" (settingsIndex.test.js lee el
//   código de cada subpantalla y exige que el control siga ahí).
import { normalize } from '../../components/ui/listboxKeys.js'

// Secciones de la raíz, en orden. Cada una agrupa filas (ids de SETTINGS_GROUPS).
export const SETTINGS_SECTIONS = [
  { id: 'prefs',   title: 'settings.section.prefs',   groups: ['profile', 'currency', 'appearance', 'templates'] },
  { id: 'dataSec', title: 'settings.section.dataSec', groups: ['data', 'security', 'notifications'] },
  { id: 'more',    title: 'settings.section.more',    groups: ['plan', 'advanced', 'danger'] },
]

// Cada fila: título, descripción de una línea y palabras clave (claves i18n,
// la lista de palabras va separada por comas en cada idioma). `items` son los
// ajustes de adentro a los que el buscador puede saltar: `id` es el
// data-setting del bloque en la subpantalla.
export const SETTINGS_GROUPS = [
  { id: 'profile', items: [
    { id: 'country', label: 'settings.country.label' },
    { id: 'taxId',   label: 'settings.group.profile.taxId' },
    { id: 'account', label: 'settings.account.label', kw: 'settings.account.logoutBtn' },
  ] },
  { id: 'currency', items: [
    { id: 'currency', label: 'settings.currency.label' },
    { id: 'language', label: 'settings.language.label' },
    { id: 'dual',     label: 'settings.dualCurrency.label', kw: 'settings.group.currency.rate' },
  ] },
  { id: 'appearance', items: [
    { id: 'theme', label: 'settings.theme.label' },
    { id: 'emoji', label: 'settings.categoryEmoji.label' },
  ] },
  { id: 'templates', items: [
    { id: 'templates', label: 'settings.templates.title' },
  ] },
  { id: 'data', items: [
    { id: 'backup',  label: 'settings.backup.title', kw: 'backup.restore.title' },
    { id: 'sync',    label: 'settings.sync.title' },
    { id: 'csv',     label: 'settings.exportCsv.label' },
    { id: 'storage', label: 'settings.dataStorage.title' },
  ] },
  { id: 'security', items: [
    { id: 'lock', label: 'lock.settings.toggle' },
    { id: 'bio',  label: 'lock.settings.bio' },
  ] },
  { id: 'notifications', items: [
    { id: 'push', label: 'settings.push.channel.title' },
  ] },
  { id: 'plan', items: [
    { id: 'license', label: 'settings.group.plan.license' },
    { id: 'upgrade', label: 'settings.group.plan.upgrade' },
    { id: 'cancel',  label: 'settings.cancelSub.label' },
  ] },
  { id: 'advanced', items: [
    { id: 'demo',        label: 'settings.loadDemo.label' },
    { id: 'diagnostics', label: 'settings.diagnostics.label' },
    { id: 'onboarding',  label: 'settings.resetOnboarding.label' },
    { id: 'install',     label: 'settings.install.title' },
  ] },
  { id: 'danger', items: [
    { id: 'clearAll',      label: 'settings.clearAll.label' },
    { id: 'deleteAccount', label: 'deleteAccount.title' },
  ] },
].map(g => ({
  ...g,
  title: `settings.group.${g.id}.title`,
  desc: `settings.group.${g.id}.desc`,
  kw: `settings.group.${g.id}.kw`,
}))

export const GROUP_IDS = SETTINGS_GROUPS.map(g => g.id)
export const isGroupId = (id) => typeof id === 'string' && GROUP_IDS.includes(id)
export const groupById = (id) => SETTINGS_GROUPS.find(g => g.id === id) || null

// Antes (pantalla única, hasta el 30-oct-2026) → ahora. Cada fila:
// [clave o componente que identifica el control, grupo nuevo, archivo donde vive].
// | Antes (bloque de la pantalla larga)            | Ahora                         |
// |------------------------------------------------|-------------------------------|
// | Preferencias: moneda, idioma                   | Moneda e idioma (hoja)        |
// | Preferencias: moneda dual + tasa (bloque entero)| Moneda e idioma               |
// | Preferencias: país, identificador fiscal       | Perfil y país                 |
// | Preferencias: tema, emoji en categorías        | Apariencia                    |
// | Plantillas por perfil                          | Plantillas                    |
// | Respaldo y restauración (+ copia previa fijos) | Datos y respaldo              |
// | Seguridad (PIN, biometría)                     | Seguridad                     |
// | Sincronización entre dispositivos              | Datos y respaldo              |
// | Notificaciones                                 | Notificaciones                |
// | Otras acciones: exportar CSV                   | Datos y respaldo              |
// | Otras acciones: demo, diagnóstico, onboarding  | Avanzado                      |
// | Otras acciones: cuenta / cerrar sesión         | Perfil y país                 |
// | Otras acciones: licencia, cancelar, Probar Pro | Suscripción y plan            |
// | Otras acciones: borrar todos los datos         | Zona de riesgo                |
// | ¿Dónde se guardan tus datos?                   | Datos y respaldo              |
// | Eliminar la cuenta                             | Zona de riesgo                |
// | Instalar como app                              | Avanzado                      |
// | Soporte y pie de versión                       | Raíz (al final)               |
export const CONTROL_MAP = [
  ['settings.currency.label',          'currency',      'CurrencyScreen.jsx'],
  ['settings.confirmChangeCurrency',   'currency',      'CurrencyScreen.jsx'],
  ['settings.language.label',          'currency',      'CurrencyScreen.jsx'],
  ['settings.dualCurrency.label',      'currency',      'CurrencyScreen.jsx'],
  ['settings.exchangeRate.label',      'currency',      'CurrencyScreen.jsx'],
  ['settings.exchangeRate.reset',      'currency',      'CurrencyScreen.jsx'],
  ['settings.dualCurrency.alreadyUsd', 'currency',      'CurrencyScreen.jsx'],
  ['settings.country.label',           'profile',       'ProfileScreen.jsx'],
  ['settings.taxId.title',             'profile',       'ProfileScreen.jsx'],
  ['settings.account.logoutBtn',       'profile',       'ProfileScreen.jsx'],
  ['settings.theme.label',             'appearance',    'AppearanceScreen.jsx'],
  ['settings.categoryEmoji.label',     'appearance',    'AppearanceScreen.jsx'],
  ['<TemplateSelector',                'templates',     'index.jsx'],
  ['<BackupManager',                   'data',          'DataScreen.jsx'],
  ['<SnapshotRestore',                 'data',          'DataScreen.jsx'],
  ['<SyncSection',                     'data',          'DataScreen.jsx'],
  ['settings.exportCsv.label',         'data',          'DataScreen.jsx'],
  ['settings.dataStorage.title',       'data',          'DataScreen.jsx'],
  ['<SecuritySection',                 'security',      'index.jsx'],
  ['enablePush',                       'notifications', 'NotificationsScreen.jsx'],
  ['settings.license.label',           'plan',          'PlanScreen.jsx'],
  ['settings.confirmDeactivateLicense','plan',          'PlanScreen.jsx'],
  ['settings.cancelSub.label',         'plan',          'PlanScreen.jsx'],
  ['<UpgradeCard',                     'plan',          'PlanScreen.jsx'],
  ['settings.loadDemo.label',          'advanced',      'AdvancedScreen.jsx'],
  ['settings.confirmLoadDemo',         'advanced',      'AdvancedScreen.jsx'],
  ['<DiagnosticsRow',                  'advanced',      'AdvancedScreen.jsx'],
  ['settings.resetOnboarding.label',   'advanced',      'AdvancedScreen.jsx'],
  ['settings.install.title',           'advanced',      'AdvancedScreen.jsx'],
  ['settings.clearAll.label',          'danger',        'DangerScreen.jsx'],
  ['settings.confirmDeleteAll',        'danger',        'DangerScreen.jsx'],
  ['<DeleteAccountSection',            'danger',        'DangerScreen.jsx'],
  ['settings.support.line',            null,            'index.jsx'],
  ['settings.footer',                  null,            'index.jsx'],
]

// Palabras de una lista "a, b, c" traducida; tolera claves sin traducir.
function words(t, key) {
  if (!key) return ''
  const v = t(key)
  return v === key ? '' : String(v)
}

// Busca en las filas y en los ajustes de adentro. Todas las palabras de la
// consulta tienen que aparecer (sin tildes ni mayúsculas). Devuelve null si la
// consulta está vacía (se muestra la lista normal) o una lista ordenada:
// primero las filas que coinciden por título, después el resto de filas, y
// después los ajustes de adentro (con su fila como contexto).
//   { kind: 'group', groupId, label }
//   { kind: 'item',  groupId, itemId, label, context }
export function searchSettings(query, t, groups = SETTINGS_GROUPS) {
  const terms = normalize(query).split(/[\s,]+/).filter(Boolean)
  if (!terms.length) return null
  const has = (hay) => { const h = normalize(hay); return terms.every(w => h.includes(w)) }
  const byTitle = [], byOther = [], items = []
  for (const g of groups) {
    const title = t(g.title)
    if (has(title)) byTitle.push({ kind: 'group', groupId: g.id, label: title })
    else if (has(`${title} ${t(g.desc)} ${words(t, g.kw)}`)) byOther.push({ kind: 'group', groupId: g.id, label: title })
    for (const it of g.items || []) {
      const label = t(it.label)
      if (has(`${label} ${words(t, it.kw)}`)) items.push({ kind: 'item', groupId: g.id, itemId: it.id, label, context: title })
    }
  }
  // Un ajuste cuyo nombre es igual al de su fila (Plantillas) no se repite.
  const shown = new Set([...byTitle, ...byOther].map(r => `${r.groupId}|${normalize(r.label)}`))
  return [...byTitle, ...byOther, ...items.filter(r => !shown.has(`${r.groupId}|${normalize(r.label)}`))]
}

// Estado de la subpantalla en history.state (misma URL, como pageStack.js):
// así el botón atrás del navegador/Android y el gesto de iOS vuelven de la
// subpantalla a la raíz de Ajustes antes de salir de Ajustes.
export const SUB_KEY = 'fosSettingsSub'
export function subFromState(state) {
  const id = state && typeof state === 'object' ? state[SUB_KEY] : null
  return isGroupId(id) ? id : null
}
export function withSub(state, id) {
  const base = state && typeof state === 'object' ? { ...state } : {}
  delete base.fosScroll // el scroll guardado es de la raíz, no de la subpantalla
  if (isGroupId(id)) base[SUB_KEY] = id
  else delete base[SUB_KEY]
  return base
}

// Abrir Ajustes directo en una subpantalla desde otra página (p. ej. el botón
// "Probar Pro" del Menú → Suscripción y plan): quien navega deja el id en
// sessionStorage y Ajustes lo consume una sola vez al montarse.
export const PENDING_SUB_KEY = 'fos_settings_open'
export function requestSettingsSub(id, storage = globalThis.sessionStorage) {
  try { if (isGroupId(id)) storage?.setItem(PENDING_SUB_KEY, id) } catch { /* modo privado */ }
}
export function takePendingSub(storage = globalThis.sessionStorage) {
  try {
    const id = storage?.getItem(PENDING_SUB_KEY)
    storage?.removeItem(PENDING_SUB_KEY)
    return isGroupId(id) ? id : null
  } catch { return null }
}
