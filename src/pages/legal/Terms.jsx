// src/pages/legal/Terms.jsx
// Términos de Uso — moyiq (es/en/pt/de, según settings.language).
// El texto vive en ./termsContent.jsx (sin hooks, testeado en legal.test.js); este archivo
// solo elige el idioma. Idioma desconocido → español.

import { PageHeader } from '../../components/ui/index.jsx'
import { useT } from '../../i18n/useT.js'
import { pickLang } from './legalMeta.js'
import { TERMS_CONTENT } from './termsContent.jsx'
import { isNativeApp } from '../../native/platform.js'

export default function Terms() {
  const { lang } = useT()
  const { title, sub, Body } = pickLang(TERMS_CONTENT, lang)
  return (
    <div className="stack">
      <PageHeader title={title} sub={sub} />
      {/* App de tienda: versión sin precios, Stripe, prueba ni clave (AND-5). */}
      <Body store={isNativeApp()} />
    </div>
  )
}
