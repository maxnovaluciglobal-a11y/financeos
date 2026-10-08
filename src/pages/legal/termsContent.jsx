// src/pages/legal/termsContent.jsx
// Términos de Uso — MOY IQ, contenido por idioma (es/en/pt/de).
// Sin hooks ni useT: Terms.jsx elige el idioma y legal.test.js lo renderiza en node.
// Revisión legal completada 2026-10-08 (investigación con fuentes, sin abogado colegiado).
// Mismos hechos que ../financeos-landing/terms.html, en/terms.html y de/agb.html (rama
// i18n/landing-de): identificación de la LLC, renovación automática y cancelación en línea,
// prueba gratuita condicional ("si se ofrece"), garantía técnica de 14 días, desistimiento UE,
// Florida + Miami-Dade con salvedad de consumo. El bloque alemán sigue las AGB (derecho alemán,
// Jahresabo nach der ersten Laufzeit monatlich kündbar, § 356a BGB).
// Riesgos residuales: IVA UE/OSS sin registrar, sales tax EE. UU., sin representante art. 27
// RGPD, teléfono exigido por Art. 246a EGBGB, recordatorios de renovación a activar en Stripe.

// vitest.config.js no carga el plugin de React: el JSX se transforma con el runtime
// clásico (React.createElement), así que React tiene que estar en scope.
import React from 'react' // eslint-disable-line no-unused-vars
import s from './legal.module.css'
import { LAST_UPDATED, OPERATOR } from './legalMeta.js'
import { deLegalRef } from './deLegal.js'
import { CompanyBlock } from './companyBlock.jsx'

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
        <CompanyBlock lang="es" />
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
          <li><strong>Plan Starter (gratis):</strong> licencia de uso personal no exclusiva, sin costo y sin límite de tiempo. No permite uso profesional con clientes, redistribución ni entrega a terceros.</li>
          <li><strong>Plan Pro (suscripción mensual de US$4.99 o anual de US$39.99):</strong> todo lo de Starter más las funciones Pro, incluido el Modo Asesor. Permite el uso profesional de MOY IQ con hasta 30 clientes mientras la suscripción esté activa. No permite reventa del software, compartir la clave de licencia ni sublicenciamiento.</li>
        </ul>
        <p>
          El detalle por plan está en el documento de Licencia.
        </p>
      </div>
      <div className={s.section}>
        <h2>5. Precios e impuestos</h2>
        <p>
          Los precios están en dólares estadounidenses y se cobran por adelantado al inicio de cada período a través de Stripe. Para consumidores en la Unión Europea, el precio indicado es el precio final, con cualquier IVA aplicable incluido. En otros países pueden aplicarse impuestos según la ubicación del usuario; si corresponden, se muestran en la página de pago antes de confirmar. Si el precio de Pro cambia, avisamos por email al menos 30 días antes; el nuevo precio rige desde la siguiente renovación y el usuario puede cancelar antes sin costo.
        </p>
      </div>
      <div className={s.section}>
        <h2>6. Renovación automática y cancelación</h2>
        <p>
          <strong>La suscripción a Pro se renueva automáticamente</strong> al final de cada período (cada mes o cada año, según el plan elegido) y se cobra el precio vigente con el mismo medio de pago, hasta que el usuario la cancele.
        </p>
        <p>
          El usuario puede cancelar en línea en cualquier momento en moyiq.app/cancelar.html; cuando esté disponible, también desde Cuenta → Gestionar suscripción (portal de clientes de Stripe), o escribiendo a support@moyiq.app. La cancelación rige al final del período ya pagado: hasta entonces se conserva el acceso Pro y no se hacen más cobros. Después, o si un cobro de renovación no puede procesarse, la cuenta pasa al plan Starter sin pérdida de datos.
        </p>
        <p>
          En los planes anuales enviamos un email antes de cada renovación con la fecha, el importe y cómo cancelar, y al menos una vez al año recordamos a todos los suscriptores el precio, la frecuencia de cobro y cómo cancelar.
        </p>
        <p>
          No se hacen reembolsos parciales por el tiempo no usado, salvo la garantía técnica del punto 8, el derecho de desistimiento del punto 9 y cuando una norma imperativa del país del usuario lo exija (por ejemplo, para consumidores en Alemania, el plan anual, terminado su primer año, puede cancelarse con un mes de preaviso y se devuelve la parte proporcional ya pagada). Las condiciones de renovación y cancelación pueden variar por jurisdicción cuando la ley local así lo disponga.
        </p>
      </div>
      <div className={s.section}>
        <h2>7. Prueba gratuita (si se ofrece)</h2>
        <p>
          Si en algún momento ofrecemos una prueba gratuita de Pro, dura 14 días y se pide un medio de pago al empezar; durante la prueba no se cobra nada. Si el usuario no cancela antes de que termine, el día 15 se convierte automáticamente en una suscripción Pro de pago al plan elegido (US$4.99 al mes o US$39.99 al año), con renovación automática según el punto 6. Unos 3 días antes del final de la prueba enviamos un email con la fecha del primer cobro, el importe y cómo cancelar. Se puede cancelar en cualquier momento de la prueba, por los mismos medios del punto 6, sin ningún cobro. Una prueba por persona; la garantía técnica se cuenta desde el primer cobro.
        </p>
      </div>
      <div className={s.section}>
        <h2>8. Garantía técnica</h2>
        <p>
          Si dentro de los 14 días desde la compra (o desde el primer cobro, si se empezó con una prueba) el usuario tiene un problema técnico que MAXNOVA & LUCI Global LLC no logra ayudar a resolver, se ofrece reembolso completo. Para solicitarlo, escribir a support@moyiq.app. La garantía no cubre decisiones financieras del usuario ni pérdida de datos por falta de respaldo. Esta garantía no limita los derechos que la ley aplicable otorgue al usuario.
        </p>
      </div>
      <div className={s.section}>
        <h2>9. Derecho de desistimiento (consumidores en la UE, el EEE y el Reino Unido)</h2>
        <p>
          Si el usuario es consumidor con residencia en la Unión Europea, el Espacio Económico Europeo o el Reino Unido, puede desistir de la suscripción Pro dentro de los 14 días siguientes a la contratación, sin indicar motivos, con un mensaje claro a support@moyiq.app. Devolvemos todos los pagos en un plazo máximo de 14 días por el mismo medio de pago; si pidió expresamente que el servicio empezara durante ese plazo, podemos descontar la parte proporcional ya prestada. Si es consumidor con residencia habitual en Alemania, se aplican en su lugar las AGB en alemán.
        </p>
      </div>
      <div className={s.section}>
        <h2>10. Responsabilidad del usuario</h2>
        <p>El usuario es el único responsable de:</p>
        <ul className={s.list}>
          <li>La exactitud de los datos que ingresa en la herramienta</li>
          <li>Las decisiones financieras que tome basándose en la información mostrada</li>
          <li>Exportar y respaldar sus datos periódicamente</li>
          <li>La seguridad de su dispositivo, su cuenta y su clave de licencia</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>11. Almacenamiento local y pérdida de datos</h2>
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
        <h2>12. Limitación de responsabilidad</h2>
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
        <h2>13. Propiedad intelectual</h2>
        <p>
          El código fuente, el diseño y el contenido de MOY IQ son propiedad de MAXNOVA & LUCI
          Global LLC y están protegidos por derechos de autor. La licencia no transfiere derechos
          de propiedad intelectual.
        </p>
      </div>

      <div className={s.section}>
        <h2>14. Uso permitido</h2>
        <p>El usuario se compromete a no utilizar MOY IQ para:</p>
        <ul className={s.list}>
          <li>Actividades ilegales o fraudulentas</li>
          <li>Evadir obligaciones fiscales o legales</li>
          <li>Uso comercial con el plan Starter, o con más clientes de los que permite su plan</li>
          <li>Compartir o redistribuir su clave de licencia o su acceso a terceros</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>15. Disponibilidad del servicio</h2>
        <p>
          MOY IQ es una PWA (Progressive Web App) que funciona sin conexión una vez cargada. El
          inicio de sesión, la validación del plan y la sincronización requieren conexión. MAXNOVA &
          LUCI Global LLC no garantiza disponibilidad ininterrumpida del servicio de alojamiento.
        </p>
      </div>

      <div className={s.section}>
        <h2>16. Consecuencias del incumplimiento</h2>
        <p>
          El incumplimiento de estos términos o de los términos de licencia puede resultar, previo aviso
          cuando sea razonable, en la revocación del derecho de uso. Para usar MOY IQ fuera de los límites del
          plan adquirido, escribir antes a <strong>support@moyiq.app</strong>.
        </p>
      </div>

      <div className={s.section}>
        <h2>17. Modificaciones</h2>
        <p>
          MAXNOVA & LUCI Global LLC puede actualizar estos términos. Los cambios se publican en esta
          página con la fecha de actualización. El uso continuado implica aceptación de los
          términos actualizados.
        </p>
      </div>

      <div className={s.section}>
        <h2>18. Ley aplicable</h2>
        <p>
          Estos términos se rigen por las leyes del Estado de Florida (EE. UU.), sin aplicar sus normas de conflicto de leyes. Los tribunales estatales y federales con sede en el condado de Miami-Dade, Florida, son competentes para cualquier controversia, sin perjuicio de que cualquiera de las partes acuda a un tribunal de menor cuantía (small claims). Si el usuario es consumidor, esta elección no lo priva de la protección de las normas imperativas del país donde tiene su residencia habitual ni de su derecho a litigar ante los tribunales de su domicilio cuando esa ley lo garantice.
        </p>
      </div>

      <div className={s.section}>
        <h2>19. Contacto</h2>
        <p>Para consultas sobre estos términos: <strong>support@moyiq.app</strong></p>
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
        <CompanyBlock lang="en" />
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
          <li><strong>Starter plan (free):</strong> a non-exclusive license for personal use, at no cost and with no time limit. It does not allow professional use with clients, redistribution, or handing the app to third parties.</li>
          <li><strong>Pro plan (US$4.99 monthly or US$39.99 annual subscription):</strong> everything in Starter plus the Pro features, including Advisor Mode. It allows professional use of MOY IQ with up to 30 clients while the subscription is active. It does not allow reselling the software, sharing the license key, or sublicensing.</li>
        </ul>
        <p>
          Details per plan are in the License document.
        </p>
      </div>
      <div className={s.section}>
        <h2>5. Prices and taxes</h2>
        <p>
          Prices are in US dollars and are charged in advance at the start of each period through Stripe. For consumers in the European Union, the listed price is the final price, with any applicable VAT included. Elsewhere, taxes may apply depending on the user's location; where they apply, they are shown on the checkout page before confirming. If the Pro price changes, we email the user at least 30 days in advance; the new price applies from the next renewal and the user can cancel before then at no cost.
        </p>
      </div>
      <div className={s.section}>
        <h2>6. Automatic renewal and cancellation</h2>
        <p>
          <strong>The Pro subscription renews automatically</strong> at the end of each period (every month or every year, depending on the plan chosen) and the then-current price is charged to the same payment method until the user cancels.
        </p>
        <p>
          The user can cancel online at any time at moyiq.app/en/cancel.html; when available, also under Account → Manage subscription (Stripe customer portal), or by writing to support@moyiq.app. Cancellation takes effect at the end of the period already paid: Pro access continues until then and no further charges are made. After that, or if a renewal charge cannot be processed, the account moves to the Starter plan with no data loss.
        </p>
        <p>
          On annual plans we email the user before each renewal with the date, the amount, and how to cancel, and at least once a year we remind every subscriber of the price, billing frequency, and how to cancel.
        </p>
        <p>
          There are no partial refunds for unused time, except under the technical guarantee in section 8, the right of withdrawal in section 9, and where mandatory law in the user's country requires one (for example, for consumers in Germany, once its first year has ended the annual plan can be cancelled with one month's notice and the unused prepaid portion is refunded pro rata). Renewal and cancellation terms may vary by jurisdiction where local law requires it.
        </p>
      </div>
      <div className={s.section}>
        <h2>7. Free trial (if offered)</h2>
        <p>
          If we offer a free trial of Pro, it lasts 14 days and a payment method is required to start; nothing is charged during the trial. Unless the user cancels before it ends, on day 15 it converts automatically into a paid Pro subscription on the chosen plan (US$4.99 per month or US$39.99 per year), renewing automatically under section 6. About 3 days before the trial ends we email the date of the first charge, the amount, and how to cancel. The trial can be cancelled at any time, using the same methods as in section 6, with no charge. One trial per person; the technical guarantee runs from the first charge.
        </p>
      </div>
      <div className={s.section}>
        <h2>8. Technical guarantee</h2>
        <p>
          If, within 14 days after purchase (or after the first charge, if the user started with a trial), the user has a technical problem that MAXNOVA & LUCI Global LLC cannot help resolve, a full refund is offered. To request it, write to support@moyiq.app. The guarantee does not cover the user's financial decisions or data loss caused by not having a backup. This guarantee does not limit any rights the user has under applicable law.
        </p>
      </div>
      <div className={s.section}>
        <h2>9. Right of withdrawal (consumers in the EU, EEA, and UK)</h2>
        <p>
          If the user is a consumer resident in the European Union, the European Economic Area, or the United Kingdom, they can withdraw from the Pro subscription within 14 days after signing up, without giving a reason, with a clear message to support@moyiq.app. We refund all payments within 14 days at the latest, to the same payment method; if the user expressly asked for the service to start during that period, we may deduct a proportionate amount for the service already provided. Consumers habitually resident in Germany are covered by the German terms (AGB) instead.
        </p>
      </div>
      <div className={s.section}>
        <h2>10. User responsibility</h2>
        <p>The user is solely responsible for:</p>
        <ul className={s.list}>
          <li>The accuracy of the data entered in the tool</li>
          <li>The financial decisions made based on the information displayed</li>
          <li>Exporting and backing up their data periodically</li>
          <li>The security of their device, account, and license key</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>11. Local storage and data loss</h2>
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
        <h2>12. Limitation of liability</h2>
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
        <h2>13. Intellectual property</h2>
        <p>
          The source code, design, and content of MOY IQ are the property of MAXNOVA & LUCI Global
          LLC and are protected by copyright. The license does not transfer any intellectual
          property rights.
        </p>
      </div>

      <div className={s.section}>
        <h2>14. Permitted use</h2>
        <p>The user agrees not to use MOY IQ for:</p>
        <ul className={s.list}>
          <li>Illegal or fraudulent activity</li>
          <li>Evading tax or legal obligations</li>
          <li>Commercial use on the Starter plan, or with more clients than their plan allows</li>
          <li>Sharing or redistributing their license key or access to third parties</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>15. Service availability</h2>
        <p>
          MOY IQ is a Progressive Web App that works offline once loaded. Sign-in, plan validation,
          and sync require a connection. MAXNOVA & LUCI Global LLC does not guarantee uninterrupted
          availability of the hosting service.
        </p>
      </div>

      <div className={s.section}>
        <h2>16. Non-compliance</h2>
        <p>
          Breaching these terms or the license terms may lead, after notice where
          reasonable, to revocation of the right of use. To use MOY IQ beyond the limits of the purchased plan, write to{' '}
          <strong>support@moyiq.app</strong> first.
        </p>
      </div>

      <div className={s.section}>
        <h2>17. Changes</h2>
        <p>
          MAXNOVA & LUCI Global LLC may update these terms. Changes are published on this page with
          the date of the update. Continued use implies acceptance of the updated terms.
        </p>
      </div>

      <div className={s.section}>
        <h2>18. Governing law</h2>
        <p>
          These terms are governed by the laws of the State of Florida, USA, without regard to its conflict-of-laws rules. The state and federal courts located in Miami-Dade County, Florida, have jurisdiction over any dispute, although either party may bring a claim in small-claims court. If the user is a consumer, this choice does not deprive them of the protection of the mandatory rules of the country where they habitually reside, or of their right to bring proceedings in the courts where they live where that law guarantees it.
        </p>
      </div>

      <div className={s.section}>
        <h2>19. Contact</h2>
        <p>For questions about these terms: <strong>support@moyiq.app</strong></p>
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
        <CompanyBlock lang="pt" />
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
          <li><strong>Plano Starter (gratuito):</strong> licença de uso pessoal não exclusiva, sem custo e sem limite de tempo. Não permite uso profissional com clientes, redistribuição nem entrega a terceiros.</li>
          <li><strong>Plano Pro (assinatura mensal de US$4.99 ou anual de US$39.99):</strong> tudo do Starter mais as funções Pro, incluindo o Modo Consultor. Permite o uso profissional do MOY IQ com até 30 clientes enquanto a assinatura estiver ativa. Não permite revenda do software, compartilhamento da chave de licença nem sublicenciamento.</li>
        </ul>
        <p>
          O detalhe de cada plano está no documento de Licença.
        </p>
      </div>
      <div className={s.section}>
        <h2>5. Preços e impostos</h2>
        <p>
          Os preços estão em dólares americanos e são cobrados antecipadamente no início de cada período pela Stripe. Para consumidores na União Europeia, o preço indicado é o preço final, com qualquer IVA aplicável incluído. Em outros países podem incidir impostos conforme a localização do usuário; quando houver, aparecem na página de pagamento antes da confirmação. Se o preço do Pro mudar, avisamos por email com pelo menos 30 dias de antecedência; o novo preço vale a partir da renovação seguinte e o usuário pode cancelar antes sem custo.
        </p>
      </div>
      <div className={s.section}>
        <h2>6. Renovação automática e cancelamento</h2>
        <p>
          <strong>A assinatura Pro é renovada automaticamente</strong> ao final de cada período (mensal ou anual, conforme o plano escolhido) e o preço vigente é cobrado no mesmo meio de pagamento até que o usuário a cancele.
        </p>
        <p>
          O usuário pode cancelar online a qualquer momento em moyiq.app/cancelar.html; quando estiver disponível, também em Conta → Gerenciar assinatura (portal de clientes da Stripe), ou escrevendo para support@moyiq.app. O cancelamento vale ao final do período já pago: até lá o acesso Pro continua e não há novas cobranças. Depois disso, ou se uma cobrança de renovação não puder ser processada, a conta passa para o plano Starter sem perda de dados.
        </p>
        <p>
          Nos planos anuais enviamos um email antes de cada renovação com a data, o valor e como cancelar, e pelo menos uma vez por ano lembramos todos os assinantes do preço, da frequência de cobrança e de como cancelar.
        </p>
        <p>
          Não há reembolso parcial pelo tempo não utilizado, exceto pela garantia técnica do item 8, pelo direito de arrependimento do item 9 e quando uma norma imperativa do país do usuário o exigir (por exemplo, para consumidores na Alemanha, o plano anual, terminado o primeiro ano, pode ser cancelado com um mês de aviso prévio e a parte proporcional já paga é devolvida). As condições de renovação e cancelamento podem variar por jurisdição quando a lei local assim determinar.
        </p>
      </div>
      <div className={s.section}>
        <h2>7. Teste gratuito (se oferecido)</h2>
        <p>
          Se oferecermos um teste gratuito do Pro, ele dura 14 dias e é preciso informar um meio de pagamento para começar; nada é cobrado durante o teste. Se o usuário não cancelar antes do fim, no dia 15 ele se converte automaticamente em uma assinatura Pro paga no plano escolhido (US$4.99 por mês ou US$39.99 por ano), com renovação automática conforme o item 6. Cerca de 3 dias antes do fim do teste enviamos um email com a data da primeira cobrança, o valor e como cancelar. É possível cancelar a qualquer momento do teste, pelos mesmos meios do item 6, sem nenhuma cobrança. Um teste por pessoa; a garantia técnica conta a partir da primeira cobrança.
        </p>
      </div>
      <div className={s.section}>
        <h2>8. Garantia técnica</h2>
        <p>
          Se, nos primeiros 14 dias a partir da compra (ou da primeira cobrança, se o usuário começou com um teste), o usuário tiver um problema técnico que a MAXNOVA & LUCI Global LLC não consiga ajudar a resolver, é oferecido reembolso integral. Para solicitá-lo, escreva para support@moyiq.app. A garantia não cobre decisões financeiras do usuário nem perda de dados por falta de backup. Esta garantia não limita os direitos que a lei aplicável assegura ao usuário.
        </p>
      </div>
      <div className={s.section}>
        <h2>9. Direito de arrependimento (consumidores na UE, no EEE e no Reino Unido)</h2>
        <p>
          Se o usuário for consumidor residente na União Europeia, no Espaço Econômico Europeu ou no Reino Unido, pode desistir da assinatura Pro em até 14 dias após a contratação, sem indicar motivo, com uma mensagem clara para support@moyiq.app. Devolvemos todos os pagamentos em no máximo 14 dias pelo mesmo meio de pagamento; se o usuário pediu expressamente que o serviço começasse nesse prazo, podemos descontar a parte proporcional já prestada. Consumidores com residência habitual na Alemanha estão cobertos pelos termos em alemão (AGB). Isso não limita os direitos que a legislação do país do usuário lhe assegura, como o Código de Defesa do Consumidor no Brasil.
        </p>
      </div>
      <div className={s.section}>
        <h2>10. Responsabilidade do usuário</h2>
        <p>O usuário é o único responsável por:</p>
        <ul className={s.list}>
          <li>A exatidão dos dados que insere na ferramenta</li>
          <li>As decisões financeiras que tomar com base nas informações mostradas</li>
          <li>Exportar e fazer backup dos seus dados periodicamente</li>
          <li>A segurança do seu dispositivo, da sua conta e da sua chave de licença</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>11. Armazenamento local e perda de dados</h2>
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
        <h2>12. Limitação de responsabilidade</h2>
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
        <h2>13. Propriedade intelectual</h2>
        <p>
          O código-fonte, o design e o conteúdo do MOY IQ são propriedade da MAXNOVA & LUCI Global
          LLC e estão protegidos por direitos autorais. A licença não transfere direitos de
          propriedade intelectual.
        </p>
      </div>

      <div className={s.section}>
        <h2>14. Uso permitido</h2>
        <p>O usuário se compromete a não usar o MOY IQ para:</p>
        <ul className={s.list}>
          <li>Atividades ilegais ou fraudulentas</li>
          <li>Evadir obrigações fiscais ou legais</li>
          <li>Uso comercial com o plano Starter, ou com mais clientes do que o seu plano permite</li>
          <li>Compartilhar ou redistribuir sua chave de licença ou seu acesso a terceiros</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>15. Disponibilidade do serviço</h2>
        <p>
          O MOY IQ é uma PWA (Progressive Web App) que funciona offline depois de carregada. O
          login, a validação do plano e a sincronização exigem conexão. A MAXNOVA & LUCI Global LLC
          não garante disponibilidade ininterrupta do serviço de hospedagem.
        </p>
      </div>

      <div className={s.section}>
        <h2>16. Consequências do descumprimento</h2>
        <p>
          O descumprimento destes termos ou dos termos de licença pode resultar, mediante aviso
          prévio quando razoável, na revogação do direito de uso. Para usar o MOY IQ além dos limites do plano adquirido,
          escreva antes para <strong>support@moyiq.app</strong>.
        </p>
      </div>

      <div className={s.section}>
        <h2>17. Alterações</h2>
        <p>
          A MAXNOVA & LUCI Global LLC pode atualizar estes termos. As alterações são publicadas
          nesta página com a data de atualização. O uso continuado implica aceitação dos termos
          atualizados.
        </p>
      </div>

      <div className={s.section}>
        <h2>18. Lei aplicável</h2>
        <p>
          Estes termos regem-se pelas leis do Estado da Flórida (EUA), sem aplicação das suas normas de conflito de leis. Os tribunais estaduais e federais com sede no condado de Miami-Dade, Flórida, são competentes para qualquer disputa, sem prejuízo de qualquer das partes recorrer a um juizado de pequenas causas. Se o usuário for consumidor, esta escolha não o priva da proteção das normas imperativas do país onde tem residência habitual nem do direito de litigar nos tribunais do seu domicílio quando essa lei o garantir.
        </p>
      </div>

      <div className={s.section}>
        <h2>19. Contato</h2>
        <p>Para questões sobre estes termos: <strong>support@moyiq.app</strong></p>
      </div>

    </div>
  )
}

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
          installierbare Progressive Web App) zwischen der MAXNOVA & LUCI Global LLC, 10482 NW 31st Terrace,
          Office 1D, Doral, FL 33172, USA, E-Mail: support@moyiq.app (nachfolgend „wir“ oder „Anbieter“) und den Nutzerinnen und Nutzern
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
        <CompanyBlock lang="de" />
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
          handelt sich um Endpreise: Eine etwa geschuldete Umsatzsteuer ist im Preis enthalten;
          weitere Steuern oder Gebühren berechnen wir nicht.
        </p>
        <p>
          (2) Die Zahlung erfolgt im Voraus für den jeweiligen Abrechnungszeitraum über Stripe.
          Für Zahlungen in Fremdwährung kann Ihr Kreditinstitut eigene Gebühren berechnen, auf die
          wir keinen Einfluss haben.
        </p>
      </div>

      <div className={s.section}>
        <h2>§ 5a Kostenlose Testphase (falls angeboten)</h2>
        <p>
          Bieten wir Pro mit einer kostenlosen Testphase an, beträgt diese 14 Tage ab
          Vertragsschluss; für den Start ist ein Zahlungsmittel anzugeben, während der Testphase
          wird nichts berechnet. Kündigen Sie nicht vor Ablauf, wird das Abo ab dem 15. Tag
          kostenpflichtig zum gewählten Tarif (US$ 4,99 pro Monat oder US$ 39,99 pro Jahr) und
          läuft nach § 6 weiter. Etwa drei Tage vor Ablauf erinnern wir Sie per E-Mail an Datum und
          Höhe der ersten Zahlung. Sie können während der Testphase jederzeit kostenfrei kündigen.
          Pro Person ist eine Testphase möglich; die Garantie nach § 8 läuft ab der ersten Zahlung.
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
          (3) Sie können über die Kündigungsschaltfläche{' '}
          {deLegalRef('kuendigen', '„Verträge hier kündigen“')}, sobald verfügbar in der App unter
          „Konto → Abo verwalten“ (Kundenportal von Stripe), per E-Mail an support@moyiq.app oder
          per Brief an die oben genannte Anschrift kündigen. Eine Anmeldung im Benutzerkonto ist
          dafür nicht erforderlich. Beim Jahresabo erinnern wir Sie vor jeder Verlängerung per
          E-Mail an Termin, Betrag und Kündigungsmöglichkeiten.
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
          (3) Pro ist eine digitale Dienstleistung (§ 327 Abs. 2 Satz 2 BGB). Das Widerrufsrecht
          erlischt nicht vorzeitig mit Beginn der Nutzung, sondern besteht für die volle Frist
          (§ 356 Abs. 5 BGB). Wertersatz schulden Sie nur, wenn Sie ausdrücklich verlangt haben,
          dass wir vor Ablauf der Widerrufsfrist beginnen (§ 357a Abs. 2 BGB). Den Widerruf können
          Sie auch online über „Vertrag widerrufen“ auf moyiq.app/de/ erklären (§ 356a BGB).
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
          innerhalb von 14 Tagen nach dem Kauf von Pro (bei vorheriger Testphase: nach der ersten
          Zahlung) ein technisches Problem auf, bei dessen
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

    </div>
  )
}

export const TERMS_CONTENT = {
  es: { title: 'Términos de Uso', sub: `${LAST_UPDATED.es} · ${OPERATOR}`, Body: EsBody },
  en: { title: 'Terms of Use', sub: `${LAST_UPDATED.en} · ${OPERATOR}`, Body: EnBody },
  pt: { title: 'Termos de Uso', sub: `${LAST_UPDATED.pt} · ${OPERATOR}`, Body: PtBody },
  de: { title: 'Allgemeine Geschäftsbedingungen (AGB)', sub: `${LAST_UPDATED.de} · ${OPERATOR}`, Body: DeBody },
}
