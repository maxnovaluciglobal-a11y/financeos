// src/pages/legal/disclaimerContent.jsx
// Aviso legal / disclaimer financiero — MOY IQ, contenido por idioma (es/en/pt/de).
// Sin hooks ni useT: Disclaimer.jsx elige el idioma y legal.test.js lo renderiza en node.
// ACTUALIZADO 2026-10: fecha visible, señales de Coach/Modo Asesor y herramientas fiscales
// (alineado con en/disclaimer.html de la landing), datos locales.

// vitest.config.js no carga el plugin de React: el JSX se transforma con el runtime
// clásico (React.createElement), así que React tiene que estar en scope.
import React from 'react' // eslint-disable-line no-unused-vars
import s from './legal.module.css'
import { LAST_UPDATED, OPERATOR } from './legalMeta.js'

function EsBody() {
  return (
    <div className={s.legalWrap}>
      <div className={s.warnBox} style={{ marginBottom: 0 }}>
        <strong>MOY IQ es una herramienta de organización financiera personal.</strong>{' '}
        No es un asesor financiero, tributario ni de inversión, ni una entidad regulada. Los datos
        y análisis que muestra se basan exclusivamente en la información que ingresa el usuario y
        no constituyen recomendaciones profesionales.
      </div>

      <div className={s.section}>
        <h2>Qué es MOY IQ</h2>
        <p>MOY IQ es una herramienta de software que permite:</p>
        <ul className={s.list}>
          <li>Registrar y categorizar ingresos y gastos</li>
          <li>Establecer presupuestos mensuales por categoría</li>
          <li>Hacer seguimiento de deudas y metas de ahorro</li>
          <li>Ver la situación financiera de forma organizada</li>
          <li>Exportar los datos para análisis externos</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>Qué no es MOY IQ</h2>
        <ul className={s.listWarn}>
          <li>No es un asesor financiero ni reemplaza la consulta con uno</li>
          <li>No es un asesor tributario ni fiscal</li>
          <li>No es un bróker ni intermediario de inversiones</li>
          <li>No es un banco ni una entidad financiera regulada</li>
          <li>No garantiza resultados financieros específicos</li>
          <li>No predice el comportamiento futuro del mercado</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>No es asesoría financiera</h2>
        <p>
          Nada en MOY IQ constituye asesoría financiera, tributaria, contable, legal ni de
          inversión. Las señales de MOY IQ Coach y del Modo Asesor son orientativas, se basan en
          los datos que ingresa el usuario y no reemplazan el criterio de un profesional
          certificado.
        </p>
      </div>

      <div className={s.section}>
        <h2>Sobre las proyecciones y cálculos</h2>
        <p>
          Las proyecciones de flujo de caja, estimaciones de ahorro y análisis que muestra MOY IQ
          son <strong>cálculos matemáticos basados en los datos históricos que ingresó el
          usuario</strong>. No consideran factores externos, cambios en el mercado, inflación
          futura, cambios laborales ni otros eventos impredecibles.
        </p>
        <p>
          Estas proyecciones son orientativas y no deben usarse como base única para decisiones
          financieras importantes sin consultar a un profesional certificado.
        </p>
      </div>

      <div className={s.section}>
        <h2>Herramientas fiscales</h2>
        <p>
          Las herramientas fiscales por país son estimaciones educativas basadas en reglas y
          límites publicados. No son asesoría tributaria y no reemplazan a un profesional ni el
          cálculo oficial de la autoridad tributaria.
        </p>
      </div>

      <div className={s.section}>
        <h2>Responsabilidad del usuario</h2>
        <p>
          El usuario es responsable de la exactitud de los datos que ingresa y de las decisiones
          que toma con base en la información que muestra la herramienta. MAXNOVA & LUCI Global LLC
          no asume responsabilidad por pérdidas o perjuicios derivados del uso de MOY IQ, en la
          medida que lo permita la ley aplicable.
        </p>
      </div>

      <div className={s.section}>
        <h2>Para asesores y profesionales</h2>
        <p>
          Quien use MOY IQ como asesor financiero, coach, contador o educador, como herramienta
          complementaria a su servicio profesional, es responsable de:
        </p>
        <ul className={s.list}>
          <li>Comunicar con claridad a sus clientes la naturaleza de la herramienta</li>
          <li>No presentar MOY IQ como sustituto de asesoría profesional</li>
          <li>Cumplir con las regulaciones aplicables en su jurisdicción</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>Datos locales</h2>
        <p>
          Los datos financieros se guardan en el dispositivo del usuario. MAXNOVA & LUCI Global LLC
          no tiene acceso a ellos y no puede recuperarlos si se pierden sin un respaldo previo.
        </p>
      </div>

      <div className={s.legalNotice}>
        Para consultas: <strong>support@moyiq.app</strong> · MAXNOVA & LUCI Global LLC
      </div>
    </div>
  )
}

function EnBody() {
  return (
    <div className={s.legalWrap}>
      <div className={s.warnBox} style={{ marginBottom: 0 }}>
        <strong>MOY IQ is a personal finance organization tool.</strong>{' '}
        It is not a financial, tax, or investment advisor, nor a regulated entity. The data and
        analyses it shows are based only on the information the user enters and are not
        professional recommendations.
      </div>

      <div className={s.section}>
        <h2>What MOY IQ is</h2>
        <p>MOY IQ is a software tool that lets you:</p>
        <ul className={s.list}>
          <li>Record and categorize income and expenses</li>
          <li>Set monthly budgets by category</li>
          <li>Track debts and savings goals</li>
          <li>See your financial situation in an organized way</li>
          <li>Export your data for external analysis</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>What MOY IQ is not</h2>
        <ul className={s.listWarn}>
          <li>Not a financial advisor, nor a replacement for consulting one</li>
          <li>Not a tax advisor</li>
          <li>Not a broker or investment intermediary</li>
          <li>Not a bank or regulated financial entity</li>
          <li>It does not guarantee specific financial results</li>
          <li>It does not predict future market behavior</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>Not financial advice</h2>
        <p>
          Nothing in MOY IQ is financial, tax, accounting, legal, or investment advice. The signals
          generated by MOY IQ Coach and Advisor Mode are for guidance only, are based on the data
          the user enters, and do not replace the judgment of a certified professional.
        </p>
      </div>

      <div className={s.section}>
        <h2>About projections and calculations</h2>
        <p>
          The cash-flow projections, savings estimates, and analyses MOY IQ shows are{' '}
          <strong>mathematical calculations based on the historical data the user entered</strong>.
          They do not account for external factors, market changes, future inflation, changes in
          employment, or other unpredictable events.
        </p>
        <p>
          These projections are indicative and should not be the sole basis for important
          financial decisions without consulting a certified professional.
        </p>
      </div>

      <div className={s.section}>
        <h2>Tax tools</h2>
        <p>
          The country-specific tax tools are educational estimates based on published rules and
          limits. They are not tax advice and do not replace a tax professional or the official
          calculation from the tax authority.
        </p>
      </div>

      <div className={s.section}>
        <h2>User responsibility</h2>
        <p>
          The user is responsible for the accuracy of the data they enter and for the decisions
          they make based on what the tool shows. To the extent permitted by applicable law,
          MAXNOVA & LUCI Global LLC assumes no responsibility for losses or damages arising from
          the use of MOY IQ.
        </p>
      </div>

      <div className={s.section}>
        <h2>For advisors and professionals</h2>
        <p>
          Anyone using MOY IQ as a financial advisor, coach, accountant, or educator, as a
          complement to their professional service, is responsible for:
        </p>
        <ul className={s.list}>
          <li>Clearly explaining the nature of the tool to their clients</li>
          <li>Not presenting MOY IQ as a substitute for professional advice</li>
          <li>Complying with the regulations that apply in their jurisdiction</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>Local data</h2>
        <p>
          Financial data is stored on the user's device. MAXNOVA & LUCI Global LLC has no access to
          it and cannot recover it if it is lost without a prior backup.
        </p>
      </div>

      <div className={s.legalNotice}>
        Questions: <strong>support@moyiq.app</strong> · MAXNOVA & LUCI Global LLC
      </div>
    </div>
  )
}

function PtBody() {
  return (
    <div className={s.legalWrap}>
      <div className={s.warnBox} style={{ marginBottom: 0 }}>
        <strong>O MOY IQ é uma ferramenta de organização financeira pessoal.</strong>{' '}
        Não é um consultor financeiro, tributário ou de investimentos, nem uma entidade regulada.
        Os dados e análises que mostra baseiam-se exclusivamente nas informações que o usuário
        insere e não constituem recomendações profissionais.
      </div>

      <div className={s.section}>
        <h2>O que é o MOY IQ</h2>
        <p>O MOY IQ é uma ferramenta de software que permite:</p>
        <ul className={s.list}>
          <li>Registrar e categorizar receitas e despesas</li>
          <li>Definir orçamentos mensais por categoria</li>
          <li>Acompanhar dívidas e metas de poupança</li>
          <li>Ver a situação financeira de forma organizada</li>
          <li>Exportar os dados para análises externas</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>O que o MOY IQ não é</h2>
        <ul className={s.listWarn}>
          <li>Não é um consultor financeiro nem substitui a consulta a um</li>
          <li>Não é um consultor tributário nem fiscal</li>
          <li>Não é uma corretora nem intermediário de investimentos</li>
          <li>Não é um banco nem uma entidade financeira regulada</li>
          <li>Não garante resultados financeiros específicos</li>
          <li>Não prevê o comportamento futuro do mercado</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>Não é aconselhamento financeiro</h2>
        <p>
          Nada no MOY IQ constitui aconselhamento financeiro, tributário, contábil, jurídico ou de
          investimentos. Os sinais do MOY IQ Coach e do Modo Consultor são orientativos, baseiam-se
          nos dados que o usuário insere e não substituem o julgamento de um profissional
          certificado.
        </p>
      </div>

      <div className={s.section}>
        <h2>Sobre as projeções e cálculos</h2>
        <p>
          As projeções de fluxo de caixa, estimativas de poupança e análises que o MOY IQ mostra
          são <strong>cálculos matemáticos baseados nos dados históricos que o usuário
          inseriu</strong>. Não consideram fatores externos, mudanças no mercado, inflação futura,
          mudanças de emprego nem outros eventos imprevisíveis.
        </p>
        <p>
          Essas projeções são orientativas e não devem ser usadas como base única para decisões
          financeiras importantes sem consultar um profissional certificado.
        </p>
      </div>

      <div className={s.section}>
        <h2>Ferramentas fiscais</h2>
        <p>
          As ferramentas fiscais por país são estimativas educativas baseadas em regras e limites
          publicados. Não são aconselhamento tributário e não substituem um profissional nem o
          cálculo oficial da autoridade tributária.
        </p>
      </div>

      <div className={s.section}>
        <h2>Responsabilidade do usuário</h2>
        <p>
          O usuário é responsável pela exatidão dos dados que insere e pelas decisões que toma com
          base nas informações que a ferramenta mostra. Na medida permitida pela lei aplicável, a
          MAXNOVA & LUCI Global LLC não assume responsabilidade por perdas ou prejuízos decorrentes
          do uso do MOY IQ.
        </p>
      </div>

      <div className={s.section}>
        <h2>Para consultores e profissionais</h2>
        <p>
          Quem usa o MOY IQ como consultor financeiro, coach, contador ou educador, como
          ferramenta complementar ao seu serviço profissional, é responsável por:
        </p>
        <ul className={s.list}>
          <li>Comunicar claramente aos seus clientes a natureza da ferramenta</li>
          <li>Não apresentar o MOY IQ como substituto de aconselhamento profissional</li>
          <li>Cumprir as regulações aplicáveis na sua jurisdição</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>Dados locais</h2>
        <p>
          Os dados financeiros ficam no dispositivo do usuário. A MAXNOVA & LUCI Global LLC não tem
          acesso a eles e não pode recuperá-los se forem perdidos sem um backup prévio.
        </p>
      </div>

      <div className={s.legalNotice}>
        Para questões: <strong>support@moyiq.app</strong> · MAXNOVA & LUCI Global LLC
      </div>
    </div>
  )
}

// RECHTLICHE PRÜFUNG AUSSTEHEND — Entwurf, vor Verkauf an Verbraucher in DE von einer Anwältin/einem Anwalt prüfen lassen
function DeBody() {
  return (
    <div className={s.legalWrap}>
      <div className={s.warnBox} style={{ marginBottom: 0 }}>
        <strong>MOY IQ ist ein Werkzeug zur Organisation persönlicher Finanzen.</strong>{' '}
        Es ist keine Finanz-, Steuer- oder Anlageberatung und kein reguliertes Institut. Die
        angezeigten Daten und Auswertungen beruhen ausschließlich auf Ihren eigenen Angaben und
        stellen keine professionellen Empfehlungen dar.
      </div>

      <div className={s.section}>
        <h2>Was MOY IQ ist</h2>
        <p>MOY IQ ist eine Software, mit der Sie:</p>
        <ul className={s.list}>
          <li>Einnahmen und Ausgaben erfassen und kategorisieren</li>
          <li>Monatliche Budgets je Kategorie festlegen</li>
          <li>Schulden und Sparziele verfolgen</li>
          <li>Ihre finanzielle Lage übersichtlich darstellen</li>
          <li>Ihre Daten für externe Auswertungen exportieren</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>Was MOY IQ nicht ist</h2>
        <ul className={s.listWarn}>
          <li>Keine Finanzberatung und kein Ersatz für eine solche</li>
          <li>Keine Steuerberatung</li>
          <li>Kein Broker und kein Anlagevermittler</li>
          <li>Keine Bank und kein reguliertes Finanzinstitut</li>
          <li>Keine Garantie für bestimmte finanzielle Ergebnisse</li>
          <li>Keine Vorhersage künftiger Marktentwicklungen</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>Keine Finanzberatung</h2>
        <p>
          Nichts in MOY IQ stellt eine Finanz-, Steuer-, Buchhaltungs-, Rechts- oder Anlageberatung
          dar. Die Hinweise von MOY IQ Coach und des Beratermodus dienen nur der Orientierung,
          beruhen auf Ihren Angaben und ersetzen nicht das Urteil einer qualifizierten Fachperson.
        </p>
      </div>

      <div className={s.section}>
        <h2>Prognosen und Berechnungen</h2>
        <p>
          Cashflow-Prognosen, Sparschätzungen und Auswertungen in MOY IQ sind{' '}
          <strong>mathematische Berechnungen auf Grundlage der von Ihnen erfassten historischen
          Daten</strong>. Externe Faktoren, Marktveränderungen, künftige Inflation, berufliche
          Veränderungen oder andere unvorhersehbare Ereignisse berücksichtigen sie nicht.
        </p>
        <p>
          Diese Prognosen dienen der Orientierung. Für wichtige finanzielle Entscheidungen sollten
          Sie sie nicht als alleinige Grundlage verwenden, ohne eine qualifizierte Fachperson zu
          konsultieren.
        </p>
      </div>

      <div className={s.section}>
        <h2>Steuerwerkzeuge</h2>
        <p>
          Die länderspezifischen Steuerwerkzeuge (z. B. „Steuer Deutschland“) sind Schätzungen zu
          Informations- und Bildungszwecken auf Grundlage veröffentlichter Regeln und Grenzwerte.
          Sie sind keine Steuerberatung und ersetzen weder eine Steuerberaterin bzw. einen
          Steuerberater noch die offizielle Steuererklärung (z. B. über ELSTER).
        </p>
      </div>

      <div className={s.section}>
        <h2>Ihre Verantwortung</h2>
        <p>
          Sie sind für die Richtigkeit Ihrer Angaben und für die Entscheidungen verantwortlich, die
          Sie auf Grundlage der angezeigten Informationen treffen. Die Haftung der MAXNOVA & LUCI
          Global LLC richtet sich nach den AGB.
        </p>
      </div>

      <div className={s.section}>
        <h2>Für Beraterinnen, Berater und andere Fachleute</h2>
        <p>
          Wenn Sie MOY IQ als Finanzberater, Coach, Buchhalter oder Lehrender ergänzend zu Ihrer
          beruflichen Tätigkeit nutzen, sind Sie dafür verantwortlich:
        </p>
        <ul className={s.list}>
          <li>Ihren Klientinnen und Klienten die Art des Werkzeugs klar zu erklären</li>
          <li>MOY IQ nicht als Ersatz für professionelle Beratung darzustellen</li>
          <li>Die in Ihrem Land geltenden Vorschriften einzuhalten</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>Lokale Daten</h2>
        <p>
          Ihre Finanzdaten werden auf Ihrem Gerät gespeichert. Die MAXNOVA & LUCI Global LLC hat
          keinen Zugriff darauf und kann sie nicht wiederherstellen, wenn sie ohne vorherige
          Sicherung verloren gehen.
        </p>
      </div>

      <div className={s.legalNotice}>
        Fragen: <strong>support@moyiq.app</strong> · MAXNOVA & LUCI Global LLC
      </div>
    </div>
  )
}

export const DISCLAIMER_CONTENT = {
  es: { title: 'Aviso Legal y Disclaimer', sub: `${LAST_UPDATED.es} · ${OPERATOR}`, Body: EsBody },
  en: { title: 'Legal Notice & Disclaimer', sub: `${LAST_UPDATED.en} · ${OPERATOR}`, Body: EnBody },
  pt: { title: 'Aviso Legal e Disclaimer', sub: `${LAST_UPDATED.pt} · ${OPERATOR}`, Body: PtBody },
  de: { title: 'Haftungshinweis', sub: `${LAST_UPDATED.de} · ${OPERATOR}`, Body: DeBody },
}
