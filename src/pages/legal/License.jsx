// src/pages/legal/License.jsx
// Términos de Licencia por plan — MOY IQ (es/en/pt/de, según settings.language).
// El texto vive en ./licenseContent.jsx (sin hooks, testeado en legal.test.js); este archivo
// solo elige el idioma. Idioma desconocido → español.

import { PageHeader } from '../../components/ui/index.jsx'
import { useT } from '../../i18n/useT.js'
import { pickLang } from './legalMeta.js'
import { LICENSE_CONTENT } from './licenseContent.jsx'

export default function License() {
  const { lang } = useT()
  const { title, sub, Body } = pickLang(LICENSE_CONTENT, lang)
  return (
    <div className="stack">
      <PageHeader title={title} sub={sub} />
      <Body />
    </div>
  )
}
