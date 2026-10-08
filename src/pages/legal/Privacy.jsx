// src/pages/legal/Privacy.jsx
// Política de Privacidad — MOY IQ (es/en/pt/de, según settings.language).
// El texto vive en ./privacyContent.jsx (sin hooks, testeado en legal.test.js); este archivo
// solo elige el idioma. Idioma desconocido → español.

import { PageHeader } from '../../components/ui/index.jsx'
import { useT } from '../../i18n/useT.js'
import { pickLang } from './legalMeta.js'
import { PRIVACY_CONTENT } from './privacyContent.jsx'

export default function Privacy() {
  const { lang } = useT()
  const { title, sub, Body } = pickLang(PRIVACY_CONTENT, lang)
  return (
    <div className="stack">
      <PageHeader title={title} sub={sub} />
      <Body />
    </div>
  )
}
