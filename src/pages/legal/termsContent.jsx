// src/pages/legal/termsContent.jsx
// Términos de Uso — MOY IQ, contenido por idioma (es/en/pt/de).
// Sin hooks ni useT: Terms.jsx elige el idioma y legal.test.js lo renderiza en node.
// AVISO: punto de partida redactado sin abogado. Revisar antes de uso comercial definitivo.
// ACTUALIZADO 2026-10: cuenta obligatoria, planes vigentes (Starter gratis personal /
// Pro por suscripción con uso comercial hasta 30 clientes), renovación y cancelación, y
// la "garantía técnica" de 14 días con la misma redacción que ../financeos-landing/terms.html.
// La prueba gratuita de Pro está APAGADA (docs/billing-trial-runbook.md): no prometerla
// acá hasta que exista la cláusula de prueba.

// vitest.config.js no carga el plugin de React: el JSX se transforma con el runtime
// clásico (React.createElement), así que React tiene que estar en scope.
import React from 'react' // eslint-disable-line no-unused-vars
import s from './legal.module.css'
import { LAST_UPDATED, OPERATOR } from './legalMeta.js'
import { deLegalRef } from './deLegal.js'

function EsBody() {
  return (
    <div className={s.legalWrap}>
      <div className={s.highlight}>
        <strong>Importante:</strong> MOY IQ es una herramienta de organización y seguimiento
        financiero personal. No es un asesor financiero, tributario ni de inversión, y no
        reemplaza la consulta con profesionales certificados.
      </div>

      <div className={s.section}>
        <h2>1. Aceptación de los términos</h2>
        <p>
          Al crear una cuenta y usar MOY IQ, el usuario acepta estos Términos de Uso en su
          totalidad. Si no está de acuerdo con alguna parte, debe dejar de usar la herramienta.
          MOY IQ es operado por MAXNOVA & LUCI Global LLC.
        </p>
      </div>

      <div className={s.section}>
        <h2>2. Naturaleza del servicio</h2>
        <p>
          MOY IQ es una herramienta de software para <strong>organización, diagnóstico y
          seguimiento financiero personal</strong>. Su propósito es ayudar a registrar,
          visualizar y comprender las finanzas personales.
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
          Las proyecciones, cálculos y señales que genera (incluidas las de MOY IQ Coach) son
          orientativas y se basan exclusivamente en los datos ingresados por el usuario. No
          constituyen recomendaciones financieras.
        </p>
      </div>

      <div className={s.section}>
        <h2>3. Cuenta de usuario</h2>
        <p>
          Para usar la app se necesita una cuenta gratuita, creada con un email o con Google. El
          usuario es responsable de mantener la confidencialidad de su acceso y de la seguridad de
          su dispositivo y de su clave de licencia. Puede pedir la eliminación de su cuenta en
          cualquier momento escribiendo a support@moyiq.app.
        </p>
      </div>

      <div className={s.section}>
        <h2>4. Planes y licencias</h2>
        <ul className={s.list}>
          <li>
            <strong>Plan Starter (gratis):</strong> licencia de uso personal no exclusiva, sin
            costo y sin límite de tiempo. No permite uso comercial, redistribución ni entrega a
            terceros.
          </li>
          <li>
            <strong>Plan Pro (suscripción mensual de US$4.99 o anual de US$39.99):</strong>{' '}
            licencia comercial que permite usar MOY IQ con hasta 30 clientes mientras la
            suscripción esté activa. No permite reventa del software ni sublicenciamiento.
          </li>
        </ul>
        <p>El detalle por plan está en el documento de Licencia.</p>
      </div>

      <div className={s.section}>
        <h2>5. Renovación y cancelación</h2>
        <p>
          La suscripción a Pro se renueva automáticamente (mensual o anual, según el plan elegido)
          al final de cada período hasta que el usuario la cancele escribiendo a
          support@moyiq.app. El acceso Pro permanece activo hasta el final del período ya pagado;
          no se hacen reembolsos parciales por el tiempo no usado, salvo la garantía técnica
          descrita en el punto 6.
        </p>
        <p>
          Al cancelar, o si un cobro de renovación no puede procesarse, la cuenta pasa
          automáticamente al plan Starter, sin pérdida de datos.
        </p>
      </div>

      <div className={s.section}>
        <h2>6. Garantía técnica</h2>
        <p>
          Si dentro de los primeros 14 días desde la compra el usuario experimenta un problema
          técnico que MAXNOVA & LUCI Global LLC no puede ayudar a resolver, se ofrece reembolso
          completo. Para solicitarlo, escribir a support@moyiq.app. La garantía no cubre
          decisiones financieras del usuario ni pérdida de datos por falta de respaldo. Esta
          garantía no limita los derechos que la ley aplicable otorgue al usuario.
        </p>
      </div>

      <div className={s.section}>
        <h2>7. Responsabilidad del usuario</h2>
        <p>El usuario es el único responsable de:</p>
        <ul className={s.list}>
          <li>La exactitud de los datos que ingresa en la herramienta</li>
          <li>Las decisiones financieras que tome basándose en la información mostrada</li>
          <li>Exportar y respaldar sus datos periódicamente</li>
          <li>La seguridad de su dispositivo, su cuenta y su clave de licencia</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>8. Almacenamiento local y pérdida de datos</h2>
        <p>
          MOY IQ almacena los datos financieros localmente en el dispositivo del usuario. Salvo
          que el usuario active la sincronización cifrada opcional,{' '}
          <strong>MAXNOVA & LUCI Global LLC no almacena ni puede recuperar esos datos</strong>{' '}
          (y aun con sincronización activa, solo almacena datos cifrados que no puede leer).
        </p>
        <div className={s.warnBox}>
          <strong>Advertencia sobre pérdida de datos:</strong> Los datos pueden perderse de forma
          permanente si el usuario borra los datos del navegador, limpia la caché, cambia de
          dispositivo sin exportar un respaldo, desinstala la aplicación o reinstala el sistema
          operativo. Se recomienda exportar respaldos JSON con regularidad desde Ajustes.
        </div>
      </div>

      <div className={s.section}>
        <h2>9. Limitación de responsabilidad</h2>
        <p>
          En la máxima medida permitida por la ley aplicable, MAXNOVA & LUCI Global LLC no será
          responsable por:
        </p>
        <ul className={s.list}>
          <li>Pérdida de datos debido a borrado del navegador u otras causas locales</li>
          <li>Decisiones financieras tomadas con base en la información de la herramienta</li>
          <li>Daños directos, indirectos, incidentales o consecuentes derivados del uso</li>
          <li>Interrupciones del servicio por causas de terceros (alojamiento, navegador, etc.)</li>
          <li>Inexactitudes en los cálculos derivadas de datos incorrectos ingresados por el usuario</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>10. Propiedad intelectual</h2>
        <p>
          El código fuente, el diseño y el contenido de MOY IQ son propiedad de MAXNOVA & LUCI
          Global LLC y están protegidos por derechos de autor. La licencia no transfiere derechos
          de propiedad intelectual.
        </p>
      </div>

      <div className={s.section}>
        <h2>11. Uso permitido</h2>
        <p>El usuario se compromete a no utilizar MOY IQ para:</p>
        <ul className={s.list}>
          <li>Actividades ilegales o fraudulentas</li>
          <li>Evadir obligaciones fiscales o legales</li>
          <li>Uso comercial con el plan Starter, o con más clientes de los que permite su plan</li>
          <li>Compartir o redistribuir su clave de licencia o su acceso a terceros</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>12. Disponibilidad del servicio</h2>
        <p>
          MOY IQ es una PWA (Progressive Web App) que funciona sin conexión una vez cargada. El
          inicio de sesión, la validación del plan y la sincronización requieren conexión. MAXNOVA &
          LUCI Global LLC no garantiza disponibilidad ininterrumpida del servicio de alojamiento.
        </p>
      </div>

      <div className={s.section}>
        <h2>13. Consecuencias del incumplimiento</h2>
        <p>
          El incumplimiento de estos términos o de los términos de licencia puede resultar en la
          revocación del derecho de uso sin reembolso. Para usar MOY IQ fuera de los límites del
          plan adquirido, escribir antes a <strong>support@moyiq.app</strong>.
        </p>
      </div>

      <div className={s.section}>
        <h2>14. Modificaciones</h2>
        <p>
          MAXNOVA & LUCI Global LLC puede actualizar estos términos. Los cambios se publican en esta
          página con la fecha de actualización. El uso continuado implica aceptación de los
          términos actualizados.
        </p>
      </div>

      <div className={s.section}>
        <h2>15. Ley aplicable</h2>
        <p>
          Estos términos se rigen por las leyes aplicables a MAXNOVA & LUCI Global LLC. Cualquier
          disputa se resolverá en la jurisdicción competente correspondiente.
        </p>
      </div>

      <div className={s.section}>
        <h2>16. Contacto</h2>
        <p>Para consultas sobre estos términos: <strong>support@moyiq.app</strong></p>
      </div>

      <div className={s.legalNotice}>
        Este documento fue redactado como punto de partida informativo. No constituye asesoría
        legal. Se recomienda revisión por un abogado especializado antes de uso comercial
        definitivo.
      </div>
    </div>
  )
}

function EnBody() {
  return (
    <div className={s.legalWrap}>
      <div className={s.highlight}>
        <strong>Important:</strong> MOY IQ is a personal finance organization and tracking tool.
        It is not a financial, tax, or investment advisor, and it does not replace consultation
        with certified professionals.
      </div>

      <div className={s.section}>
        <h2>1. Acceptance of the terms</h2>
        <p>
          By creating an account and using MOY IQ, the user accepts these Terms of Use in full. If
          the user disagrees with any part, they must stop using the tool. MOY IQ is operated by
          MAXNOVA & LUCI Global LLC.
        </p>
      </div>

      <div className={s.section}>
        <h2>2. Nature of the service</h2>
        <p>
          MOY IQ is a software tool for <strong>personal financial organization, diagnosis, and
          tracking</strong>. Its purpose is to help record, visualize, and understand personal
          finances.
        </p>
        <p>MOY IQ <strong>is not</strong>, and must not be read as:</p>
        <ul className={s.list}>
          <li>A financial, tax, accounting, or investment advisor</li>
          <li>A bank, financial institution, or regulated entity</li>
          <li>A provider of investment recommendations</li>
          <li>A substitute for certified professional advice</li>
          <li>A tax-planning tool</li>
        </ul>
        <p>
          The projections, calculations, and signals it generates (including MOY IQ Coach signals)
          are indicative and based only on the data the user enters. They are not financial
          recommendations.
        </p>
      </div>

      <div className={s.section}>
        <h2>3. User account</h2>
        <p>
          A free account, created with an email address or with Google, is required to use the
          app. The user is responsible for keeping their access confidential and for the security
          of their device and license key. The user can request deletion of their account at any
          time by writing to support@moyiq.app.
        </p>
      </div>

      <div className={s.section}>
        <h2>4. Plans and licenses</h2>
        <ul className={s.list}>
          <li>
            <strong>Starter plan (free):</strong> a non-exclusive license for personal use, at no
            cost and with no time limit. It does not allow commercial use, redistribution, or
            handing the app to third parties.
          </li>
          <li>
            <strong>Pro plan (US$4.99 monthly or US$39.99 annual subscription):</strong> a
            commercial license to use MOY IQ with up to 30 clients while the subscription is
            active. It does not allow reselling the software or sublicensing.
          </li>
        </ul>
        <p>Details per plan are in the License document.</p>
      </div>

      <div className={s.section}>
        <h2>5. Renewal and cancellation</h2>
        <p>
          The Pro subscription renews automatically (monthly or annually, depending on the plan
          chosen) at the end of each period until the user cancels by writing to
          support@moyiq.app. Pro access stays active until the end of the period already paid;
          there are no partial refunds for unused time, except under the technical guarantee in
          section 6.
        </p>
        <p>
          When the user cancels, or if a renewal charge cannot be processed, the account moves
          automatically to the Starter plan, with no data loss.
        </p>
      </div>

      <div className={s.section}>
        <h2>6. Technical guarantee</h2>
        <p>
          If, within the first 14 days after purchase, the user experiences a technical problem
          that MAXNOVA & LUCI Global LLC cannot help resolve, a full refund is offered. To request
          it, write to support@moyiq.app. The guarantee does not cover the user's financial
          decisions or data loss caused by not having a backup. This guarantee does not limit any
          rights the user has under applicable law.
        </p>
      </div>

      <div className={s.section}>
        <h2>7. User responsibility</h2>
        <p>The user is solely responsible for:</p>
        <ul className={s.list}>
          <li>The accuracy of the data entered in the tool</li>
          <li>The financial decisions made based on the information displayed</li>
          <li>Exporting and backing up their data periodically</li>
          <li>The security of their device, account, and license key</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>8. Local storage and data loss</h2>
        <p>
          MOY IQ stores financial data locally on the user's device. Unless the user turns on the
          optional encrypted sync,{' '}
          <strong>MAXNOVA & LUCI Global LLC does not store and cannot recover that data</strong>{' '}
          (and even with sync on, it only stores encrypted data it cannot read).
        </p>
        <div className={s.warnBox}>
          <strong>Data-loss warning:</strong> Data can be lost permanently if the user clears
          browser data, wipes the cache, switches devices without exporting a backup, uninstalls
          the app, or reinstalls the operating system. Export JSON backups regularly from Settings.
        </div>
      </div>

      <div className={s.section}>
        <h2>9. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by applicable law, MAXNOVA & LUCI Global LLC is not
          liable for:
        </p>
        <ul className={s.list}>
          <li>Data loss due to browser clearing or other local causes</li>
          <li>Financial decisions made based on the tool's information</li>
          <li>Direct, indirect, incidental, or consequential damages arising from use</li>
          <li>Service interruptions caused by third parties (hosting, browser, etc.)</li>
          <li>Calculation errors that come from incorrect data entered by the user</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>10. Intellectual property</h2>
        <p>
          The source code, design, and content of MOY IQ are the property of MAXNOVA & LUCI Global
          LLC and are protected by copyright. The license does not transfer any intellectual
          property rights.
        </p>
      </div>

      <div className={s.section}>
        <h2>11. Permitted use</h2>
        <p>The user agrees not to use MOY IQ for:</p>
        <ul className={s.list}>
          <li>Illegal or fraudulent activity</li>
          <li>Evading tax or legal obligations</li>
          <li>Commercial use on the Starter plan, or with more clients than their plan allows</li>
          <li>Sharing or redistributing their license key or access to third parties</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>12. Service availability</h2>
        <p>
          MOY IQ is a Progressive Web App that works offline once loaded. Sign-in, plan validation,
          and sync require a connection. MAXNOVA & LUCI Global LLC does not guarantee uninterrupted
          availability of the hosting service.
        </p>
      </div>

      <div className={s.section}>
        <h2>13. Non-compliance</h2>
        <p>
          Breaching these terms or the license terms may lead to revocation of the right of use
          without refund. To use MOY IQ beyond the limits of the purchased plan, write to{' '}
          <strong>support@moyiq.app</strong> first.
        </p>
      </div>

      <div className={s.section}>
        <h2>14. Changes</h2>
        <p>
          MAXNOVA & LUCI Global LLC may update these terms. Changes are published on this page with
          the date of the update. Continued use implies acceptance of the updated terms.
        </p>
      </div>

      <div className={s.section}>
        <h2>15. Governing law</h2>
        <p>
          These terms are governed by the laws applicable to MAXNOVA & LUCI Global LLC. Any dispute
          will be resolved in the corresponding competent jurisdiction.
        </p>
      </div>

      <div className={s.section}>
        <h2>16. Contact</h2>
        <p>For questions about these terms: <strong>support@moyiq.app</strong></p>
      </div>

      <div className={s.legalNotice}>
        This document was drafted as an informational starting point. It is not legal advice.
        Review by a specialized attorney is recommended before definitive commercial use.
      </div>
    </div>
  )
}

function PtBody() {
  return (
    <div className={s.legalWrap}>
      <div className={s.highlight}>
        <strong>Importante:</strong> O MOY IQ é uma ferramenta de organização e acompanhamento
        financeiro pessoal. Não é um consultor financeiro, tributário nem de investimentos, e não
        substitui a consulta a profissionais certificados.
      </div>

      <div className={s.section}>
        <h2>1. Aceitação dos termos</h2>
        <p>
          Ao criar uma conta e usar o MOY IQ, o usuário aceita estes Termos de Uso na íntegra. Se
          não concordar com alguma parte, deve deixar de usar a ferramenta. O MOY IQ é operado pela
          MAXNOVA & LUCI Global LLC.
        </p>
      </div>

      <div className={s.section}>
        <h2>2. Natureza do serviço</h2>
        <p>
          O MOY IQ é uma ferramenta de software para <strong>organização, diagnóstico e
          acompanhamento financeiro pessoal</strong>. Seu propósito é ajudar a registrar,
          visualizar e compreender as finanças pessoais.
        </p>
        <p>O MOY IQ <strong>não é</strong> e não deve ser interpretado como:</p>
        <ul className={s.list}>
          <li>Consultor financeiro, tributário, contábil ou de investimentos</li>
          <li>Instituição bancária, financeira ou entidade regulada</li>
          <li>Provedor de recomendações de investimento</li>
          <li>Substituto de aconselhamento profissional certificado</li>
          <li>Ferramenta de planejamento fiscal ou tributário</li>
        </ul>
        <p>
          As projeções, cálculos e sinais gerados (inclusive os do MOY IQ Coach) são orientativos
          e baseiam-se exclusivamente nos dados inseridos pelo usuário. Não constituem
          recomendações financeiras.
        </p>
      </div>

      <div className={s.section}>
        <h2>3. Conta de usuário</h2>
        <p>
          Para usar o app é necessária uma conta gratuita, criada com um email ou com o Google. O
          usuário é responsável por manter a confidencialidade do seu acesso e pela segurança do
          seu dispositivo e da sua chave de licença. Ele pode pedir a exclusão da conta a qualquer
          momento escrevendo para support@moyiq.app.
        </p>
      </div>

      <div className={s.section}>
        <h2>4. Planos e licenças</h2>
        <ul className={s.list}>
          <li>
            <strong>Plano Starter (gratuito):</strong> licença de uso pessoal não exclusiva, sem
            custo e sem limite de tempo. Não permite uso comercial, redistribuição nem entrega a
            terceiros.
          </li>
          <li>
            <strong>Plano Pro (assinatura mensal de US$4.99 ou anual de US$39.99):</strong>{' '}
            licença comercial que permite usar o MOY IQ com até 30 clientes enquanto a assinatura
            estiver ativa. Não permite revenda do software nem sublicenciamento.
          </li>
        </ul>
        <p>O detalhe de cada plano está no documento de Licença.</p>
      </div>

      <div className={s.section}>
        <h2>5. Renovação e cancelamento</h2>
        <p>
          A assinatura Pro é renovada automaticamente (mensal ou anual, conforme o plano escolhido)
          ao final de cada período até que o usuário a cancele escrevendo para support@moyiq.app.
          O acesso Pro continua ativo até o final do período já pago; não há reembolso parcial pelo
          tempo não utilizado, exceto pela garantia técnica do item 6.
        </p>
        <p>
          Ao cancelar, ou se uma cobrança de renovação não puder ser processada, a conta passa
          automaticamente para o plano Starter, sem perda de dados.
        </p>
      </div>

      <div className={s.section}>
        <h2>6. Garantia técnica</h2>
        <p>
          Se, nos primeiros 14 dias a partir da compra, o usuário tiver um problema técnico que a
          MAXNOVA & LUCI Global LLC não consiga ajudar a resolver, é oferecido reembolso integral.
          Para solicitá-lo, escreva para support@moyiq.app. A garantia não cobre decisões
          financeiras do usuário nem perda de dados por falta de backup. Esta garantia não limita
          os direitos que a lei aplicável assegura ao usuário.
        </p>
      </div>

      <div className={s.section}>
        <h2>7. Responsabilidade do usuário</h2>
        <p>O usuário é o único responsável por:</p>
        <ul className={s.list}>
          <li>A exatidão dos dados que insere na ferramenta</li>
          <li>As decisões financeiras que tomar com base nas informações mostradas</li>
          <li>Exportar e fazer backup dos seus dados periodicamente</li>
          <li>A segurança do seu dispositivo, da sua conta e da sua chave de licença</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>8. Armazenamento local e perda de dados</h2>
        <p>
          O MOY IQ armazena os dados financeiros localmente no dispositivo do usuário. Salvo se o
          usuário ativar a sincronização criptografada opcional,{' '}
          <strong>a MAXNOVA & LUCI Global LLC não armazena nem pode recuperar esses dados</strong>{' '}
          (e, mesmo com a sincronização ativa, armazena apenas dados criptografados que não pode ler).
        </p>
        <div className={s.warnBox}>
          <strong>Aviso sobre perda de dados:</strong> Os dados podem ser perdidos permanentemente
          se o usuário apagar os dados do navegador, limpar o cache, trocar de dispositivo sem
          exportar um backup, desinstalar o app ou reinstalar o sistema operacional. Recomenda-se
          exportar backups JSON regularmente em Configurações.
        </div>
      </div>

      <div className={s.section}>
        <h2>9. Limitação de responsabilidade</h2>
        <p>
          Na máxima medida permitida pela lei aplicável, a MAXNOVA & LUCI Global LLC não será
          responsável por:
        </p>
        <ul className={s.list}>
          <li>Perda de dados devido à limpeza do navegador ou outras causas locais</li>
          <li>Decisões financeiras tomadas com base nas informações da ferramenta</li>
          <li>Danos diretos, indiretos, incidentais ou consequentes decorrentes do uso</li>
          <li>Interrupções do serviço por causas de terceiros (hospedagem, navegador etc.)</li>
          <li>Imprecisões nos cálculos derivadas de dados incorretos inseridos pelo usuário</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>10. Propriedade intelectual</h2>
        <p>
          O código-fonte, o design e o conteúdo do MOY IQ são propriedade da MAXNOVA & LUCI Global
          LLC e estão protegidos por direitos autorais. A licença não transfere direitos de
          propriedade intelectual.
        </p>
      </div>

      <div className={s.section}>
        <h2>11. Uso permitido</h2>
        <p>O usuário se compromete a não usar o MOY IQ para:</p>
        <ul className={s.list}>
          <li>Atividades ilegais ou fraudulentas</li>
          <li>Evadir obrigações fiscais ou legais</li>
          <li>Uso comercial com o plano Starter, ou com mais clientes do que o seu plano permite</li>
          <li>Compartilhar ou redistribuir sua chave de licença ou seu acesso a terceiros</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>12. Disponibilidade do serviço</h2>
        <p>
          O MOY IQ é uma PWA (Progressive Web App) que funciona offline depois de carregada. O
          login, a validação do plano e a sincronização exigem conexão. A MAXNOVA & LUCI Global LLC
          não garante disponibilidade ininterrupta do serviço de hospedagem.
        </p>
      </div>

      <div className={s.section}>
        <h2>13. Consequências do descumprimento</h2>
        <p>
          O descumprimento destes termos ou dos termos de licença pode resultar na revogação do
          direito de uso sem reembolso. Para usar o MOY IQ além dos limites do plano adquirido,
          escreva antes para <strong>support@moyiq.app</strong>.
        </p>
      </div>

      <div className={s.section}>
        <h2>14. Alterações</h2>
        <p>
          A MAXNOVA & LUCI Global LLC pode atualizar estes termos. As alterações são publicadas
          nesta página com a data de atualização. O uso continuado implica aceitação dos termos
          atualizados.
        </p>
      </div>

      <div className={s.section}>
        <h2>15. Lei aplicável</h2>
        <p>
          Estes termos regem-se pelas leis aplicáveis à MAXNOVA & LUCI Global LLC. Qualquer disputa
          será resolvida na jurisdição competente correspondente.
        </p>
      </div>

      <div className={s.section}>
        <h2>16. Contato</h2>
        <p>Para questões sobre estes termos: <strong>support@moyiq.app</strong></p>
      </div>

      <div className={s.legalNotice}>
        Este documento foi redigido como ponto de partida informativo. Não constitui
        aconselhamento jurídico. Recomenda-se revisão por um advogado especializado antes do uso
        comercial definitivo.
      </div>
    </div>
  )
}

// RECHTLICHE PRÜFUNG AUSSTEHEND — Entwurf, vor Verkauf an Verbraucher in DE von einer Anwältin/einem Anwalt prüfen lassen
// Quelle: ../financeos-landing (Branch i18n/landing-de) de/agb.html und de/widerruf.html.
// Abweichungen zu den anderen Sprachen (deutsches Recht, Jahresabo nach der ersten
// Laufzeit monatlich kündbar mit anteiliger Erstattung, Widerrufsrecht) sind gewollt
// und im Bericht an die Anwältin/den Anwalt aufgeführt.
function DeBody() {
  return (
    <div className={s.legalWrap}>
      <div className={s.highlight}>
        <strong>Wichtig:</strong> MOY IQ ist ein Werkzeug zur Organisation persönlicher Finanzen.
        Es stellt keine Finanz-, Steuer-, Rechts- oder Anlageberatung dar.
      </div>

      <div className={s.section}>
        <h2>§ 1 Geltungsbereich, Anbieter</h2>
        <p>
          (1) Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge über die
          Nutzung der Web-App „MOY IQ“ (erreichbar über moyiq.app und app.moyiq.app, auch als
          installierbare Progressive Web App) zwischen der MAXNOVA & LUCI Global LLC, USA, E-Mail:
          support@moyiq.app (nachfolgend „wir“ oder „Anbieter“) und den Nutzerinnen und Nutzern
          (nachfolgend „Sie“). Die vollständige Anbieterkennzeichnung steht im{' '}
          {deLegalRef('impressum', 'Impressum')}.
        </p>
        <p>
          (2) Unser Angebot richtet sich an Verbraucher im Sinne von § 13 BGB sowie, beim Tarif
          Pro, auch an Personen, die MOY IQ beruflich mit ihren Klientinnen und Klienten nutzen.
          Vorschriften zum Schutz von Verbrauchern gelten nur für Verbraucher. Abweichende
          Bedingungen von Nutzern gelten nicht, es sei denn, wir stimmen ihnen ausdrücklich zu.
        </p>
        <p>(3) Vertragssprache ist Deutsch.</p>
      </div>

      <div className={s.section}>
        <h2>§ 2 Leistungsbeschreibung</h2>
        <p>
          (1) MOY IQ ist eine Anwendung zur Organisation persönlicher Finanzen: Erfassung von
          Einnahmen und Ausgaben, Budgets, Schulden, Ziele und Abos sowie Import von
          Kontoauszügen. MOY IQ verbindet sich nicht mit Ihrem Bankkonto und fragt keine
          Bankzugangsdaten ab.
        </p>
        <p>
          (2) Starter (kostenlos): Nutzung der Grundfunktionen ohne Entgelt und ohne zeitliche
          Begrenzung, ausschließlich für private Zwecke.
        </p>
        <p>
          (3) Pro (kostenpflichtiges Abo): zusätzlich zu Starter insbesondere Beratermodus,
          PDF-Berichte, Multiwährung, Schulden-Simulator sowie länderspezifische Steuerwerkzeuge.
          Pro erlaubt die berufliche Nutzung mit bis zu 30 Klientinnen und Klienten, solange das
          Abo aktiv ist.
        </p>
        <p>
          (4) Ihre Finanzdaten werden lokal auf Ihrem Gerät gespeichert. Eine optionale
          Synchronisierung zwischen Geräten erfolgt Ende-zu-Ende-verschlüsselt (siehe
          Datenschutzerklärung in der App).
        </p>
        <p>
          (5) Steuer- und Finanzberechnungen in MOY IQ sind Schätzungen zu Informations- und
          Bildungszwecken. Sie ersetzen keine Beratung durch Steuerberater, Rechtsanwälte oder
          Finanzberater und keine offizielle Steuererklärung (z. B. über ELSTER).
        </p>
        <p>
          (6) Technische Voraussetzungen: ein aktueller Webbrowser mit aktiviertem JavaScript; für
          Konto, Abo-Prüfung und Synchronisierung eine Internetverbindung.
        </p>
      </div>

      <div className={s.section}>
        <h2>§ 3 Benutzerkonto</h2>
        <p>
          (1) Für die Nutzung ist ein kostenloses Benutzerkonto erforderlich. Sie können es mit
          Ihrer E-Mail-Adresse oder über „Mit Google anmelden“ anlegen. Sie sind verpflichtet,
          Ihre Zugangsdaten geheim zu halten.
        </p>
        <p>
          (2) Sie können die Löschung Ihres Kontos jederzeit per E-Mail an support@moyiq.app
          verlangen. Damit endet auch der Vertrag über Starter.
        </p>
      </div>

      <div className={s.section}>
        <h2>§ 4 Vertragsschluss</h2>
        <p>
          (1) Die Darstellung der Tarife ist kein bindendes Angebot, sondern eine Aufforderung zur
          Abgabe einer Bestellung.
        </p>
        <p>(2) Starter: Der Vertrag kommt zustande, wenn Sie Ihr Benutzerkonto anlegen.</p>
        <p>
          (3) Pro: Über die Pro-Schaltfläche gelangen Sie zum Bezahlvorgang unseres
          Zahlungsdienstleisters Stripe. Dort können Sie Ihre Angaben vor Abschluss prüfen und
          korrigieren oder den Vorgang abbrechen. Mit Klick auf den abschließenden Bestellbutton
          geben Sie ein verbindliches Angebot zum Abschluss eines kostenpflichtigen Abos ab. Der
          Vertrag kommt mit der Bestätigung der erfolgreichen Zahlung zustande, die Sie per E-Mail
          erhalten.
        </p>
      </div>

      <div className={s.section}>
        <h2>§ 5 Preise und Zahlung</h2>
        <p>
          (1) Pro kostet US$ 4,99 pro Monat (monatliche Abrechnung) oder US$ 39,99 pro Jahr
          (jährliche Abrechnung). Die Preise werden in US-Dollar angegeben und abgerechnet. Es
          handelt sich um Endpreise einschließlich etwaig anfallender Umsatzsteuer.
        </p>
        <p>
          (2) Die Zahlung erfolgt im Voraus für den jeweiligen Abrechnungszeitraum über Stripe.
          Für Zahlungen in Fremdwährung kann Ihr Kreditinstitut eigene Gebühren berechnen, auf die
          wir keinen Einfluss haben.
        </p>
      </div>

      <div className={s.section}>
        <h2>§ 6 Laufzeit, Verlängerung und Kündigung</h2>
        <p>
          (1) Monatsabo: Die Laufzeit beträgt einen Monat ab Vertragsschluss. Das Abo verlängert
          sich jeweils um einen weiteren Monat, wenn es nicht vor Ablauf des laufenden Monats
          gekündigt wird.
        </p>
        <p>
          (2) Jahresabo: Die erste Laufzeit beträgt zwölf Monate ab Vertragsschluss. Wird das Abo
          nicht vor Ablauf der ersten Laufzeit gekündigt, verlängert es sich auf unbestimmte Zeit
          und kann danach jederzeit mit einer Frist von einem Monat gekündigt werden. Im Voraus
          gezahlte Entgelte für die Zeit nach dem Wirksamwerden einer solchen Kündigung erstatten
          wir anteilig.
        </p>
        <p>
          (3) Sie können per E-Mail an support@moyiq.app, per Brief an die im Impressum genannte
          Anschrift oder über die Kündigungsschaltfläche{' '}
          {deLegalRef('kuendigen', '„Verträge hier kündigen“')} kündigen. Eine Anmeldung im
          Benutzerkonto ist dafür nicht erforderlich.
        </p>
        <p>(4) Das Recht beider Parteien zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.</p>
        <p>
          (5) Nach Ende des Pro-Abos, auch wenn eine Verlängerungszahlung nicht durchgeführt werden
          kann, wird Ihr Konto auf Starter umgestellt. Ihre auf dem Gerät gespeicherten Daten
          bleiben erhalten; Pro-Funktionen stehen nicht mehr zur Verfügung.
        </p>
      </div>

      <div className={s.section}>
        <h2>§ 7 Widerrufsrecht</h2>
        <p>
          (1) Verbraucherinnen und Verbrauchern steht ein gesetzliches Widerrufsrecht zu. Sie
          können den Vertrag binnen vierzehn Tagen ab Vertragsschluss ohne Angabe von Gründen
          widerrufen. Dafür genügt eine eindeutige Erklärung, z. B. per E-Mail an
          support@moyiq.app. Zur Wahrung der Frist reicht die rechtzeitige Absendung.
        </p>
        <p>
          (2) Im Fall des Widerrufs erstatten wir alle von Ihnen erhaltenen Zahlungen unverzüglich,
          spätestens binnen vierzehn Tagen ab Eingang des Widerrufs, über dasselbe Zahlungsmittel.
        </p>
        <p>
          (3) Das Widerrufsrecht erlischt vorzeitig nur, wenn Sie ausdrücklich zugestimmt haben,
          dass wir vor Ablauf der Widerrufsfrist mit der Vertragserfüllung beginnen, Ihre Kenntnis
          vom Verlust des Widerrufsrechts bestätigt haben und wir Ihnen den Vertrag auf einem
          dauerhaften Datenträger bestätigt haben (§ 356 Abs. 5 BGB). Ohne diese Zustimmung bleibt
          das Widerrufsrecht für die volle Frist bestehen.
        </p>
        <p>
          (4) Maßgeblich ist die vollständige{' '}
          {deLegalRef('widerruf', 'Widerrufsbelehrung mit Muster-Widerrufsformular')}. Der Widerruf
          ist von der Kündigung eines laufenden Abos zu unterscheiden.
        </p>
      </div>

      <div className={s.section}>
        <h2>§ 8 Technische Garantie (14 Tage)</h2>
        <p>
          Zusätzlich zu Ihren gesetzlichen Rechten gewähren wir eine freiwillige Garantie: Tritt
          innerhalb von 14 Tagen nach dem Kauf von Pro ein technisches Problem auf, bei dessen
          Lösung wir Ihnen nicht helfen können, erstatten wir den gezahlten Betrag vollständig.
          Wenden Sie sich dafür an support@moyiq.app. Die Garantie erfasst keine finanziellen
          Entscheidungen und keinen Datenverlust wegen fehlender Sicherung. Ihre gesetzlichen
          Rechte, insbesondere Mängelrechte und das Widerrufsrecht, werden durch diese Garantie
          nicht eingeschränkt.
        </p>
      </div>

      <div className={s.section}>
        <h2>§ 9 Gewährleistung und Aktualisierungen</h2>
        <p>
          Es gelten die gesetzlichen Vorschriften über Mängel digitaler Produkte (§§ 327 ff. BGB).
          Wir stellen Ihnen während der Vertragslaufzeit die für den Erhalt der Vertragsmäßigkeit
          erforderlichen Aktualisierungen, einschließlich Sicherheitsaktualisierungen, bereit.
        </p>
      </div>

      <div className={s.section}>
        <h2>§ 10 Haftung</h2>
        <p>
          (1) Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von
          Leben, Körper oder Gesundheit, nach dem Produkthaftungsgesetz sowie im Umfang einer
          übernommenen Garantie.
        </p>
        <p>
          (2) Bei leicht fahrlässiger Verletzung einer wesentlichen Vertragspflicht, deren
          Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf
          deren Einhaltung Sie regelmäßig vertrauen dürfen, ist unsere Haftung auf den
          vertragstypischen, vorhersehbaren Schaden begrenzt.
        </p>
        <p>(3) Im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen.</p>
        <p>
          (4) Wir haften nicht für finanzielle oder steuerliche Entscheidungen, die Sie auf
          Grundlage der in MOY IQ angezeigten Informationen treffen; insoweit gilt § 2 Abs. 5.
        </p>
      </div>

      <div className={s.section}>
        <h2>§ 11 Datensicherung</h2>
        <p>
          Ihre Finanzdaten werden lokal in Ihrem Browser bzw. auf Ihrem Gerät gespeichert. Ohne
          aktivierte Synchronisierung haben wir keinen Zugriff darauf und können sie nicht
          wiederherstellen. Wir empfehlen, regelmäßig eine Sicherung über „Einstellungen“ zu
          exportieren. Die Haftung nach § 10 Abs. 1 bleibt unberührt.
        </p>
      </div>

      <div className={s.section}>
        <h2>§ 12 Nutzungsrechte</h2>
        <p>
          (1) Wir räumen Ihnen für die Dauer des jeweiligen Vertrags ein einfaches, nicht
          übertragbares Recht ein, MOY IQ auf Ihren eigenen Geräten zu nutzen: mit Starter für
          private Zwecke, mit Pro zusätzlich beruflich mit bis zu 30 Klientinnen und Klienten.
        </p>
        <p>
          (2) Nicht gestattet sind insbesondere die Weitergabe Ihres Zugangs oder
          Lizenzschlüssels an Dritte, der Weiterverkauf, die Unterlizenzierung sowie die
          Veröffentlichung einer eigenen Version unter anderer Marke.
        </p>
      </div>

      <div className={s.section}>
        <h2>§ 13 Änderungen der Leistung und dieser AGB</h2>
        <p>
          (1) Wir dürfen MOY IQ über das zur Erhaltung der Vertragsmäßigkeit erforderliche Maß
          hinaus nur unter den Voraussetzungen des § 327r BGB ändern, insbesondere aus triftigem
          Grund, ohne zusätzliche Kosten für Sie und mit klarer Information. Beeinträchtigt eine
          Änderung Ihren Zugang oder die Nutzbarkeit mehr als nur unerheblich, informieren wir Sie
          rechtzeitig vorher auf einem dauerhaften Datenträger; Sie können den Vertrag dann
          innerhalb von 30 Tagen unentgeltlich beenden.
        </p>
        <p>(2) Änderungen dieser AGB für bestehende Verträge werden nur mit Ihrer Zustimmung wirksam.</p>
      </div>

      <div className={s.section}>
        <h2>§ 14 Datenschutz</h2>
        <p>
          Informationen zur Verarbeitung personenbezogener Daten finden Sie in der
          Datenschutzerklärung in der App.
        </p>
      </div>

      <div className={s.section}>
        <h2>§ 15 Verbraucherstreitbeilegung</h2>
        <p>
          Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </div>

      <div className={s.section}>
        <h2>§ 16 Schlussbestimmungen</h2>
        <p>
          (1) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
          Bei Verbrauchern gilt diese Rechtswahl nur insoweit, als nicht der gewährte Schutz durch
          zwingende Bestimmungen des Rechts des Staates, in dem der Verbraucher seinen
          gewöhnlichen Aufenthalt hat, entzogen wird.
        </p>
        <p>
          (2) Sollten einzelne Bestimmungen dieser AGB unwirksam sein, bleibt die Wirksamkeit der
          übrigen Bestimmungen unberührt.
        </p>
      </div>

      <div className={s.section}>
        <h2>Weitere rechtliche Informationen</h2>
        <p>
          Die deutschen Rechtstexte werden unter moyiq.app/de/ veröffentlicht:{' '}
          {deLegalRef('impressum', 'Impressum')}, {deLegalRef('agb', 'AGB')},{' '}
          {deLegalRef('widerruf', 'Widerrufsbelehrung')} und{' '}
          {deLegalRef('datenschutz', 'Datenschutzerklärung')}. Fragen: support@moyiq.app
        </p>
      </div>

      <div className={s.legalNotice}>
        Dieser Text ist ein Entwurf und wird derzeit rechtlich geprüft. Er stellt keine
        Rechtsberatung dar.
      </div>
    </div>
  )
}

export const TERMS_CONTENT = {
  es: { title: 'Términos de Uso', sub: `${LAST_UPDATED.es} · ${OPERATOR}`, Body: EsBody },
  en: { title: 'Terms of Use', sub: `${LAST_UPDATED.en} · ${OPERATOR}`, Body: EnBody },
  pt: { title: 'Termos de Uso', sub: `${LAST_UPDATED.pt} · ${OPERATOR}`, Body: PtBody },
  de: { title: 'Allgemeine Geschäftsbedingungen (AGB)', sub: `${LAST_UPDATED.de} · ${OPERATOR}`, Body: DeBody },
}
