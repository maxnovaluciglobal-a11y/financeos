// src/pages/legal/License.jsx
// Términos de Licencia por Plan — FinanceOS (es/en/pt)
// ACTUALIZADO 2026-07: modelo vigente (Personal US$19 / Pro US$29, pago único,
// app web, sin redistribución). El texto anterior
// describía los planes white-label antiguos ($29/$79/$299), retirados.
// Enterprise / white-label: bajo contacto directo.

import { PageHeader } from '../../components/ui/index.jsx'
import { useT } from '../../i18n/useT.js'
import s from './legal.module.css'

const PLANS = {
  es: [
    {
      name: 'Personal — US$19 (pago único)',
      allowed: [
        'Uso personal ilimitado, sin mensualidades',
        'Todas las funciones base: ingresos, gastos, presupuestos, deudas, metas, reportes',
        'Sincronización cifrada opcional entre tus propios dispositivos',
        'Exportación completa de tus datos (JSON/CSV) en cualquier momento',
      ],
      notAllowed: [
        'Compartir la clave de licencia con terceros',
        'Uso comercial con clientes (requiere plan Pro)',
        'Revender o redistribuir el acceso en cualquier forma',
      ],
    },
    {
      name: 'Pro — US$29 (pago único)',
      featured: true,
      allowed: [
        'Todo lo del plan Personal',
        'Modo Asesor: semáforo, alertas y reporte PDF profesional para trabajar con clientes',
        'Exportación de reportes PDF',
        'Módulos fiscales por país (APV Chile, PPR Portugal, deducciones, etc.)',
        'Simulador de liquidación de deudas (Avalanche/Snowball)',
      ],
      notAllowed: [
        'Compartir la clave de licencia con terceros (cada asesor necesita su propia licencia)',
        'Revender el acceso o cobrarle a terceros por usar tu instancia',
        'Usar el nombre o la marca "FinanceOS" como propios',
      ],
    },
  ],
  en: [
    {
      name: 'Personal — US$19 (one-time payment)',
      allowed: [
        'Unlimited personal use, no monthly fees',
        'All core features: income, expenses, budgets, debts, goals, reports',
        'Optional encrypted sync across your own devices',
        'Full export of your data (JSON/CSV) at any time',
      ],
      notAllowed: [
        'Sharing the license key with third parties',
        'Commercial use with clients (requires the Pro plan)',
        'Reselling or redistributing access in any form',
      ],
    },
    {
      name: 'Pro — US$29 (one-time payment)',
      featured: true,
      allowed: [
        'Everything in the Personal plan',
        'Advisor Mode: traffic light, alerts, and professional PDF report for client work',
        'PDF report export',
        'Country-specific tax modules (APV Chile, PPR Portugal, deductions, etc.)',
        'Debt payoff simulator (Avalanche/Snowball)',
      ],
      notAllowed: [
        'Sharing the license key with third parties (each advisor needs their own license)',
        'Reselling access or charging third parties to use your instance',
        'Using the "FinanceOS" name or brand as your own',
      ],
    },
  ],
  pt: [
    {
      name: 'Personal — US$19 (pagamento único)',
      allowed: [
        'Uso pessoal ilimitado, sem mensalidades',
        'Todas as funções base: receitas, despesas, orçamentos, dívidas, metas, relatórios',
        'Sincronização criptografada opcional entre seus próprios dispositivos',
        'Exportação completa dos seus dados (JSON/CSV) a qualquer momento',
      ],
      notAllowed: [
        'Compartilhar a chave de licença com terceiros',
        'Uso comercial com clientes (requer o plano Pro)',
        'Revender ou redistribuir o acesso em qualquer forma',
      ],
    },
    {
      name: 'Pro — US$29 (pagamento único)',
      featured: true,
      allowed: [
        'Tudo do plano Personal',
        'Modo Consultor: semáforo, alertas e relatório PDF profissional para trabalhar com clientes',
        'Exportação de relatórios PDF',
        'Módulos fiscais por país (APV Chile, PPR Portugal, deduções, etc.)',
        'Simulador de quitação de dívidas (Avalanche/Snowball)',
      ],
      notAllowed: [
        'Compartilhar a chave de licença com terceiros (cada consultor precisa da sua própria licença)',
        'Revender o acesso ou cobrar de terceiros pelo uso da sua instância',
        'Usar o nome ou a marca "FinanceOS" como próprios',
      ],
    },
  ],
}

const COPY = {
  es: {
    title: 'Términos de Licencia',
    sub: 'Derechos y restricciones por plan · MAXNOVA & LUCI Global LLC · julio 2026',
    intro: 'La licencia adquirida determina cómo puedes usar FinanceOS. Lee con atención el plan correspondiente a tu compra. Ambos planes son de pago único: sin mensualidades ni renovaciones.',
    allowed: '✓ Permitido',
    notAllowed: '✗ No permitido',
    enterpriseTitle: 'Enterprise / marca blanca',
    enterpriseText: 'La redistribución de FinanceOS bajo marca propia, el uso en múltiples instancias para clientes o integraciones a medida se contratan por separado. Escríbenos a support@moyiq.app para una propuesta.',
    warrantyTitle: 'Garantías y limitaciones',
    warranty1: 'El software se proporciona "tal cual", sin garantía de ningún tipo, expresa o implícita. En ningún caso MAXNOVA & LUCI Global LLC será responsable de daños directos, indirectos, incidentales o consecuentes que surjan del uso o imposibilidad de uso del software.',
    warranty2: 'Las funcionalidades de análisis financiero de FinanceOS son de orientación general y no constituyen asesoría financiera, tributaria ni legal certificada.',
    contactTitle: 'Contacto para licencias',
    contactText: 'Para consultas sobre upgrade de plan, uso no contemplado o licencias personalizadas: ',
    notice: '⚠ Este documento fue redactado como punto de partida informativo. No constituye asesoría legal. Se recomienda revisión por un abogado antes de uso comercial definitivo.',
  },
  en: {
    title: 'License Terms',
    sub: 'Rights and restrictions per plan · MAXNOVA & LUCI Global LLC · July 2026',
    intro: 'The purchased license determines how you may use FinanceOS. Read carefully the plan corresponding to your purchase. Both plans are one-time payments: no monthly fees, no renewals.',
    allowed: '✓ Allowed',
    notAllowed: '✗ Not allowed',
    enterpriseTitle: 'Enterprise / white-label',
    enterpriseText: 'Redistributing FinanceOS under your own brand, multi-instance use for clients, or custom integrations are contracted separately. Write to support@moyiq.app for a proposal.',
    warrantyTitle: 'Warranties and limitations',
    warranty1: 'The software is provided "as is", without warranty of any kind, express or implied. In no event shall MAXNOVA & LUCI Global LLC be liable for direct, indirect, incidental, or consequential damages arising from the use or inability to use the software.',
    warranty2: "FinanceOS's financial analysis features provide general guidance and do not constitute certified financial, tax, or legal advice.",
    contactTitle: 'License contact',
    contactText: 'For inquiries about plan upgrades, uses not covered here, or custom licenses: ',
    notice: '⚠ This document was drafted as an informational starting point. It does not constitute legal advice. Review by an attorney is recommended before definitive commercial use.',
  },
  pt: {
    title: 'Termos de Licença',
    sub: 'Direitos e restrições por plano · MAXNOVA & LUCI Global LLC · julho 2026',
    intro: 'A licença adquirida determina como você pode usar o FinanceOS. Leia com atenção o plano correspondente à sua compra. Ambos os planos são de pagamento único: sem mensalidades nem renovações.',
    allowed: '✓ Permitido',
    notAllowed: '✗ Não permitido',
    enterpriseTitle: 'Enterprise / marca branca',
    enterpriseText: 'A redistribuição do FinanceOS sob marca própria, o uso em múltiplas instâncias para clientes ou integrações sob medida são contratados separadamente. Escreva para support@moyiq.app para uma proposta.',
    warrantyTitle: 'Garantias e limitações',
    warranty1: 'O software é fornecido "tal como está", sem garantia de qualquer tipo, expressa ou implícita. Em nenhum caso a MAXNOVA & LUCI Global LLC será responsável por danos diretos, indiretos, incidentais ou consequentes decorrentes do uso ou impossibilidade de uso do software.',
    warranty2: 'As funcionalidades de análise financeira do FinanceOS são de orientação geral e não constituem aconselhamento financeiro, tributário nem jurídico certificado.',
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
