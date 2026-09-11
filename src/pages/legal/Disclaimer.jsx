// src/pages/legal/Disclaimer.jsx
// Disclaimer financiero completo — página dentro de la app (es/en/pt)

import { PageHeader } from '../../components/ui/index.jsx'
import { useT } from '../../i18n/useT.js'
import s from './legal.module.css'

function EsContent() {
  return (
    <>
      <PageHeader title="Aviso Legal y Disclaimer" sub="Naturaleza de la herramienta · Limitaciones · Uso responsable" />
      <div className={s.legalWrap}>
        <div className={s.warnBox} style={{ marginBottom: 0 }}>
          <strong>MOY IQ es una herramienta de organización financiera personal.</strong>{' '}
          No es un asesor financiero, tributario, de inversión ni una entidad regulada.
          Los datos y análisis que muestra se basan exclusivamente en la información
          que el usuario ingresa y no constituyen recomendaciones profesionales.
        </div>

        <div className={s.section}>
          <h2>Qué es MOY IQ</h2>
          <p>MOY IQ es una herramienta de software que permite a los usuarios:</p>
          <ul className={s.list}>
            <li>Registrar y categorizar ingresos y gastos</li>
            <li>Establecer presupuestos mensuales por categoría</li>
            <li>Hacer seguimiento de deudas y metas de ahorro</li>
            <li>Visualizar su situación financiera de forma organizada</li>
            <li>Exportar sus datos para análisis externos</li>
          </ul>
        </div>

        <div className={s.section}>
          <h2>Qué NO es MOY IQ</h2>
          <ul className={s.listWarn}>
            <li>No es un asesor financiero ni reemplaza la consulta con uno</li>
            <li>No es un asesor tributario ni fiscal</li>
            <li>No es un broker ni intermediario de inversiones</li>
            <li>No es un banco ni entidad financiera regulada</li>
            <li>No garantiza resultados financieros específicos</li>
            <li>No predice comportamientos futuros del mercado</li>
          </ul>
        </div>

        <div className={s.section}>
          <h2>Sobre las proyecciones y cálculos</h2>
          <p>
            Las proyecciones de flujo de caja, estimaciones de ahorro y análisis que
            muestra MOY IQ son <strong>cálculos matemáticos basados en los datos
            históricos que el usuario ingresó</strong>. No consideran factores externos,
            cambios en el mercado, inflación futura, cambios laborales ni ningún otro
            evento impredecible.
          </p>
          <p>
            Estas proyecciones son orientativas y no deben usarse como base única para
            decisiones financieras importantes sin consultar a un profesional certificado.
          </p>
        </div>

        <div className={s.section}>
          <h2>Responsabilidad del usuario</h2>
          <p>
            El usuario es responsable de la exactitud de los datos que ingresa y de las
            decisiones que toma basándose en la información que muestra la herramienta.
            MAXNOVA & LUCI Global LLC no asume responsabilidad por pérdidas o perjuicios derivados del
            uso de MOY IQ.
          </p>
        </div>

        <div className={s.section}>
          <h2>Para asesores y profesionales</h2>
          <p>
            Si eres un asesor financiero, coach, contador o educador que utiliza MOY IQ
            como herramienta complementaria a tu servicio profesional, es tu responsabilidad:
          </p>
          <ul className={s.list}>
            <li>Comunicar claramente a tus clientes la naturaleza de la herramienta</li>
            <li>No presentar MOY IQ como sustituto de asesoría profesional</li>
            <li>Cumplir con las regulaciones aplicables en tu jurisdicción</li>
          </ul>
        </div>

        <div className={s.legalNotice}>
          Para consultas: <strong>support@moyiq.app</strong> ·
          Revisado por MAXNOVA & LUCI Global LLC · 2026
        </div>
      </div>
    </>
  )
}

function EnContent() {
  return (
    <>
      <PageHeader title="Legal Notice & Disclaimer" sub="Nature of the tool · Limitations · Responsible use" />
      <div className={s.legalWrap}>
        <div className={s.warnBox} style={{ marginBottom: 0 }}>
          <strong>MOY IQ is a personal finance organization tool.</strong>{' '}
          It is not a financial, tax, or investment advisor, nor a regulated entity.
          The data and analyses it displays are based exclusively on information the
          user enters and do not constitute professional recommendations.
        </div>

        <div className={s.section}>
          <h2>What MOY IQ is</h2>
          <p>MOY IQ is a software tool that lets users:</p>
          <ul className={s.list}>
            <li>Record and categorize income and expenses</li>
            <li>Set monthly budgets by category</li>
            <li>Track debts and savings goals</li>
            <li>Visualize their financial situation in an organized way</li>
            <li>Export their data for external analysis</li>
          </ul>
        </div>

        <div className={s.section}>
          <h2>What MOY IQ is NOT</h2>
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
          <h2>About projections and calculations</h2>
          <p>
            The cash-flow projections, savings estimates, and analyses MOY IQ displays
            are <strong>mathematical calculations based on the historical data the user
            entered</strong>. They do not consider external factors, market changes, future
            inflation, employment changes, or any other unpredictable event.
          </p>
          <p>
            These projections are indicative and should not be used as the sole basis for
            important financial decisions without consulting a certified professional.
          </p>
        </div>

        <div className={s.section}>
          <h2>User responsibility</h2>
          <p>
            The user is responsible for the accuracy of the data they enter and for the
            decisions they make based on the information the tool displays.
            MAXNOVA & LUCI Global LLC assumes no responsibility for losses or damages arising
            from the use of MOY IQ.
          </p>
        </div>

        <div className={s.section}>
          <h2>For advisors and professionals</h2>
          <p>
            If you are a financial advisor, coach, accountant, or educator using MOY IQ
            as a complementary tool to your professional service, it is your responsibility to:
          </p>
          <ul className={s.list}>
            <li>Clearly communicate the nature of the tool to your clients</li>
            <li>Not present MOY IQ as a substitute for professional advice</li>
            <li>Comply with the regulations applicable in your jurisdiction</li>
          </ul>
        </div>

        <div className={s.legalNotice}>
          Inquiries: <strong>support@moyiq.app</strong> ·
          Reviewed by MAXNOVA & LUCI Global LLC · 2026
        </div>
      </div>
    </>
  )
}

function PtContent() {
  return (
    <>
      <PageHeader title="Aviso Legal e Disclaimer" sub="Natureza da ferramenta · Limitações · Uso responsável" />
      <div className={s.legalWrap}>
        <div className={s.warnBox} style={{ marginBottom: 0 }}>
          <strong>O MOY IQ é uma ferramenta de organização financeira pessoal.</strong>{' '}
          Não é um consultor financeiro, tributário, de investimentos nem uma entidade
          regulada. Os dados e análises que mostra baseiam-se exclusivamente nas
          informações que o usuário insere e não constituem recomendações profissionais.
        </div>

        <div className={s.section}>
          <h2>O que é o MOY IQ</h2>
          <p>O MOY IQ é uma ferramenta de software que permite aos usuários:</p>
          <ul className={s.list}>
            <li>Registrar e categorizar receitas e despesas</li>
            <li>Definir orçamentos mensais por categoria</li>
            <li>Acompanhar dívidas e metas de poupança</li>
            <li>Visualizar sua situação financeira de forma organizada</li>
            <li>Exportar seus dados para análises externas</li>
          </ul>
        </div>

        <div className={s.section}>
          <h2>O que o MOY IQ NÃO é</h2>
          <ul className={s.listWarn}>
            <li>Não é um consultor financeiro nem substitui a consulta a um</li>
            <li>Não é um consultor tributário nem fiscal</li>
            <li>Não é um corretor nem intermediário de investimentos</li>
            <li>Não é um banco nem entidade financeira regulada</li>
            <li>Não garante resultados financeiros específicos</li>
            <li>Não prevê comportamentos futuros do mercado</li>
          </ul>
        </div>

        <div className={s.section}>
          <h2>Sobre as projeções e cálculos</h2>
          <p>
            As projeções de fluxo de caixa, estimativas de poupança e análises que o
            MOY IQ mostra são <strong>cálculos matemáticos baseados nos dados
            históricos que o usuário inseriu</strong>. Não consideram fatores externos,
            mudanças no mercado, inflação futura, mudanças de emprego nem qualquer outro
            evento imprevisível.
          </p>
          <p>
            Essas projeções são orientativas e não devem ser usadas como base única para
            decisões financeiras importantes sem consultar um profissional certificado.
          </p>
        </div>

        <div className={s.section}>
          <h2>Responsabilidade do usuário</h2>
          <p>
            O usuário é responsável pela exatidão dos dados que insere e pelas decisões
            que toma com base nas informações que a ferramenta mostra.
            A MAXNOVA & LUCI Global LLC não assume responsabilidade por perdas ou prejuízos
            decorrentes do uso do MOY IQ.
          </p>
        </div>

        <div className={s.section}>
          <h2>Para consultores e profissionais</h2>
          <p>
            Se você é um consultor financeiro, coach, contador ou educador que usa o
            MOY IQ como ferramenta complementar ao seu serviço profissional, é sua
            responsabilidade:
          </p>
          <ul className={s.list}>
            <li>Comunicar claramente aos seus clientes a natureza da ferramenta</li>
            <li>Não apresentar o MOY IQ como substituto de aconselhamento profissional</li>
            <li>Cumprir as regulações aplicáveis na sua jurisdição</li>
          </ul>
        </div>

        <div className={s.legalNotice}>
          Para questões: <strong>support@moyiq.app</strong> ·
          Revisado pela MAXNOVA & LUCI Global LLC · 2026
        </div>
      </div>
    </>
  )
}

export default function Disclaimer() {
  const { lang } = useT()
  const Content = lang === 'en' ? EnContent : lang === 'pt' ? PtContent : EsContent
  return <div className="stack"><Content /></div>
}
