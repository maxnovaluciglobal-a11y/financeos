// src/pages/legal/deLegal.js
// Rechtstexte für Deutschland (Impressum, AGB, Widerrufsbelehrung,
// Datenschutzerklärung, Kündigungsformular) sollen unter moyiq.app/de/ liegen.
// Solange sie dort nicht veröffentlicht sind, nennen die deutschen Seiten in der
// App die Adresse nur als Text — keine Links ins Leere.

import { createElement } from 'react'

export const DE_LEGAL_PUBLISHED = false // TODO: auf true setzen, sobald moyiq.app/de/ (Impressum, AGB, Widerruf, Datenschutz) veröffentlicht ist

export const DE_LEGAL_URLS = {
  impressum: 'https://moyiq.app/de/impressum.html',
  agb: 'https://moyiq.app/de/agb.html',
  widerruf: 'https://moyiq.app/de/widerruf.html',
  datenschutz: 'https://moyiq.app/de/datenschutz.html',
  kuendigen: 'https://moyiq.app/de/kuendigen.html',
}

// Verweis auf eine deutsche Rechtsseite: Link, wenn veröffentlicht; sonst die
// künftige Adresse als reiner Text (ohne https://), damit kein toter Link entsteht.
// `published` ist nur für Tests überschreibbar.
export function deLegalRef(key, label, published = DE_LEGAL_PUBLISHED) {
  const url = DE_LEGAL_URLS[key]
  if (published) {
    return createElement('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, label)
  }
  return `${label} (künftig unter ${url.replace(/^https:\/\//, '')})`
}
