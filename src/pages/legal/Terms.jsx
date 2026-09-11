// src/pages/legal/Terms.jsx
// Términos de Uso — MOY IQ (es/en/pt)
// AVISO: Revisar con abogado antes de uso comercial definitivo.
// ACTUALIZADO 2026-07: referencia a planes vigentes (Personal / Pro).

import { PageHeader } from '../../components/ui/index.jsx'
import { useT } from '../../i18n/useT.js'
import s from './legal.module.css'

function EsContent() {
  return (
    <>
      <PageHeader title="Términos de Uso" sub="Última actualización: julio 2026 · MAXNOVA & LUCI Global LLC" />
      <div className={s.legalWrap}>
        <div className={s.highlight}>
          <strong>Importante:</strong> MOY IQ es una herramienta de organización y
          seguimiento financiero personal. No es un asesor financiero, tributario ni de
          inversión. No reemplaza la consulta con profesionales certificados.
        </div>

        <div className={s.section}>
          <h2>1. Aceptación de los términos</h2>
          <p>
            Al acceder y usar MOY IQ, el usuario acepta estos Términos de Uso en su
            totalidad. Si no está de acuerdo con alguna parte, debe dejar de usar la herramienta.
          </p>
        </div>

        <div className={s.section}>
          <h2>2. Naturaleza del servicio</h2>
          <p>
            MOY IQ es una herramienta de software para <strong>organización, diagnóstico y
            seguimiento financiero personal</strong>. Su propósito es ayudar a los usuarios a
            registrar, visualizar y comprender sus finanzas personales.
          </p>
          <p>MOY IQ <strong>no es</strong> y no debe interpretarse como:</p>
          <ul className={s.list}>
            <li>Asesor financiero, tributario, contable ni de inversión</li>
            <li>Institución bancaria, financiera ni entidad regulada</li>
            <li>Proveedor de recomendaciones de inversión</li>
            <li>Sustituto de asesoría profesional certificada</li>
            <li>Herramienta de planificación fiscal o tributaria</li>
          </ul>
          <p>
            Las proyecciones, cálculos y sugerencias generadas son orientativas y se basan
            exclusivamente en los datos ingresados por el usuario. No constituyen
            recomendaciones financieras.
          </p>
        </div>

        <div className={s.section}>
          <h2>3. Responsabilidad del usuario</h2>
          <p>El usuario es el único responsable de:</p>
          <ul className={s.list}>
            <li>La exactitud de los datos que ingresa en la herramienta</li>
            <li>Las decisiones financieras que tome basándose en la información mostrada</li>
            <li>Exportar y respaldar sus datos periódicamente</li>
            <li>La seguridad de su dispositivo, su clave de licencia y el acceso a la herramienta</li>
          </ul>
        </div>

        <div className={s.section}>
          <h2>4. Almacenamiento local y pérdida de datos</h2>
          <p>
            MOY IQ almacena los datos localmente en el navegador del usuario. Salvo que el
            usuario active la sincronización cifrada opcional,
            <strong> MAXNOVA & LUCI Global LLC no almacena ni puede recuperar los datos del usuario</strong>
            (y aun con sincronización activa, solo almacena datos cifrados que no puede leer).
          </p>
          <div className={s.warnBox}>
            <strong>Advertencia sobre pérdida de datos:</strong> Los datos pueden perderse
            permanentemente si el usuario borra los datos del navegador, limpia la caché,
            cambia de dispositivo sin exportar un respaldo, desinstala la aplicación o
            reinstala el sistema operativo. Se recomienda exportar respaldos JSON
            regularmente desde Ajustes.
          </div>
        </div>

        <div className={s.section}>
          <h2>5. Limitación de responsabilidad</h2>
          <p>
            En la máxima medida permitida por la ley aplicable, MAXNOVA & LUCI Global LLC no será
            responsable por:
          </p>
          <ul className={s.list}>
            <li>Pérdida de datos debido a borrado del navegador u otras causas locales</li>
            <li>Decisiones financieras tomadas con base en la información de la herramienta</li>
            <li>Daños directos, indirectos, incidentales o consecuentes derivados del uso</li>
            <li>Interrupciones del servicio por causas de terceros (hosting, navegador, etc.)</li>
            <li>Inexactitudes en los cálculos derivadas de datos incorrectos ingresados por el usuario</li>
          </ul>
        </div>

        <div className={s.section}>
          <h2>6. Propiedad intelectual</h2>
          <p>
            El código fuente, diseño y contenido de MOY IQ son propiedad de MAXNOVA & LUCI Global LLC
            y están protegidos por derechos de autor. El uso de MOY IQ está sujeto a los
            términos de la licencia adquirida (Personal o Pro), detallados en el documento de
            Licencia correspondiente.
          </p>
        </div>

        <div className={s.section}>
          <h2>7. Uso permitido</h2>
          <p>El usuario se compromete a no utilizar MOY IQ para:</p>
          <ul className={s.list}>
            <li>Actividades ilegales o fraudulentas</li>
            <li>Evadir obligaciones fiscales o legales</li>
            <li>Propósitos distintos a la gestión financiera personal legítima</li>
            <li>Compartir o redistribuir su clave de licencia a terceros</li>
          </ul>
        </div>

        <div className={s.section}>
          <h2>8. Disponibilidad del servicio</h2>
          <p>
            MOY IQ es una PWA (Progressive Web App) que funciona offline una vez cargada.
            La disponibilidad inicial depende de la plataforma de hosting utilizada.
            MAXNOVA & LUCI Global LLC no garantiza disponibilidad ininterrumpida del servicio de hosting.
          </p>
        </div>

        <div className={s.section}>
          <h2>9. Modificaciones</h2>
          <p>
            MAXNOVA & LUCI Global LLC se reserva el derecho de modificar estos términos en cualquier
            momento. Las modificaciones entran en vigencia al publicarse en esta página.
            El uso continuado implica aceptación de los términos actualizados.
          </p>
        </div>

        <div className={s.section}>
          <h2>10. Ley aplicable</h2>
          <p>
            Estos términos se rigen por las leyes aplicables a MAXNOVA & LUCI Global LLC. Cualquier
            disputa se resolverá en la jurisdicción competente correspondiente.
          </p>
        </div>

        <div className={s.section}>
          <h2>11. Contacto</h2>
          <p>Para consultas sobre estos términos: <strong>support@moyiq.app</strong></p>
        </div>

        <div className={s.section}>
          <h2>12. Consecuencias del incumplimiento</h2>
          <p>
            El incumplimiento de estos términos o de los términos de licencia puede resultar
            en la revocación del derecho de uso sin reembolso. Para regularizar situaciones
            fuera de los límites del plan adquirido, contactar <strong>support@moyiq.app</strong>{' '}
            antes de que ocurra el incumplimiento.
          </p>
        </div>

        <div className={s.legalNotice}>
          ⚠ Este documento fue redactado como punto de partida informativo. No constituye
          asesoría legal. Se recomienda revisión por un abogado especializado antes de
          uso comercial definitivo.
        </div>
      </div>
    </>
  )
}

function EnContent() {
  return (
    <>
      <PageHeader title="Terms of Use" sub="Last updated: July 2026 · MAXNOVA & LUCI Global LLC" />
      <div className={s.legalWrap}>
        <div className={s.highlight}>
          <strong>Important:</strong> MOY IQ is a personal finance organization and tracking
          tool. It is not a financial, tax, or investment advisor. It does not replace
          consultation with certified professionals.
        </div>

        <div className={s.section}>
          <h2>1. Acceptance of the terms</h2>
          <p>
            By accessing and using MOY IQ, the user accepts these Terms of Use in full.
            If you disagree with any part, you must stop using the tool.
          </p>
        </div>

        <div className={s.section}>
          <h2>2. Nature of the service</h2>
          <p>
            MOY IQ is a software tool for <strong>personal financial organization, diagnosis,
            and tracking</strong>. Its purpose is to help users record, visualize, and understand
            their personal finances.
          </p>
          <p>MOY IQ <strong>is not</strong>, and must not be construed as:</p>
          <ul className={s.list}>
            <li>A financial, tax, accounting, or investment advisor</li>
            <li>A bank, financial institution, or regulated entity</li>
            <li>A provider of investment recommendations</li>
            <li>A substitute for certified professional advice</li>
            <li>A tax-planning tool</li>
          </ul>
          <p>
            The projections, calculations, and suggestions it generates are indicative and based
            exclusively on the data entered by the user. They do not constitute financial
            recommendations.
          </p>
        </div>

        <div className={s.section}>
          <h2>3. User responsibility</h2>
          <p>The user is solely responsible for:</p>
          <ul className={s.list}>
            <li>The accuracy of the data entered in the tool</li>
            <li>The financial decisions made based on the information displayed</li>
            <li>Exporting and backing up their data periodically</li>
            <li>The security of their device, their license key, and access to the tool</li>
          </ul>
        </div>

        <div className={s.section}>
          <h2>4. Local storage and data loss</h2>
          <p>
            MOY IQ stores data locally in the user's browser. Unless the user enables the
            optional encrypted sync,
            <strong> MAXNOVA & LUCI Global LLC does not store and cannot recover user data</strong>
            (and even with sync enabled, it only stores encrypted data it cannot read).
          </p>
          <div className={s.warnBox}>
            <strong>Data-loss warning:</strong> Data may be permanently lost if the user clears
            browser data, wipes the cache, switches devices without exporting a backup,
            uninstalls the application, or reinstalls the operating system. We recommend
            exporting JSON backups regularly from Settings.
          </div>
        </div>

        <div className={s.section}>
          <h2>5. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by applicable law, MAXNOVA & LUCI Global LLC shall not
            be liable for:
          </p>
          <ul className={s.list}>
            <li>Data loss due to browser clearing or other local causes</li>
            <li>Financial decisions made based on the tool's information</li>
            <li>Direct, indirect, incidental, or consequential damages arising from use</li>
            <li>Service interruptions caused by third parties (hosting, browser, etc.)</li>
            <li>Calculation inaccuracies derived from incorrect data entered by the user</li>
          </ul>
        </div>

        <div className={s.section}>
          <h2>6. Intellectual property</h2>
          <p>
            The source code, design, and content of MOY IQ are the property of
            MAXNOVA & LUCI Global LLC and are protected by copyright. Use of MOY IQ is subject
            to the terms of the purchased license (Personal or Pro), detailed in the
            corresponding License document.
          </p>
        </div>

        <div className={s.section}>
          <h2>7. Permitted use</h2>
          <p>The user agrees not to use MOY IQ for:</p>
          <ul className={s.list}>
            <li>Illegal or fraudulent activities</li>
            <li>Evading tax or legal obligations</li>
            <li>Purposes other than legitimate personal financial management</li>
            <li>Sharing or redistributing their license key to third parties</li>
          </ul>
        </div>

        <div className={s.section}>
          <h2>8. Service availability</h2>
          <p>
            MOY IQ is a PWA (Progressive Web App) that works offline once loaded. Initial
            availability depends on the hosting platform used. MAXNOVA & LUCI Global LLC does not
            guarantee uninterrupted availability of the hosting service.
          </p>
        </div>

        <div className={s.section}>
          <h2>9. Modifications</h2>
          <p>
            MAXNOVA & LUCI Global LLC reserves the right to modify these terms at any time.
            Modifications take effect upon publication on this page. Continued use implies
            acceptance of the updated terms.
          </p>
        </div>

        <div className={s.section}>
          <h2>10. Governing law</h2>
          <p>
            These terms are governed by the laws applicable to MAXNOVA & LUCI Global LLC. Any
            dispute shall be resolved in the corresponding competent jurisdiction.
          </p>
        </div>

        <div className={s.section}>
          <h2>11. Contact</h2>
          <p>For inquiries about these terms: <strong>support@moyiq.app</strong></p>
        </div>

        <div className={s.section}>
          <h2>12. Consequences of non-compliance</h2>
          <p>
            Non-compliance with these terms or the license terms may result in revocation of the
            right of use without refund. To regularize situations outside the limits of the
            purchased plan, contact <strong>support@moyiq.app</strong> before the
            non-compliance occurs.
          </p>
        </div>

        <div className={s.legalNotice}>
          ⚠ This document was drafted as an informational starting point. It does not constitute
          legal advice. Review by a specialized attorney is recommended before definitive
          commercial use.
        </div>
      </div>
    </>
  )
}

function PtContent() {
  return (
    <>
      <PageHeader title="Termos de Uso" sub="Última atualização: julho 2026 · MAXNOVA & LUCI Global LLC" />
      <div className={s.legalWrap}>
        <div className={s.highlight}>
          <strong>Importante:</strong> O MOY IQ é uma ferramenta de organização e
          acompanhamento financeiro pessoal. Não é um consultor financeiro, tributário nem de
          investimentos. Não substitui a consulta a profissionais certificados.
        </div>

        <div className={s.section}>
          <h2>1. Aceitação dos termos</h2>
          <p>
            Ao acessar e usar o MOY IQ, o usuário aceita estes Termos de Uso na sua
            totalidade. Se não concordar com alguma parte, deve deixar de usar a ferramenta.
          </p>
        </div>

        <div className={s.section}>
          <h2>2. Natureza do serviço</h2>
          <p>
            O MOY IQ é uma ferramenta de software para <strong>organização, diagnóstico e
            acompanhamento financeiro pessoal</strong>. Seu propósito é ajudar os usuários a
            registrar, visualizar e compreender suas finanças pessoais.
          </p>
          <p>O MOY IQ <strong>não é</strong> e não deve ser interpretado como:</p>
          <ul className={s.list}>
            <li>Consultor financeiro, tributário, contábil nem de investimentos</li>
            <li>Instituição bancária, financeira nem entidade regulada</li>
            <li>Provedor de recomendações de investimento</li>
            <li>Substituto de aconselhamento profissional certificado</li>
            <li>Ferramenta de planejamento fiscal ou tributário</li>
          </ul>
          <p>
            As projeções, cálculos e sugestões geradas são orientativas e baseiam-se
            exclusivamente nos dados inseridos pelo usuário. Não constituem recomendações
            financeiras.
          </p>
        </div>

        <div className={s.section}>
          <h2>3. Responsabilidade do usuário</h2>
          <p>O usuário é o único responsável por:</p>
          <ul className={s.list}>
            <li>A exatidão dos dados que insere na ferramenta</li>
            <li>As decisões financeiras que tomar com base nas informações mostradas</li>
            <li>Exportar e fazer backup dos seus dados periodicamente</li>
            <li>A segurança do seu dispositivo, da sua chave de licença e do acesso à ferramenta</li>
          </ul>
        </div>

        <div className={s.section}>
          <h2>4. Armazenamento local e perda de dados</h2>
          <p>
            O MOY IQ armazena os dados localmente no navegador do usuário. Salvo se o usuário
            ativar a sincronização criptografada opcional,
            <strong> a MAXNOVA & LUCI Global LLC não armazena nem pode recuperar os dados do usuário</strong>
            (e mesmo com a sincronização ativa, armazena apenas dados criptografados que não pode ler).
          </p>
          <div className={s.warnBox}>
            <strong>Aviso sobre perda de dados:</strong> Os dados podem ser perdidos
            permanentemente se o usuário apagar os dados do navegador, limpar o cache, trocar de
            dispositivo sem exportar um backup, desinstalar a aplicação ou reinstalar o sistema
            operativo. Recomenda-se exportar backups JSON regularmente em Configurações.
          </div>
        </div>

        <div className={s.section}>
          <h2>5. Limitação de responsabilidade</h2>
          <p>
            Na máxima medida permitida pela lei aplicável, a MAXNOVA & LUCI Global LLC não será
            responsável por:
          </p>
          <ul className={s.list}>
            <li>Perda de dados devido a limpeza do navegador ou outras causas locais</li>
            <li>Decisões financeiras tomadas com base nas informações da ferramenta</li>
            <li>Danos diretos, indiretos, incidentais ou consequentes decorrentes do uso</li>
            <li>Interrupções do serviço por causas de terceiros (hosting, navegador, etc.)</li>
            <li>Imprecisões nos cálculos derivadas de dados incorretos inseridos pelo usuário</li>
          </ul>
        </div>

        <div className={s.section}>
          <h2>6. Propriedade intelectual</h2>
          <p>
            O código-fonte, o design e o conteúdo do MOY IQ são propriedade da
            MAXNOVA & LUCI Global LLC e estão protegidos por direitos autorais. O uso do MOY IQ
            está sujeito aos termos da licença adquirida (Personal ou Pro), detalhados no
            documento de Licença correspondente.
          </p>
        </div>

        <div className={s.section}>
          <h2>7. Uso permitido</h2>
          <p>O usuário compromete-se a não usar o MOY IQ para:</p>
          <ul className={s.list}>
            <li>Atividades ilegais ou fraudulentas</li>
            <li>Evadir obrigações fiscais ou legais</li>
            <li>Propósitos distintos da gestão financeira pessoal legítima</li>
            <li>Compartilhar ou redistribuir sua chave de licença a terceiros</li>
          </ul>
        </div>

        <div className={s.section}>
          <h2>8. Disponibilidade do serviço</h2>
          <p>
            O MOY IQ é uma PWA (Progressive Web App) que funciona offline depois de carregada.
            A disponibilidade inicial depende da plataforma de hosting utilizada.
            A MAXNOVA & LUCI Global LLC não garante disponibilidade ininterrupta do serviço de hosting.
          </p>
        </div>

        <div className={s.section}>
          <h2>9. Modificações</h2>
          <p>
            A MAXNOVA & LUCI Global LLC reserva-se o direito de modificar estes termos a qualquer
            momento. As modificações entram em vigor ao serem publicadas nesta página.
            O uso continuado implica aceitação dos termos atualizados.
          </p>
        </div>

        <div className={s.section}>
          <h2>10. Lei aplicável</h2>
          <p>
            Estes termos regem-se pelas leis aplicáveis à MAXNOVA & LUCI Global LLC. Qualquer
            disputa será resolvida na jurisdição competente correspondente.
          </p>
        </div>

        <div className={s.section}>
          <h2>11. Contato</h2>
          <p>Para questões sobre estes termos: <strong>support@moyiq.app</strong></p>
        </div>

        <div className={s.section}>
          <h2>12. Consequências do descumprimento</h2>
          <p>
            O descumprimento destes termos ou dos termos de licença pode resultar na revogação
            do direito de uso sem reembolso. Para regularizar situações fora dos limites do
            plano adquirido, contacte <strong>support@moyiq.app</strong> antes que o
            descumprimento ocorra.
          </p>
        </div>

        <div className={s.legalNotice}>
          ⚠ Este documento foi redigido como ponto de partida informativo. Não constitui
          aconselhamento jurídico. Recomenda-se revisão por um advogado especializado antes de
          uso comercial definitivo.
        </div>
      </div>
    </>
  )
}

export default function Terms() {
  const { lang } = useT()
  const Content = lang === 'en' ? EnContent : lang === 'pt' ? PtContent : EsContent
  return <div className="stack"><Content /></div>
}
