// src/pages/legal/licenseContent.jsx
// Términos de Licencia por Plan — MOY IQ, contenido por idioma (es/en/pt/de).
// Sin hooks ni useT: License.jsx elige el idioma y legal.test.js lo renderiza en node.
// Modelo vigente desde 2026-09-12: Starter gratis (uso personal, no comercial) / Pro por
// suscripción US$4.99 mensual o US$39.99 anual (uso comercial con hasta 30 clientes).
// Reemplazó al modelo de pago único (Personal US$19 / Pro US$29) vigente hasta
// 2026-09-11 — 0 clientes reales confirmados bajo esos términos (auditoría del 11-sep).
// ACTUALIZADO 2026-10: cuenta gratuita obligatoria, garantía técnica de 14 días referida a
// los Términos de Uso (no a la landing), sin prueba gratuita (apagada, ver
// docs/billing-trial-runbook.md) y nota "antes FinanceOS": las claves siguen teniendo el
// formato FNOS-… y cualquier licencia emitida con el nombre anterior tiene que seguir
// reconociéndose como válida.
// Enterprise / white-label: bajo contacto directo.
// Revisión legal completada 2026-10-08 (investigación con fuentes, sin abogado colegiado).

// vitest.config.js no carga el plugin de React: el JSX se transforma con el runtime
// clásico (React.createElement), así que React tiene que estar en scope.
import React from 'react' // eslint-disable-line no-unused-vars
import s from './legal.module.css'
import { LAST_UPDATED, OPERATOR } from './legalMeta.js'
import { deLegalRef } from './deLegal.js'

export const PLANS = {
  es: [
    {
      name: 'Starter — Gratis',
      allowed: [
        'Uso personal ilimitado, sin costo y sin límite de tiempo (requiere una cuenta gratuita)',
        'Presupuesto, ingresos, gastos, seguimiento de deudas y metas',
        'Sincronización cifrada opcional entre tus propios dispositivos',
        'Exportación completa de tus datos (JSON/CSV) en cualquier momento',
      ],
      notAllowed: [
        'Uso comercial con clientes (requiere plan Pro)',
        'Revender o redistribuir el acceso en cualquier forma',
      ],
    },
    {
      name: 'Pro — US$4.99/mes o US$39.99/año',
      featured: true,
      allowed: [
        'Todo lo del plan Starter',
        'Uso profesional con hasta 30 clientes mientras la suscripción esté activa',
        'Modo Asesor: semáforo, alertas y reporte PDF profesional para trabajar con clientes',
        'Exportación de reportes PDF',
        'Multi-moneda',
        'Módulos fiscales por país (APV Chile, PPR Portugal, deducciones, etc.)',
        'Simulador de liquidación de deudas (Avalanche/Snowball)',
      ],
      notAllowed: [
        'Compartir la clave de licencia con terceros (cada asesor necesita su propia licencia)',
        'Revender el acceso o cobrarle a terceros por usar tu instancia',
        'Usar el nombre o la marca "MOY IQ" como propios',
      ],
    },
  ],
  en: [
    {
      name: 'Starter — Free',
      allowed: [
        'Unlimited personal use, at no cost and with no time limit (requires a free account)',
        'Budget, income, expenses, debt tracking, and goals',
        'Optional encrypted sync across your own devices',
        'Full export of your data (JSON/CSV) at any time',
      ],
      notAllowed: [
        'Commercial use with clients (requires the Pro plan)',
        'Reselling or redistributing access in any form',
      ],
    },
    {
      name: 'Pro — US$4.99/mo or US$39.99/yr',
      featured: true,
      allowed: [
        'Everything in the Starter plan',
        'Professional use with up to 30 clients while the subscription is active',
        'Advisor Mode: status signals, alerts, and a professional PDF report for client work',
        'PDF report export',
        'Multi-currency',
        'Country-specific tax modules (APV Chile, PPR Portugal, deductions, etc.)',
        'Debt payoff simulator (Avalanche/Snowball)',
      ],
      notAllowed: [
        'Sharing the license key with third parties (each advisor needs their own license)',
        'Reselling access or charging third parties to use your instance',
        'Using the "MOY IQ" name or brand as your own',
      ],
    },
  ],
  pt: [
    {
      name: 'Starter — Gratuito',
      allowed: [
        'Uso pessoal ilimitado, sem custo e sem limite de tempo (requer uma conta gratuita)',
        'Orçamento, receitas, despesas, acompanhamento de dívidas e metas',
        'Sincronização criptografada opcional entre seus próprios dispositivos',
        'Exportação completa dos seus dados (JSON/CSV) a qualquer momento',
      ],
      notAllowed: [
        'Uso comercial com clientes (requer o plano Pro)',
        'Revender ou redistribuir o acesso de qualquer forma',
      ],
    },
    {
      name: 'Pro — US$4.99/mês ou US$39.99/ano',
      featured: true,
      allowed: [
        'Tudo do plano Starter',
        'Uso profissional com até 30 clientes enquanto a assinatura estiver ativa',
        'Modo Consultor: semáforo, alertas e relatório PDF profissional para trabalhar com clientes',
        'Exportação de relatórios PDF',
        'Multimoeda',
        'Módulos fiscais por país (APV Chile, PPR Portugal, deduções etc.)',
        'Simulador de quitação de dívidas (Avalanche/Snowball)',
      ],
      notAllowed: [
        'Compartilhar a chave de licença com terceiros (cada consultor precisa da sua própria licença)',
        'Revender o acesso ou cobrar de terceiros pelo uso da sua instância',
        'Usar o nome ou a marca "MOY IQ" como próprios',
      ],
    },
  ],
  de: [
    {
      name: 'Starter — kostenlos',
      allowed: [
        'Unbegrenzte private Nutzung, ohne Entgelt und ohne zeitliche Begrenzung (kostenloses Benutzerkonto erforderlich)',
        'Budget, Einnahmen, Ausgaben, Schulden und Ziele',
        'Optionale verschlüsselte Synchronisierung zwischen Ihren eigenen Geräten',
        'Vollständiger Export Ihrer Daten (JSON/CSV) jederzeit',
      ],
      notAllowed: [
        'Berufliche Nutzung mit Klientinnen und Klienten (erfordert Pro)',
        'Weiterverkauf oder Weitergabe des Zugangs in jeglicher Form',
      ],
    },
    {
      name: 'Pro — US$ 4,99/Monat oder US$ 39,99/Jahr',
      featured: true,
      allowed: [
        'Alle Funktionen von Starter',
        'Berufliche Nutzung mit bis zu 30 Klientinnen und Klienten, solange das Abo aktiv ist',
        'Beratermodus: Ampel, Hinweise und professioneller PDF-Bericht für die Arbeit mit Klienten',
        'Export von PDF-Berichten',
        'Multiwährung',
        'Länderspezifische Steuerwerkzeuge (z. B. „Steuer Deutschland“, APV Chile, PPR Portugal)',
        'Schulden-Simulator (Lawinen- und Schneeballmethode)',
      ],
      notAllowed: [
        'Weitergabe des Lizenzschlüssels an Dritte (jede Beraterin und jeder Berater benötigt eine eigene Lizenz)',
        'Weiterverkauf des Zugangs oder Entgelt von Dritten für die Nutzung Ihrer Instanz',
        'Verwendung des Namens oder der Marke „MOY IQ“ als eigene',
      ],
    },
  ],
}

export const COPY = {
  es: {
    title: 'Términos de Licencia',
    intro: 'El plan que uses determina cómo puedes usar MOY IQ. Para usar la app necesitas una cuenta gratuita. Starter es gratis, de uso personal y no vence; Pro es una suscripción con renovación automática que permite uso profesional con hasta 30 clientes.',
    allowed: '✓ Permitido',
    notAllowed: '✗ No permitido',
    billingTitle: 'Suscripción Pro: renovación y cancelación',
    billing1: 'Al contratar Pro, eliges facturación mensual (US$4.99) o anual (US$39.99). El cobro se repite automáticamente al final de cada período (cada mes o cada año, según lo elegido) hasta que canceles.',
    billing2: 'Puedes cancelar en línea cuando quieras en moyiq.app/cancelar.html (cuando esté disponible, también en Cuenta → Gestionar suscripción) o escribiendo a support@moyiq.app. La cancelación rige al final del período ya pagado y hasta entonces conservas Pro. No se hacen reembolsos parciales por el tiempo no usado, salvo la garantía técnica de 14 días, el derecho de desistimiento de los consumidores de la UE y lo que exija la ley imperativa de tu país, según los Términos de Uso.',
    billing3: 'Al cancelar o si un cobro de renovación no se puede procesar, tu cuenta pasa automáticamente al plan Starter. No pierdes tus datos, solo el acceso a las funciones exclusivas de Pro.',
    enterpriseTitle: 'Enterprise / marca blanca',
    enterpriseText: 'La redistribución de MOY IQ bajo marca propia, el uso en múltiples instancias para clientes o integraciones a medida se contratan por separado. Escríbenos a support@moyiq.app para una propuesta.',
    warrantyTitle: 'Garantías y limitaciones',
    warranty1: 'El software se proporciona "tal cual", sin garantía de ningún tipo, expresa o implícita, salvo la garantía técnica de 14 días de los Términos de Uso y los derechos que la ley aplicable no permita excluir. En ningún caso MAXNOVA & LUCI Global LLC será responsable de daños directos, indirectos, incidentales o consecuentes que surjan del uso o la imposibilidad de uso del software.',
    warranty2: 'Las funciones de análisis financiero de MOY IQ son de orientación general y no constituyen asesoría financiera, tributaria ni legal certificada.',
    formerNameTitle: 'Nombre anterior',
    formerName: 'MOY IQ se llamaba antes FinanceOS. Las licencias emitidas con ese nombre (claves con formato FNOS-…) siguen siendo válidas; el cambio de nombre no modifica sus derechos.',
    contactTitle: 'Contacto para licencias',
    contactText: 'Para consultas sobre cambio de plan, usos no contemplados o licencias personalizadas: ',
  },
  en: {
    title: 'License Terms',
    intro: 'The plan you use determines how you may use MOY IQ. You need a free account to use the app. Starter is free, for personal use, and never expires; Pro is an automatically renewing subscription that allows professional use with up to 30 clients.',
    allowed: '✓ Allowed',
    notAllowed: '✗ Not allowed',
    billingTitle: 'Pro subscription: renewal and cancellation',
    billing1: 'When you subscribe to Pro, you choose monthly (US$4.99) or annual (US$39.99) billing. The charge repeats automatically at the end of each period (every month or every year, as chosen) until you cancel.',
    billing2: 'You can cancel online anytime at moyiq.app/en/cancel.html (when available, also under Account → Manage subscription) or by writing to support@moyiq.app. Cancellation takes effect at the end of the period already paid, and you keep Pro until then. There are no partial refunds for unused time, except under the 14-day technical guarantee, the EU consumer right of withdrawal, and where mandatory law in your country requires one, as set out in the Terms of Use.',
    billing3: 'When you cancel, or if a renewal charge cannot be processed, your account moves automatically to the Starter plan. You keep your data; you only lose access to Pro-only features.',
    enterpriseTitle: 'Enterprise / white-label',
    enterpriseText: 'Redistributing MOY IQ under your own brand, multi-instance use for clients, or custom integrations are contracted separately. Write to support@moyiq.app for a proposal.',
    warrantyTitle: 'Warranties and limitations',
    warranty1: 'The software is provided "as is", without warranty of any kind, express or implied, other than the 14-day technical guarantee in the Terms of Use and any rights that applicable law does not allow to be excluded. In no event shall MAXNOVA & LUCI Global LLC be liable for direct, indirect, incidental, or consequential damages arising from the use of, or inability to use, the software.',
    warranty2: "MOY IQ's financial analysis features provide general guidance and are not certified financial, tax, or legal advice.",
    formerNameTitle: 'Former name',
    formerName: 'MOY IQ was previously called FinanceOS. Licenses issued under that name (keys in the FNOS-… format) remain valid; the name change does not alter their rights.',
    contactTitle: 'License contact',
    contactText: 'For plan changes, uses not covered here, or custom licenses: ',
  },
  pt: {
    title: 'Termos de Licença',
    intro: 'O plano que você usa determina como pode usar o MOY IQ. Para usar o app você precisa de uma conta gratuita. O Starter é gratuito, de uso pessoal e não vence; o Pro é uma assinatura com renovação automática que permite uso profissional com até 30 clientes.',
    allowed: '✓ Permitido',
    notAllowed: '✗ Não permitido',
    billingTitle: 'Assinatura Pro: renovação e cancelamento',
    billing1: 'Ao assinar o Pro, você escolhe cobrança mensal (US$4.99) ou anual (US$39.99). A cobrança se repete automaticamente ao final de cada período (a cada mês ou a cada ano, conforme escolhido) até você cancelar.',
    billing2: 'Você pode cancelar online quando quiser em moyiq.app/cancelar.html (quando estiver disponível, também em Conta → Gerenciar assinatura) ou escrevendo para support@moyiq.app. O cancelamento vale ao final do período já pago e até lá você mantém o Pro. Não há reembolso parcial pelo tempo não utilizado, exceto pela garantia técnica de 14 dias, pelo direito de arrependimento dos consumidores da UE e pelo que a lei imperativa do seu país exigir, conforme os Termos de Uso.',
    billing3: 'Ao cancelar, ou se uma cobrança de renovação não puder ser processada, sua conta passa automaticamente para o plano Starter. Você não perde seus dados, apenas o acesso às funções exclusivas do Pro.',
    enterpriseTitle: 'Enterprise / marca branca',
    enterpriseText: 'A redistribuição do MOY IQ sob marca própria, o uso em múltiplas instâncias para clientes ou integrações sob medida são contratados separadamente. Escreva para support@moyiq.app para receber uma proposta.',
    warrantyTitle: 'Garantias e limitações',
    warranty1: 'O software é fornecido "no estado em que se encontra", sem garantia de qualquer tipo, expressa ou implícita, exceto a garantia técnica de 14 dias dos Termos de Uso e os direitos que a lei aplicável não permite excluir. Em nenhum caso a MAXNOVA & LUCI Global LLC será responsável por danos diretos, indiretos, incidentais ou consequentes decorrentes do uso ou da impossibilidade de uso do software.',
    warranty2: 'As funções de análise financeira do MOY IQ são de orientação geral e não constituem aconselhamento financeiro, tributário nem jurídico certificado.',
    formerNameTitle: 'Nome anterior',
    formerName: 'O MOY IQ se chamava FinanceOS. As licenças emitidas com esse nome (chaves no formato FNOS-…) continuam válidas; a mudança de nome não altera os seus direitos.',
    contactTitle: 'Contato para licenças',
    contactText: 'Para questões sobre mudança de plano, usos não previstos ou licenças personalizadas: ',
  },
  // Laufzeit und Kündigung folgen den AGB (de/agb.html § 6), nicht den anderen Sprachen.
  de: {
    title: 'Lizenzbedingungen',
    intro: 'Der Tarif, den Sie nutzen, bestimmt, wie Sie MOY IQ verwenden dürfen. Für die Nutzung benötigen Sie ein kostenloses Benutzerkonto. Starter ist kostenlos, für private Zwecke und unbefristet; Pro ist ein Abo, das sich automatisch verlängert und die berufliche Nutzung mit bis zu 30 Klientinnen und Klienten erlaubt.',
    allowed: '✓ Erlaubt',
    notAllowed: '✗ Nicht erlaubt',
    billingTitle: 'Pro-Abo: Verlängerung und Kündigung',
    billing1: 'Bei Pro wählen Sie monatliche (US$ 4,99) oder jährliche (US$ 39,99) Abrechnung. Das Monatsabo verlängert sich jeweils um einen Monat. Das Jahresabo hat eine erste Laufzeit von zwölf Monaten und verlängert sich danach auf unbestimmte Zeit; es kann dann jederzeit mit einer Frist von einem Monat gekündigt werden, im Voraus gezahlte Entgelte für die Zeit danach erstatten wir anteilig.',
    billing2: (
      <>
        Sie können über die Kündigungsschaltfläche{' '}
        {deLegalRef('kuendigen', '„Verträge hier kündigen“')}, sobald verfügbar in der App unter „Konto →
        Abo verwalten“, per E-Mail an support@moyiq.app oder per Brief kündigen. Ihr Pro-Zugang bleibt bis
        zum Ende des bezahlten Zeitraums aktiv. Ihr gesetzliches Widerrufsrecht und die technische
        Garantie von 14 Tagen ab Kauf (siehe AGB) bleiben unberührt.
      </>
    ),
    billing3: 'Nach Ende des Abos, auch wenn eine Verlängerungszahlung nicht durchgeführt werden kann, wird Ihr Konto auf Starter umgestellt. Ihre Daten bleiben erhalten; nur die Pro-Funktionen stehen nicht mehr zur Verfügung.',
    enterpriseTitle: 'Enterprise / White-Label',
    enterpriseText: 'Die Weitergabe von MOY IQ unter eigener Marke, die Nutzung in mehreren Instanzen für Klienten oder individuelle Integrationen werden gesondert vereinbart. Schreiben Sie uns an support@moyiq.app für ein Angebot.',
    warrantyTitle: 'Gewährleistung und Haftung',
    warranty1: 'Es gelten die gesetzlichen Vorschriften über Mängel digitaler Produkte (§§ 327 ff. BGB) sowie die Haftungsregeln der AGB. Zusätzlich gilt die freiwillige technische Garantie von 14 Tagen ab Kauf.',
    warranty2: 'Die Finanzanalysen in MOY IQ dienen der allgemeinen Orientierung und stellen keine Finanz-, Steuer- oder Rechtsberatung dar.',
    formerNameTitle: 'Früherer Name',
    formerName: 'MOY IQ hieß früher FinanceOS. Unter diesem Namen ausgegebene Lizenzen (Schlüssel im Format FNOS-…) bleiben gültig; die Namensänderung ändert nichts an ihren Rechten.',
    contactTitle: 'Kontakt zu Lizenzen',
    contactText: 'Für Fragen zu Tarifwechseln, hier nicht geregelten Nutzungen oder individuellen Lizenzen: ',
  },
}

function LicenseBody({ c, plans }) {
  return (
    <div className={s.legalWrap}>
      <div className={s.highlight}>{c.intro}</div>

      {plans.map(plan => (
        <div key={plan.name} className={s.planBlock + (plan.featured ? ' ' + s.planFeatured : '')}>
          <h2 className={s.planName}>{plan.name}</h2>
          <div className={s.planCols}>
            <div>
              <div className={s.planSectionTitle} style={{ color: 'var(--grn)' }}>{c.allowed}</div>
              <ul className={s.list}>
                {plan.allowed.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
            <div>
              <div className={s.planSectionTitle} style={{ color: 'var(--red)' }}>{c.notAllowed}</div>
              <ul className={s.listWarn}>
                {plan.notAllowed.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          </div>
        </div>
      ))}

      <div className={s.section}>
        <h2>{c.billingTitle}</h2>
        <p>{c.billing1}</p>
        <p>{c.billing2}</p>
        <p>{c.billing3}</p>
      </div>

      <div className={s.section}>
        <h2>{c.enterpriseTitle}</h2>
        <p>{c.enterpriseText}</p>
      </div>

      <div className={s.section}>
        <h2>{c.warrantyTitle}</h2>
        <p>{c.warranty1}</p>
        <p>{c.warranty2}</p>
      </div>

      <div className={s.section}>
        <h2>{c.formerNameTitle}</h2>
        <p>{c.formerName}</p>
      </div>

      <div className={s.section}>
        <h2>{c.contactTitle}</h2>
        <p>{c.contactText}<strong>support@moyiq.app</strong></p>
      </div>

    </div>
  )
}

function entry(lang) {
  const c = COPY[lang]
  return {
    title: c.title,
    sub: `${LAST_UPDATED[lang]} · ${OPERATOR}`,
    Body: () => <LicenseBody c={c} plans={PLANS[lang]} />,
  }
}

export const LICENSE_CONTENT = {
  es: entry('es'),
  en: entry('en'),
  pt: entry('pt'),
  de: entry('de'),
}
