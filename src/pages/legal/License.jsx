// src/pages/legal/License.jsx
// Términos de Licencia por Plan — MOY IQ (es/en/pt)
// ACTUALIZADO 2026-09-12: modelo vigente (Starter gratis / Pro por suscripción
// US$4.99 mensual o US$39.99 anual, app web, sin redistribución). Reemplaza el
// modelo de pago único (Personal US$19 / Pro US$29) vigente hasta 2026-09-11 —
// nadie compró bajo esos términos todavía (0 clientes reales confirmados en la
// auditoría del 11-sep), así que no hay licencias existentes a las que este
// cambio les modifique condiciones ya aceptadas.
// Enterprise / white-label: bajo contacto directo.

import { PageHeader } from '../../components/ui/index.jsx'
import { useT } from '../../i18n/useT.js'
import s from './legal.module.css'

const PLANS = {
  es: [
    {
      name: 'Starter — Gratis',
      allowed: [
        'Uso personal ilimitado, sin costo y sin límite de tiempo',
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
        'Unlimited personal use, at no cost and with no time limit',
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
        'Advisor Mode: traffic light, alerts, and professional PDF report for client work',
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
        'Uso pessoal ilimitado, sem custo e sem limite de tempo',
        'Orçamento, receitas, despesas, acompanhamento de dívidas e metas',
        'Sincronização criptografada opcional entre seus próprios dispositivos',
        'Exportação completa dos seus dados (JSON/CSV) a qualquer momento',
      ],
      notAllowed: [
        'Uso comercial com clientes (requer o plano Pro)',
        'Revender ou redistribuir o acesso em qualquer forma',
      ],
    },
    {
      name: 'Pro — US$4.99/mês ou US$39.99/ano',
      featured: true,
      allowed: [
        'Tudo do plano Starter',
        'Modo Consultor: semáforo, alertas e relatório PDF profissional para trabalhar com clientes',
        'Exportação de relatórios PDF',
        'Multi-moeda',
        'Módulos fiscais por país (APV Chile, PPR Portugal, deduções, etc.)',
        'Simulador de quitação de dívidas (Avalanche/Snowball)',
      ],
      notAllowed: [
        'Compartilhar a chave de licença com terceiros (cada consultor precisa da sua própria licença)',
        'Revender o acesso ou cobrar de terceiros pelo uso da sua instância',
        'Usar o nome ou a marca "MOY IQ" como próprios',
      ],
    },
  ],
}

const COPY = {
  es: {
    title: 'Términos de Licencia',
    sub: 'Derechos y restricciones por plan · MAXNOVA & LUCI Global LLC · septiembre 2026',
    intro: 'El plan que uses determina cómo puedes usar MOY IQ. Lee con atención el plan correspondiente. Starter es gratis y no vence; Pro es una suscripción con renovación automática.',
    allowed: '✓ Permitido',
    notAllowed: '✗ No permitido',
    billingTitle: 'Suscripción Pro: renovación y cancelación',
    billing1: 'Al contratar Pro, elegís facturación mensual (US$4.99) o anual (US$39.99). El cobro se repite automáticamente al final de cada período (cada mes o cada año, según lo elegido) hasta que canceles.',
    billing2: 'Podés cancelar cuando quieras escribiendo a support@moyiq.app. Tu acceso Pro sigue activo hasta el final del período ya pagado — no se hacen reembolsos parciales por el tiempo no usado, salvo la garantía de 14 días desde tu primera compra (ver la landing para el detalle de esa garantía).',
    billing3: 'Al cancelar o si un cobro de renovación no se puede procesar, tu cuenta pasa automáticamente al plan Starter — no perdés tus datos, solo el acceso a las funciones exclusivas de Pro.',
    enterpriseTitle: 'Enterprise / marca blanca',
    enterpriseText: 'La redistribución de MOY IQ bajo marca propia, el uso en múltiples instancias para clientes o integraciones a medida se contratan por separado. Escríbenos a support@moyiq.app para una propuesta.',
    warrantyTitle: 'Garantías y limitaciones',
    warranty1: 'El software se proporciona "tal cual", sin garantía de ningún tipo, expresa o implícita. En ningún caso MAXNOVA & LUCI Global LLC será responsable de daños directos, indirectos, incidentales o consecuentes que surjan del uso o imposibilidad de uso del software.',
    warranty2: 'Las funcionalidades de análisis financiero de MOY IQ son de orientación general y no constituyen asesoría financiera, tributaria ni legal certificada.',
    contactTitle: 'Contacto para licencias',
    contactText: 'Para consultas sobre upgrade de plan, uso no contemplado o licencias personalizadas: ',
    notice: '⚠ Este documento fue redactado como punto de partida informativo. No constituye asesoría legal. Se recomienda revisión por un abogado antes de uso comercial definitivo.',
  },
  en: {
    title: 'License Terms',
    sub: 'Rights and restrictions per plan · MAXNOVA & LUCI Global LLC · September 2026',
    intro: 'The plan you use determines how you may use MOY IQ. Read carefully the plan that applies to you. Starter is free and never expires; Pro is a subscription with automatic renewal.',
    allowed: '✓ Allowed',
    notAllowed: '✗ Not allowed',
    billingTitle: 'Pro subscription: renewal and cancellation',
    billing1: 'When you subscribe to Pro, you choose monthly (US$4.99) or annual (US$39.99) billing. The charge repeats automatically at the end of each period (every month or every year, as chosen) until you cancel.',
    billing2: 'You can cancel anytime by writing to support@moyiq.app. Your Pro access stays active until the end of the period you already paid for — no partial refunds for unused time, except the 14-day guarantee from your first purchase (see the landing page for details on that guarantee).',
    billing3: 'When you cancel, or if a renewal charge cannot be processed, your account automatically moves to the Starter plan — you keep your data, you just lose access to Pro-only features.',
    enterpriseTitle: 'Enterprise / white-label',
    enterpriseText: 'Redistributing MOY IQ under your own brand, multi-instance use for clients, or custom integrations are contracted separately. Write to support@moyiq.app for a proposal.',
    warrantyTitle: 'Warranties and limitations',
    warranty1: 'The software is provided "as is", without warranty of any kind, express or implied. In no event shall MAXNOVA & LUCI Global LLC be liable for direct, indirect, incidental, or consequential damages arising from the use or inability to use the software.',
    warranty2: "MOY IQ's financial analysis features provide general guidance and do not constitute certified financial, tax, or legal advice.",
    contactTitle: 'License contact',
    contactText: 'For inquiries about plan upgrades, uses not covered here, or custom licenses: ',
    notice: '⚠ This document was drafted as an informational starting point. It does not constitute legal advice. Review by an attorney is recommended before definitive commercial use.',
  },
  pt: {
    title: 'Termos de Licença',
    sub: 'Direitos e restrições por plano · MAXNOVA & LUCI Global LLC · setembro 2026',
    intro: 'O plano que você usa determina como pode usar o MOY IQ. Leia com atenção o plano correspondente. O Starter é gratuito e não vence; o Pro é uma assinatura com renovação automática.',
    allowed: '✓ Permitido',
    notAllowed: '✗ Não permitido',
    billingTitle: 'Assinatura Pro: renovação e cancelamento',
    billing1: 'Ao assinar o Pro, você escolhe cobrança mensal (US$4.99) ou anual (US$39.99). A cobrança se repete automaticamente ao final de cada período (a cada mês ou a cada ano, conforme escolhido) até você cancelar.',
    billing2: 'Você pode cancelar quando quiser escrevendo para support@moyiq.app. Seu acesso Pro continua ativo até o final do período já pago — não há reembolso parcial pelo tempo não utilizado, exceto a garantia de 14 dias a partir da sua primeira compra (veja a landing page para o detalhe dessa garantia).',
    billing3: 'Ao cancelar, ou se uma cobrança de renovação não puder ser processada, sua conta passa automaticamente para o plano Starter — você não perde seus dados, apenas o acesso às funções exclusivas do Pro.',
    enterpriseTitle: 'Enterprise / marca branca',
    enterpriseText: 'A redistribuição do MOY IQ sob marca própria, o uso em múltiplas instâncias para clientes ou integrações sob medida são contratados separadamente. Escreva para support@moyiq.app para uma proposta.',
    warrantyTitle: 'Garantias e limitações',
    warranty1: 'O software é fornecido "tal como está", sem garantia de qualquer tipo, expressa ou implícita. Em nenhum caso a MAXNOVA & LUCI Global LLC será responsável por danos diretos, indiretos, incidentais ou consequentes decorrentes do uso ou impossibilidade de uso do software.',
    warranty2: 'As funcionalidades de análise financeira do MOY IQ são de orientação geral e não constituem aconselhamento financeiro, tributário nem jurídico certificado.',
    contactTitle: 'Contato para licenças',
    contactText: 'Para questões sobre upgrade de plano, uso não contemplado ou licenças personalizadas: ',
    notice: '⚠ Este documento foi redigido como ponto de partida informativo. Não constitui aconselhamento jurídico. Recomenda-se revisão por um advogado antes de uso comercial definitivo.',
  },
}

export default function License() {
  const { lang } = useT()
  const c = COPY[lang] || COPY.es
  const plans = PLANS[lang] || PLANS.es

  return (
    <div className="stack">
      <PageHeader title={c.title} sub={c.sub} />

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
          <h2>{c.contactTitle}</h2>
          <p>{c.contactText}<strong>support@moyiq.app</strong></p>
        </div>

        <div className={s.legalNotice}>{c.notice}</div>
      </div>
    </div>
  )
}
