// src/pages/legal/Disclaimer.jsx
// Aviso legal / disclaimer financiero — MOY IQ (es/en/pt/de, según settings.language).
// El texto vive en ./disclaimerContent.jsx (sin hooks, testeado en legal.test.js); este archivo
// solo elige el idioma. Idioma desconocido → español.

import { PageHeader } from '../../components/ui/index.jsx'
import { useT } from '../../i18n/useT.js'
import { pickLang } from './legalMeta.js'
import { DISCLAIMER_CONTENT } from './disclaimerContent.jsx'

export default function Disclaimer() {
  const { lang } = useT()
  const { title, sub, Body } = pickLang(DISCLAIMER_CONTENT, lang)
  return (
    <div className="stack">
      <PageHeader title={title} sub={sub} />
      <Body />
    </div>
  )
}
