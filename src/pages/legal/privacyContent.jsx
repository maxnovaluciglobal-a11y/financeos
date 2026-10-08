// src/pages/legal/privacyContent.jsx
// Política de Privacidad — MOY IQ, contenido por idioma (es/en/pt/de).
// Sin hooks ni useT: Privacy.jsx elige el idioma y legal.test.js lo renderiza en node.
// Revisión legal completada 2026-10-08 (investigación con fuentes, sin abogado colegiado).
// Riesgos residuales: sin representante art. 27 RGPD, sin double opt-in para emails promocionales.
// ACTUALIZADO 2026-10: la app exige cuenta (email/Google); se listan los datos que
// sí guardamos (Supabase), los proveedores (Supabase, Stripe, Resend, Vercel,
// Formspree) y el envío de reportes PDF del Modo Asesor, que pasa sin cifrado de
// extremo a extremo por el servidor y Resend. Fuente de los hechos:
// ../financeos-landing/privacy.html (corregida, oct-2026).

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
        <strong>Resumen:</strong> Para usar MOY IQ se necesita una cuenta gratuita, asociada a un
        email. Los datos financieros del usuario se guardan en su dispositivo y no los recibimos.
        Solo salen del dispositivo si el usuario activa la sincronización (viajan y se guardan{' '}
        <strong>cifrados de extremo a extremo</strong>, no podemos leerlos) o si envía un reporte
        PDF por email. No usamos analítica ni seguimiento de comportamiento, y la app no se
        conecta con bancos.
      </div>

      <div className={s.section}>
        <h2>1. Quién opera MOY IQ</h2>
        <p>
          MOY IQ es desarrollado y distribuido por MAXNOVA & LUCI Global LLC. Esta política explica
          qué datos se quedan en el dispositivo del usuario, qué datos guardamos en nuestros
          servidores, con qué proveedores trabajamos y cómo ejercer los derechos sobre esos datos.
        </p>
        <CompanyBlock lang="es" />
      </div>

      <div className={s.section}>
        <h2>2. Cuenta de usuario</h2>
        <p>
          Para usar la app se necesita una <strong>cuenta gratuita</strong>. Guardamos el email de
          la cuenta. Si el usuario entra con Google, recibimos de Google su email y su nombre. La
          contraseña la gestiona el servicio de autenticación de forma cifrada; nosotros nunca
          la vemos.
        </p>
      </div>

      <div className={s.section}>
        <h2>3. Datos financieros: se quedan en el dispositivo</h2>
        <p>
          Los siguientes datos se guardan en el navegador o dispositivo del usuario mediante
          IndexedDB, un estándar de almacenamiento local. <strong>No los recibimos</strong> ni son
          accesibles para MAXNOVA & LUCI Global LLC ni para terceros:
        </p>
        <ul className={s.list}>
          <li>Ingresos y gastos registrados</li>
          <li>Presupuestos, deudas y metas</li>
          <li>Suscripciones y gastos recurrentes</li>
          <li>Configuración de la aplicación</li>
        </ul>
        <div className={s.infoBox}>
          <strong>Implicación práctica:</strong> Si el usuario borra los datos del navegador,
          desinstala la app o cambia de dispositivo sin haber exportado un respaldo (o sin tener
          la sincronización activa), sus datos se pierden de forma permanente y no podemos
          recuperarlos.
        </div>
        <div className={s.warnBox} style={{ marginTop: 8 }}>
          <strong>Modo incógnito o privado:</strong> En esas ventanas el navegador borra los datos
          al cerrar la sesión. Para uso regular, conviene abrir la app en una ventana normal o
          instalarla (Agregar a pantalla de inicio).
        </div>
      </div>

      <div className={s.section}>
        <h2>4. Datos que sí guardamos</h2>
        <p>
          Además del email de la cuenta, guardamos en nuestra base de datos (Supabase) solo lo
          siguiente:
        </p>
        <ul className={s.list}>
          <li>
            <strong>Registro en Starter:</strong> el email, para enviar correos sobre el uso de la
            app. Cada correo incluye un enlace para darse de baja.
          </li>
          <li>
            <strong>Formulario del demo:</strong> nombre, email y si el usuario acepta recibir
            novedades.
          </li>
          <li>
            <strong>Diagnóstico Exprés:</strong> email, puntaje obtenido y si el usuario acepta
            recibir novedades.
          </li>
          <li>
            <strong>Plan Pro:</strong> el email de la compra, un hash irreversible de la clave de
            licencia (nunca la clave en texto plano), el plan y las fechas de activación y
            vencimiento.
          </li>
          <li>
            <strong>Notificaciones push (opcional):</strong> el identificador técnico (endpoint)
            del navegador, asociado al hash de la licencia. Las notificaciones contienen solo
            avisos del sistema, nunca datos financieros.
          </li>
          <li>
            <strong>Sincronización (opcional):</strong> los datos cifrados descritos en el punto 5,
            que no podemos leer.
          </li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>5. Sincronización entre dispositivos (opcional, cifrada de extremo a extremo)</h2>
        <p>
          Si el usuario activa la sincronización en Ajustes, sus datos se cifran en el dispositivo
          con <strong>AES-GCM</strong> antes de enviarse y se almacenan solo en esa forma. La llave
          de cifrado se deriva en el dispositivo a partir de la clave de licencia y{' '}
          <strong>nunca sale de él</strong>: ni MAXNOVA & LUCI Global LLC ni el proveedor de
          infraestructura pueden leer el contenido. La sincronización es opcional y puede
          desactivarse en cualquier momento desde Ajustes.
        </p>
      </div>

      <div className={s.section}>
        <h2>6. Envío de reportes por email (Modo Asesor)</h2>
        <p>
          Cuando el usuario pulsa el botón para enviar un reporte PDF por email desde el Modo
          Asesor, el PDF (con los datos financieros que contiene) y la dirección del destinatario
          pasan por nuestro servidor y por nuestro proveedor de email (Resend){' '}
          <strong>sin cifrado de extremo a extremo</strong>, únicamente para entregarlo. No
          guardamos el reporte. Esto ocurre solo cuando el usuario realiza esa acción.
        </p>
      </div>

      <div className={s.section}>
        <h2>7. Proveedores</h2>
        <p>Trabajamos con estos proveedores para operar el servicio:</p>
        <ul className={s.list}>
          <li><strong>Supabase:</strong> base de datos, autenticación, sincronización cifrada y validación de licencias (servidores en Ohio, EE. UU., región us-east-2).</li>
          <li>
            <strong>Stripe:</strong> procesa los pagos. Nunca vemos los datos de la tarjeta;
            recibimos solo la confirmación del pago y el email asociado a la compra.
          </li>
          <li><strong>Resend:</strong> envío de correos.</li>
          <li><strong>Vercel:</strong> alojamiento de la app y del sitio web.</li>
          <li><strong>Formspree:</strong> recibe el formulario de novedades del sitio web.</li>
          <li><strong>Google:</strong> solo si el usuario elige entrar con Google.</li>
        </ul>
        <p>
          Ninguno de estos proveedores accede a los datos financieros guardados en el dispositivo.
          Varios tienen sede en Estados Unidos, por lo que los datos de cuenta y contacto pueden
          procesarse allí. No vendemos datos ni los cedemos a terceros con fines publicitarios.
        </p>
      </div>

      <div className={s.section}>
        <h2>8. Analítica, seguimiento y bancos</h2>
        <p>
          MOY IQ <strong>no incluye</strong> herramientas de analítica (Google Analytics, Mixpanel,
          Hotjar u otras) ni seguimiento de comportamiento. No se registran eventos, sesiones ni
          clics. La app no se conecta con cuentas bancarias y nunca pide credenciales del banco.
        </p>
        <p>
          La plataforma de alojamiento puede registrar datos técnicos estándar (como direcciones
          IP) para operar el servicio, según sus propias políticas.
        </p>
      </div>

      <div className={s.section}>
        <h2>9. Cookies y almacenamiento del navegador</h2>
        <p>
          MOY IQ usa IndexedDB y localStorage para guardar los datos en el dispositivo. No usa
          cookies de seguimiento ni de terceros. El almacenamiento que usa es el estrictamente
          necesario para que la aplicación funcione.
        </p>
      </div>

      <div className={s.section}>
        <h2>10. Exportación e importación de datos</h2>
        <p>
          El usuario puede exportar todos sus datos en formato JSON o CSV desde Ajustes. La
          exportación queda bajo su control exclusivo; no recibimos copia. La importación de
          respaldos ocurre íntegramente en el dispositivo.
        </p>
      </div>

      <div className={s.section}>
        <h2>11. Correos, baja y derechos sobre los datos</h2>
        <p>
          Cada correo que enviamos incluye un enlace para darse de baja. También se puede pedir la
          baja escribiendo a <strong>support@moyiq.app</strong>.
        </p>
        <p>
          Para acceder a los datos que guardamos, corregirlos o pedir su eliminación (incluida la
          de la cuenta), basta con escribir a <strong>support@moyiq.app</strong>. Los datos
          financieros guardados solo en el dispositivo los controla y borra el propio usuario,
          porque nosotros no los tenemos.
        </p>
        <p>
          Respondemos en un plazo máximo de 30 días. Los datos se tratan en EE. UU.; para usuarios
          del Espacio Económico Europeo, el Reino Unido o Suiza, la transferencia se apoya en el
          Marco de Privacidad de Datos UE-EE. UU. cuando el destinatario está certificado y, si no,
          en las cláusulas contractuales tipo de la Comisión Europea. Quien vive en la UE o el EEE
          (por ejemplo, en España) puede además reclamar ante la autoridad de protección de datos
          de su país. No vendemos datos personales.
        </p>
      </div>

      <div className={s.section}>
        <h2>12. Seguridad</h2>
        <p>
          Los datos locales dependen de la seguridad del dispositivo del usuario. Los datos
          sincronizados están cifrados de extremo a extremo: una filtración del servidor no
          expondría contenido legible. Recomendamos exportar respaldos JSON periódicamente y
          guardar la clave de licencia en un lugar seguro (de ella se deriva la llave de cifrado).
        </p>
      </div>

      <div className={s.section}>
        <h2>13. Menores de edad</h2>
        <p>
          MOY IQ no está dirigido a menores de 18 años. No recopilamos intencionalmente
          información de menores.
        </p>
      </div>

      <div className={s.section}>
        <h2>14. Cambios a esta política</h2>
        <p>
          MAXNOVA & LUCI Global LLC puede actualizar esta política. Los cambios se publican en esta
          página con la fecha de actualización.
        </p>
      </div>

      <div className={s.section}>
        <h2>15. Contacto</h2>
        <p>Para consultas sobre privacidad: <strong>support@moyiq.app</strong></p>
      </div>

    </div>
  )
}

function EnBody() {
  return (
    <div className={s.legalWrap}>
      <div className={s.highlight}>
        <strong>Summary:</strong> You need a free account, tied to an email address, to use
        MOY IQ. Your financial data is stored on your device and we do not receive it. It only
        leaves the device if you turn on sync (it travels and is stored{' '}
        <strong>end-to-end encrypted</strong>, and we cannot read it) or if you email a PDF report.
        We do not use analytics or behavior tracking, and the app does not connect to banks.
      </div>

      <div className={s.section}>
        <h2>1. Who operates MOY IQ</h2>
        <p>
          MOY IQ is developed and distributed by MAXNOVA & LUCI Global LLC. This policy explains
          which data stays on the user's device, which data we store on our servers, which service
          providers we use, and how to exercise rights over that data.
        </p>
        <CompanyBlock lang="en" />
      </div>

      <div className={s.section}>
        <h2>2. User account</h2>
        <p>
          A <strong>free account</strong> is required to use the app. We store the account email.
          If the user signs in with Google, we receive their email and name from Google. The
          password is handled, encrypted, by the authentication service; we never see it.
        </p>
      </div>

      <div className={s.section}>
        <h2>3. Financial data stays on the device</h2>
        <p>
          The following data is stored in the user's browser or device using IndexedDB, a local
          storage standard. <strong>We do not receive it</strong>, and it is not accessible to
          MAXNOVA & LUCI Global LLC or any third party:
        </p>
        <ul className={s.list}>
          <li>Recorded income and expenses</li>
          <li>Budgets, debts, and goals</li>
          <li>Subscriptions and recurring expenses</li>
          <li>App settings</li>
        </ul>
        <div className={s.infoBox}>
          <strong>Practical implication:</strong> If the user clears browser data, uninstalls the
          app, or switches devices without exporting a backup (or without sync enabled), the data
          is lost permanently and we cannot recover it.
        </div>
        <div className={s.warnBox} style={{ marginTop: 8 }}>
          <strong>Incognito or private mode:</strong> In those windows the browser erases the data
          when the session ends. For regular use, open the app in a normal window or install it
          (Add to Home Screen).
        </div>
      </div>

      <div className={s.section}>
        <h2>4. Data we do store</h2>
        <p>
          Besides the account email, we store only the following in our database (Supabase):
        </p>
        <ul className={s.list}>
          <li>
            <strong>Starter sign-up:</strong> the email, to send emails about using the app. Every
            email includes an unsubscribe link.
          </li>
          <li>
            <strong>Demo form:</strong> name, email, and whether the user agrees to receive
            product news.
          </li>
          <li>
            <strong>Score check:</strong> email, the score obtained, and whether the user agrees to
            receive product news.
          </li>
          <li>
            <strong>Pro plan:</strong> the purchase email, an irreversible hash of the license key
            (never the key in plain text), the plan, and the activation and expiration dates.
          </li>
          <li>
            <strong>Push notifications (optional):</strong> the browser's technical identifier
            (endpoint), linked to the license hash. Notifications contain only system notices,
            never financial data.
          </li>
          <li>
            <strong>Sync (optional):</strong> the encrypted data described in section 5, which we
            cannot read.
          </li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>5. Cross-device sync (optional, end-to-end encrypted)</h2>
        <p>
          If the user turns on sync in Settings, their data is encrypted on the device with{' '}
          <strong>AES-GCM</strong> before it is sent, and it is stored only in that form. The
          encryption key is derived on the device from the license key and{' '}
          <strong>never leaves it</strong>: neither MAXNOVA & LUCI Global LLC nor the
          infrastructure provider can read the content. Sync is optional and can be turned off at
          any time in Settings.
        </p>
      </div>

      <div className={s.section}>
        <h2>6. Emailing reports (Advisor Mode)</h2>
        <p>
          When the user presses the button to email a PDF report from Advisor Mode, the PDF (with
          the financial data it contains) and the recipient's address pass through our server and
          our email provider (Resend) <strong>without end-to-end encryption</strong>, only to
          deliver it. We do not keep the report. This happens only when the user takes that action.
        </p>
      </div>

      <div className={s.section}>
        <h2>7. Service providers</h2>
        <p>We use these providers to run the service:</p>
        <ul className={s.list}>
          <li><strong>Supabase:</strong> database, authentication, encrypted sync, and license validation (servers in Ohio, USA, region us-east-2).</li>
          <li>
            <strong>Stripe:</strong> processes payments. We never see card details; we only
            receive the payment confirmation and the email used for the purchase.
          </li>
          <li><strong>Resend:</strong> sending emails.</li>
          <li><strong>Vercel:</strong> hosting for the app and the website.</li>
          <li><strong>Formspree:</strong> receives the product-news form on the website.</li>
          <li><strong>Google:</strong> only if the user chooses to sign in with Google.</li>
        </ul>
        <p>
          None of these providers has access to the financial data stored on the device. Several
          are based in the United States, so account and contact data may be processed there. We
          do not sell data or share it with third parties for advertising.
        </p>
      </div>

      <div className={s.section}>
        <h2>8. Analytics, tracking, and banks</h2>
        <p>
          MOY IQ <strong>does not include</strong> analytics tools (Google Analytics, Mixpanel,
          Hotjar, or others) or behavior tracking. No events, sessions, or clicks are recorded. The
          app does not connect to bank accounts and never asks for bank credentials.
        </p>
        <p>
          The hosting platform may log standard technical data (such as IP addresses) to operate
          the service, under its own policies.
        </p>
      </div>

      <div className={s.section}>
        <h2>9. Cookies and browser storage</h2>
        <p>
          MOY IQ uses IndexedDB and localStorage to keep data on the device. It does not use
          tracking or third-party cookies. The storage it uses is strictly what the app needs to
          work.
        </p>
      </div>

      <div className={s.section}>
        <h2>10. Data export and import</h2>
        <p>
          The user can export all their data as JSON or CSV from Settings. The export stays under
          their exclusive control; we receive no copy. Backup imports happen entirely on the device.
        </p>
      </div>

      <div className={s.section}>
        <h2>11. Emails, unsubscribing, and data rights</h2>
        <p>
          Every email we send includes an unsubscribe link. The user can also unsubscribe by
          writing to <strong>support@moyiq.app</strong>.
        </p>
        <p>
          To access the data we store, correct it, or request its deletion (including deletion of
          the account), write to <strong>support@moyiq.app</strong>. Financial data stored only on
          the device is controlled and deleted by the user, because we do not hold it.
        </p>
        <p>
          We reply within 30 days. Data is processed in the USA; for users in the European Economic
          Area, the UK, or Switzerland, the transfer relies on the EU-US Data Privacy Framework
          where the recipient is certified and, otherwise, on the European Commission's standard
          contractual clauses. Users in the EU or EEA can also complain to the data protection
          authority of their country. We do not sell personal information.
        </p>
      </div>

      <div className={s.section}>
        <h2>12. Security</h2>
        <p>
          Local data depends on the security of the user's device. Synced data is end-to-end
          encrypted: a server breach would not expose readable content. We recommend exporting
          JSON backups periodically and keeping the license key somewhere safe (the encryption key
          is derived from it).
        </p>
      </div>

      <div className={s.section}>
        <h2>13. Minors</h2>
        <p>
          MOY IQ is not directed at people under 18. We do not knowingly collect information from
          minors.
        </p>
      </div>

      <div className={s.section}>
        <h2>14. Changes to this policy</h2>
        <p>
          MAXNOVA & LUCI Global LLC may update this policy. Changes are published on this page with
          the date of the update.
        </p>
      </div>

      <div className={s.section}>
        <h2>15. Contact</h2>
        <p>For privacy questions: <strong>support@moyiq.app</strong></p>
      </div>

    </div>
  )
}

function PtBody() {
  return (
    <div className={s.legalWrap}>
      <div className={s.highlight}>
        <strong>Resumo:</strong> Para usar o MOY IQ é preciso ter uma conta gratuita, vinculada a
        um email. Os dados financeiros do usuário ficam no dispositivo dele e nós não os
        recebemos. Eles só saem do dispositivo se o usuário ativar a sincronização (trafegam e são
        armazenados <strong>criptografados de ponta a ponta</strong>, e não podemos lê-los) ou se
        enviar um relatório PDF por email. Não usamos analytics nem rastreamento de comportamento,
        e o app não se conecta a bancos.
      </div>

      <div className={s.section}>
        <h2>1. Quem opera o MOY IQ</h2>
        <p>
          O MOY IQ é desenvolvido e distribuído pela MAXNOVA & LUCI Global LLC. Esta política
          explica quais dados ficam no dispositivo do usuário, quais dados armazenamos em nossos
          servidores, com quais fornecedores trabalhamos e como exercer os direitos sobre esses dados.
        </p>
        <CompanyBlock lang="pt" />
      </div>

      <div className={s.section}>
        <h2>2. Conta de usuário</h2>
        <p>
          Para usar o app é necessária uma <strong>conta gratuita</strong>. Armazenamos o email da
          conta. Se o usuário entrar com o Google, recebemos do Google o email e o nome dele. A
          senha é gerenciada, criptografada, pelo serviço de autenticação; nós nunca a vemos.
        </p>
      </div>

      <div className={s.section}>
        <h2>3. Dados financeiros ficam no dispositivo</h2>
        <p>
          Os dados abaixo são armazenados no navegador ou dispositivo do usuário via IndexedDB, um
          padrão de armazenamento local. <strong>Nós não os recebemos</strong>, e eles não são
          acessíveis à MAXNOVA & LUCI Global LLC nem a terceiros:
        </p>
        <ul className={s.list}>
          <li>Receitas e despesas registradas</li>
          <li>Orçamentos, dívidas e metas</li>
          <li>Assinaturas e despesas recorrentes</li>
          <li>Configurações do app</li>
        </ul>
        <div className={s.infoBox}>
          <strong>Implicação prática:</strong> Se o usuário apagar os dados do navegador,
          desinstalar o app ou trocar de dispositivo sem ter exportado um backup (ou sem a
          sincronização ativa), os dados são perdidos permanentemente e não podemos recuperá-los.
        </div>
        <div className={s.warnBox} style={{ marginTop: 8 }}>
          <strong>Modo anônimo ou privado:</strong> Nessas janelas o navegador apaga os dados ao
          encerrar a sessão. Para uso regular, abra o app em uma janela normal ou instale-o
          (Adicionar à tela inicial).
        </div>
      </div>

      <div className={s.section}>
        <h2>4. Dados que armazenamos</h2>
        <p>
          Além do email da conta, armazenamos em nosso banco de dados (Supabase) apenas o seguinte:
        </p>
        <ul className={s.list}>
          <li>
            <strong>Cadastro no Starter:</strong> o email, para enviar emails sobre o uso do app.
            Cada email traz um link para cancelar o recebimento.
          </li>
          <li>
            <strong>Formulário da demo:</strong> nome, email e se o usuário aceita receber
            novidades.
          </li>
          <li>
            <strong>Diagnóstico Expresso:</strong> email, pontuação obtida e se o usuário aceita
            receber novidades.
          </li>
          <li>
            <strong>Plano Pro:</strong> o email da compra, um hash irreversível da chave de licença
            (nunca a chave em texto puro), o plano e as datas de ativação e vencimento.
          </li>
          <li>
            <strong>Notificações push (opcional):</strong> o identificador técnico (endpoint) do
            navegador, vinculado ao hash da licença. As notificações contêm apenas avisos do
            sistema, nunca dados financeiros.
          </li>
          <li>
            <strong>Sincronização (opcional):</strong> os dados criptografados descritos no item 5,
            que não podemos ler.
          </li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>5. Sincronização entre dispositivos (opcional, criptografada de ponta a ponta)</h2>
        <p>
          Se o usuário ativar a sincronização em Configurações, os dados são criptografados no
          dispositivo com <strong>AES-GCM</strong> antes do envio e armazenados apenas nessa
          forma. A chave de criptografia é derivada no dispositivo a partir da chave de licença e{' '}
          <strong>nunca sai dele</strong>: nem a MAXNOVA & LUCI Global LLC nem o provedor de
          infraestrutura podem ler o conteúdo. A sincronização é opcional e pode ser desativada a
          qualquer momento em Configurações.
        </p>
      </div>

      <div className={s.section}>
        <h2>6. Envio de relatórios por email (Modo Consultor)</h2>
        <p>
          Quando o usuário aperta o botão para enviar um relatório PDF por email no Modo
          Consultor, o PDF (com os dados financeiros que contém) e o endereço do destinatário
          passam pelo nosso servidor e pelo nosso provedor de email (Resend){' '}
          <strong>sem criptografia de ponta a ponta</strong>, apenas para entregá-lo. Não
          guardamos o relatório. Isso só acontece quando o usuário realiza essa ação.
        </p>
      </div>

      <div className={s.section}>
        <h2>7. Fornecedores</h2>
        <p>Trabalhamos com estes fornecedores para operar o serviço:</p>
        <ul className={s.list}>
          <li><strong>Supabase:</strong> banco de dados, autenticação, sincronização criptografada e validação de licenças (servidores em Ohio, EUA, região us-east-2).</li>
          <li>
            <strong>Stripe:</strong> processa os pagamentos. Nunca vemos os dados do cartão;
            recebemos apenas a confirmação do pagamento e o email da compra.
          </li>
          <li><strong>Resend:</strong> envio de emails.</li>
          <li><strong>Vercel:</strong> hospedagem do app e do site.</li>
          <li><strong>Formspree:</strong> recebe o formulário de novidades do site.</li>
          <li><strong>Google:</strong> apenas se o usuário escolher entrar com o Google.</li>
        </ul>
        <p>
          Nenhum desses fornecedores acessa os dados financeiros armazenados no dispositivo. Vários
          têm sede nos Estados Unidos, por isso os dados de conta e contato podem ser processados
          lá. Não vendemos dados nem os compartilhamos com terceiros para fins publicitários.
        </p>
      </div>

      <div className={s.section}>
        <h2>8. Analytics, rastreamento e bancos</h2>
        <p>
          O MOY IQ <strong>não inclui</strong> ferramentas de analytics (Google Analytics,
          Mixpanel, Hotjar ou outras) nem rastreamento de comportamento. Não são registrados
          eventos, sessões nem cliques. O app não se conecta a contas bancárias e nunca pede
          credenciais do banco.
        </p>
        <p>
          A plataforma de hospedagem pode registrar dados técnicos padrão (como endereços IP) para
          operar o serviço, segundo suas próprias políticas.
        </p>
      </div>

      <div className={s.section}>
        <h2>9. Cookies e armazenamento do navegador</h2>
        <p>
          O MOY IQ usa IndexedDB e localStorage para manter os dados no dispositivo. Não usa
          cookies de rastreamento nem de terceiros. O armazenamento usado é o estritamente
          necessário para o funcionamento do app.
        </p>
      </div>

      <div className={s.section}>
        <h2>10. Exportação e importação de dados</h2>
        <p>
          O usuário pode exportar todos os seus dados em JSON ou CSV em Configurações. A exportação
          fica sob seu controle exclusivo; não recebemos cópia. A importação de backups acontece
          inteiramente no dispositivo.
        </p>
      </div>

      <div className={s.section}>
        <h2>11. Emails, cancelamento e direitos sobre os dados</h2>
        <p>
          Todo email que enviamos traz um link para cancelar o recebimento. Também é possível
          pedir o cancelamento escrevendo para <strong>support@moyiq.app</strong>.
        </p>
        <p>
          Para acessar os dados que armazenamos, corrigi-los ou pedir a exclusão (inclusive da
          conta), basta escrever para <strong>support@moyiq.app</strong>. Os dados financeiros
          armazenados apenas no dispositivo são controlados e apagados pelo próprio usuário, porque
          nós não os temos.
        </p>
        <p>
          Respondemos em até 30 dias. Os dados são tratados nos EUA; para usuários do Espaço
          Econômico Europeu, do Reino Unido ou da Suíça, a transferência se apoia no Marco de
          Privacidade de Dados UE-EUA quando o destinatário é certificado e, caso contrário, nas
          cláusulas contratuais-padrão da Comissão Europeia. No Brasil, o titular pode exercer os
          direitos da LGPD pelo mesmo email e reclamar à ANPD; na UE ou no EEE, à autoridade de
          proteção de dados do seu país. Não vendemos dados pessoais.
        </p>
      </div>

      <div className={s.section}>
        <h2>12. Segurança</h2>
        <p>
          Os dados locais dependem da segurança do dispositivo do usuário. Os dados sincronizados
          são criptografados de ponta a ponta: um vazamento do servidor não exporia conteúdo
          legível. Recomendamos exportar backups JSON periodicamente e guardar a chave de licença
          em local seguro (a chave de criptografia é derivada dela).
        </p>
      </div>

      <div className={s.section}>
        <h2>13. Menores de idade</h2>
        <p>
          O MOY IQ não é direcionado a menores de 18 anos. Não coletamos intencionalmente
          informações de menores.
        </p>
      </div>

      <div className={s.section}>
        <h2>14. Alterações nesta política</h2>
        <p>
          A MAXNOVA & LUCI Global LLC pode atualizar esta política. As alterações são publicadas
          nesta página com a data de atualização.
        </p>
      </div>

      <div className={s.section}>
        <h2>15. Contato</h2>
        <p>Para questões sobre privacidade: <strong>support@moyiq.app</strong></p>
      </div>

    </div>
  )
}

// Quelle: ../financeos-landing (Branch i18n/landing-de) de/datenschutz.html. Postanschrift,
// vertretungsberechtigte Person und EU-Vertreter (Art. 27 DSGVO) fehlen dort noch als
// Platzhalter; hier wird deshalb auf das Impressum verwiesen statt Platzhalter anzuzeigen.
function DeBody() {
  return (
    <div className={s.legalWrap}>
      <div className={s.highlight}>
        <strong>Kurz gesagt:</strong> Für die Nutzung von MOY IQ benötigen Sie ein kostenloses
        Konto mit Ihrer E-Mail-Adresse. Ihre Finanzdaten bleiben auf Ihrem Gerät; wir erhalten sie
        nicht. Sie verlassen das Gerät nur, wenn Sie die Synchronisierung aktivieren (dann{' '}
        <strong>Ende-zu-Ende-verschlüsselt</strong>, für uns nicht lesbar) oder einen PDF-Bericht
        per E-Mail versenden. Wir setzen keine Analyse- oder Tracking-Werkzeuge ein, und die App
        verbindet sich nicht mit Ihrer Bank.
      </div>

      <div className={s.section}>
        <h2>1. Verantwortlicher</h2>
        <p>
          Verantwortlich für die Verarbeitung personenbezogener Daten im Sinne der
          Datenschutz-Grundverordnung (DSGVO) ist die MAXNOVA & LUCI Global LLC, vertreten durch
          die Manager Walter M. La Madriz Guerra und Patricia L. Velazco Gil:
        </p>
        <CompanyBlock lang="de" />
        {/* Art. 27 DSGVO: Vertreter in der Union noch nicht benannt (Ausnahme nach Abs. 2 greift
            voraussichtlich nicht, EDPB-Leitlinien 3/2018). Nach Beauftragung hier eintragen. */}
        <p>
          Ein Datenschutzbeauftragter ist nicht benannt. Für alle Fragen zum Datenschutz erreichen
          Sie uns unter support@moyiq.app.
        </p>
      </div>

      <div className={s.section}>
        <h2>2. Benutzerkonto und Anmeldung</h2>
        <p>
          Für die Nutzung der App benötigen Sie ein <strong>kostenloses Benutzerkonto</strong>. Wir
          speichern Ihre E-Mail-Adresse. Melden Sie sich mit Google an, erhalten wir von Google Ihre
          E-Mail-Adresse und Ihren Namen. Ihr Passwort wird vom Authentifizierungsdienst
          ausschließlich verschlüsselt verarbeitet; wir sehen es nicht.
        </p>
        <p>
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertrag). Ohne diese Angaben ist eine
          Nutzung der App nicht möglich.
        </p>
      </div>

      <div className={s.section}>
        <h2>3. Daten, die nur auf Ihrem Gerät gespeichert werden</h2>
        <p>
          Die App speichert Ihre Finanzdaten – Einnahmen und Ausgaben, Budgets, Schulden, Ziele,
          Abos und Einstellungen – im Speicher Ihres Browsers (IndexedDB) auf Ihrem Gerät.{' '}
          <strong>Wir erhalten diese Daten nicht.</strong> Die Speicherung auf Ihrem Endgerät ist
          für den von Ihnen ausdrücklich gewünschten Dienst unbedingt erforderlich (§ 25 Abs. 2
          Nr. 2 TDDDG).
        </p>
        <div className={s.infoBox}>
          <strong>Hinweis:</strong> Löschen Sie die Browserdaten oder wechseln Sie das Gerät ohne
          Sicherung (und ohne aktivierte Synchronisierung), können die Daten verloren gehen; wir
          können sie nicht wiederherstellen. Eine Sicherung können Sie jederzeit unter
          „Einstellungen“ als JSON-Datei exportieren.
        </div>
        <div className={s.warnBox} style={{ marginTop: 8 }}>
          <strong>Privates Fenster:</strong> In privaten bzw. Inkognito-Fenstern löscht der Browser
          die Daten beim Schließen. Für die regelmäßige Nutzung öffnen Sie die App in einem normalen
          Fenster oder installieren Sie sie („Zum Startbildschirm hinzufügen“).
        </div>
      </div>

      <div className={s.section}>
        <h2>4. Weitere Daten, die wir speichern: Zwecke und Rechtsgrundlagen</h2>
        <p>Neben der E-Mail-Adresse Ihres Kontos speichern wir in unserer Datenbank (Supabase) nur Folgendes:</p>
        <ul className={s.list}>
          <li>
            <strong>Registrierung für Starter:</strong> E-Mail-Adresse, für Hinweise zur Nutzung der
            App (Art. 6 Abs. 1 lit. b DSGVO). Werbliche E-Mails nur mit Ihrer Einwilligung (Art. 6
            Abs. 1 lit. a DSGVO). Jede E-Mail enthält einen Abmeldelink.
          </li>
          <li>
            <strong>Demo-Formular:</strong> Name, E-Mail-Adresse und ob Sie Neuigkeiten erhalten
            möchten. Zugang zur Demo auf Ihre Anfrage (Art. 6 Abs. 1 lit. b DSGVO); Neuigkeiten nur
            mit Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).
          </li>
          <li>
            <strong>Express-Diagnose:</strong> E-Mail-Adresse, erzieltes Ergebnis und ob Sie
            Neuigkeiten erhalten möchten. Zusendung des Ergebnisses (Art. 6 Abs. 1 lit. b DSGVO);
            Neuigkeiten nur mit Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).
          </li>
          <li>
            <strong>Formular für Neuigkeiten auf der Website:</strong> E-Mail-Adresse, mit Ihrer
            Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), übermittelt über Formspree.
          </li>
          <li>
            <strong>Pro-Abo:</strong> E-Mail-Adresse des Kaufs, irreversibler Hash des
            Lizenzschlüssels (nie der Schlüssel im Klartext), Tarif, Aktivierungs- und Ablaufdatum,
            Zahlungsbestätigung. Vertragserfüllung und Prüfung der Berechtigung (Art. 6 Abs. 1
            lit. b DSGVO); gesetzliche Aufbewahrungspflichten (Art. 6 Abs. 1 lit. c DSGVO).
            Kartendaten erhalten wir nicht.
          </li>
          <li>
            <strong>Push-Benachrichtigungen (optional):</strong> technische Push-Adresse (Endpoint)
            Ihres Browsers, verknüpft mit dem Hash Ihrer Lizenz. Versand von Systemhinweisen nur mit
            Ihrer Einwilligung über die Browser-Abfrage (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1
            TDDDG); nie mit Finanzdaten. Widerruf jederzeit über die Browser- oder
            App-Einstellungen.
          </li>
          <li>
            <strong>Kündigung:</strong> Name, E-Mail-Adresse, Vertragsangaben, Art und Zeitpunkt der
            Kündigung, gegebenenfalls Kündigungsgrund. Bearbeitung und Bestätigung der Kündigung
            (Art. 6 Abs. 1 lit. b und c DSGVO i. V. m. § 312k BGB).
          </li>
          <li>
            <strong>Kontakt per E-Mail:</strong> Ihre E-Mail-Adresse und der Inhalt Ihrer Nachricht,
            zur Bearbeitung Ihrer Anfrage (Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO).
          </li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>5. Optionale Synchronisierung</h2>
        <p>
          Aktivieren Sie in den Einstellungen die Synchronisierung zwischen Geräten, werden Ihre
          Daten auf Ihrem Gerät mit <strong>AES-GCM</strong> verschlüsselt, bevor sie übertragen und
          gespeichert werden (Ende-zu-Ende-Verschlüsselung). Der Schlüssel wird auf Ihrem Gerät aus
          Ihrem Lizenzschlüssel abgeleitet und <strong>verlässt Ihr Gerät nicht</strong>. Weder wir
          noch unser Infrastruktur-Dienstleister können den Inhalt lesen. Die Synchronisierung ist
          freiwillig und lässt sich jederzeit in den Einstellungen deaktivieren. Rechtsgrundlage ist
          Art. 6 Abs. 1 lit. b DSGVO.
        </p>
      </div>

      <div className={s.section}>
        <h2>6. Versand von Berichten per E-Mail (Beratermodus)</h2>
        <p>
          Betätigen Sie im Beratermodus die Schaltfläche zum Versand eines PDF-Berichts per E-Mail,
          werden das PDF (mit den darin enthaltenen Finanzdaten) und die Empfängeradresse{' '}
          <strong>ohne Ende-zu-Ende-Verschlüsselung</strong> über unseren Server und unseren
          E-Mail-Dienstleister Resend übertragen, ausschließlich um es zuzustellen. Wir speichern
          den Bericht nicht. Dies geschieht nur auf Ihre ausdrückliche Aktion hin (Art. 6 Abs. 1
          lit. b DSGVO).
        </p>
      </div>

      <div className={s.section}>
        <h2>7. Hosting und Server-Logdaten</h2>
        <p>
          App und Website werden bei Vercel Inc. (USA) gehostet. Beim Aufruf verarbeitet der Hoster
          technisch notwendige Verbindungsdaten (z. B. IP-Adresse, Datum und Uhrzeit, aufgerufene
          Adresse, Browser-Kennung) in Server-Logdateien, um die Anwendung auszuliefern und ihre
          Sicherheit zu gewährleisten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser
          berechtigtes Interesse liegt im sicheren und stabilen Betrieb. Die Logdaten werden nach
          den Fristen des Hosters gelöscht.
        </p>
      </div>

      <div className={s.section}>
        <h2>8. Keine Analyse, kein Tracking, keine Bankverbindung</h2>
        <p>
          Wir setzen keine Analysewerkzeuge, keine Werbenetzwerke und keine Cookies zu Analyse- oder
          Werbezwecken ein. Ereignisse, Sitzungen oder Klicks werden nicht aufgezeichnet. MOY IQ
          verbindet sich nicht mit Ihrem Bankkonto und fragt keine Bankzugangsdaten ab. Für den
          Betrieb nutzt die App ausschließlich den technisch erforderlichen Speicher Ihres Browsers
          (IndexedDB, localStorage).
        </p>
      </div>

      <div className={s.section}>
        <h2>9. Empfänger und Auftragsverarbeiter</h2>
        <p>
          Wir setzen folgende Dienstleister ein. Soweit sie Daten in unserem Auftrag verarbeiten,
          geschieht dies auf Grundlage eines Vertrags zur Auftragsverarbeitung (Art. 28 DSGVO).
        </p>
        <ul className={s.list}>
          <li><strong>Supabase Inc. (USA, Serverstandort Ohio, Region us-east-2):</strong> Datenbank, Authentifizierung, verschlüsselte Synchronisierung, Lizenzprüfung.</li>
          <li>
            <strong>Stripe (USA bzw. Irland, je nach Vertragspartner):</strong> Zahlungsabwicklung.
            Stripe verarbeitet Zahlungsdaten teilweise als eigener Verantwortlicher (z. B. zur
            Betrugsprävention). Wir erhalten nur die Zahlungsbestätigung und die E-Mail-Adresse des
            Kaufs, nie Kartendaten.
          </li>
          <li><strong>Resend (USA):</strong> Versand von E-Mails.</li>
          <li><strong>Vercel Inc. (USA):</strong> Hosting von App und Website.</li>
          <li><strong>Formspree Inc. (USA):</strong> Entgegennahme von Website-Formularen.</li>
          <li><strong>Google (Google Ireland Ltd. / Google LLC):</strong> Anmeldung mit Google, nur wenn Sie diese wählen.</li>
        </ul>
        <p>
          Keiner dieser Dienstleister hat Zugriff auf die Finanzdaten auf Ihrem Gerät. Eine
          Weitergabe Ihrer Daten zu Werbezwecken oder ein Verkauf an Dritte findet nicht statt.
        </p>
      </div>

      <div className={s.section}>
        <h2>10. Datenverarbeitung in den USA (Drittlandübermittlung)</h2>
        <p>
          Wir sind ein Unternehmen mit Sitz in den USA; Ihre Daten werden daher von uns selbst und
          von den oben genannten Dienstleistern in den USA verarbeitet. Für die USA besteht ein
          Angemessenheitsbeschluss der EU-Kommission (EU-US Data Privacy Framework, Art. 45 DSGVO),
          soweit der jeweilige Empfänger danach zertifiziert ist. Soweit keine Zertifizierung
          besteht, erfolgt die Übermittlung auf Grundlage der EU-Standardvertragsklauseln (Art. 46
          Abs. 2 lit. c DSGVO). Auf Anfrage stellen wir Ihnen Informationen zu den jeweiligen
          Garantien zur Verfügung.
        </p>
      </div>

      <div className={s.section}>
        <h2>11. Speicherdauer</h2>
        <ul className={s.list}>
          <li>Kontodaten: bis zur Löschung Ihres Kontos.</li>
          <li>E-Mail-Adressen für Neuigkeiten: bis zu Ihrer Abmeldung oder dem Widerruf Ihrer Einwilligung.</li>
          <li>
            Pro-Daten (Lizenz-Hash, Tarif, Zeiträume, Zahlungsnachweise): für die Dauer des Vertrags
            und darüber hinaus, soweit gesetzliche Aufbewahrungspflichten bestehen.
          </li>
          <li>Verschlüsselte Synchronisierungsdaten: bis zur Deaktivierung der Synchronisierung oder Löschung Ihres Kontos.</li>
          <li>Push-Adresse: bis zum Widerruf der Einwilligung oder bis sie ungültig wird.</li>
          <li>Kündigungserklärungen: drei Jahre ab Ende des Jahres der Kündigung, zum Nachweis.</li>
          <li>Per E-Mail versandte Berichte: werden von uns nicht gespeichert.</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>12. Ihre Rechte</h2>
        <p>Sie haben nach der DSGVO das Recht auf:</p>
        <ul className={s.list}>
          <li>Auskunft über Ihre gespeicherten Daten (Art. 15 DSGVO)</li>
          <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
          <li>Löschung (Art. 17 DSGVO)</li>
          <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
          <li>Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO)</li>
        </ul>
        <p>
          <strong>Widerspruchsrecht (Art. 21 DSGVO):</strong> Soweit wir Daten auf Grundlage von
          Art. 6 Abs. 1 lit. f DSGVO verarbeiten, können Sie aus Gründen, die sich aus Ihrer
          besonderen Situation ergeben, jederzeit Widerspruch einlegen. Der Verwendung Ihrer Daten
          für Direktwerbung können Sie jederzeit ohne Angabe von Gründen widersprechen; jede E-Mail
          enthält dafür einen Abmeldelink.
        </p>
        <p>Zur Ausübung Ihrer Rechte genügt eine E-Mail an <strong>support@moyiq.app</strong>.</p>
        <p>
          <strong>Beschwerderecht:</strong> Sie haben das Recht, sich bei einer
          Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO), insbesondere in dem
          Mitgliedstaat Ihres gewöhnlichen Aufenthalts, Ihres Arbeitsplatzes oder des mutmaßlichen
          Verstoßes – in Deutschland etwa bei der Datenschutzbehörde Ihres Bundeslandes.
        </p>
      </div>

      <div className={s.section}>
        <h2>13. Keine automatisierte Entscheidungsfindung</h2>
        <p>
          Wir treffen keine ausschließlich automatisierten Entscheidungen im Sinne von Art. 22
          DSGVO. Der IQ Score und die Hinweise in der App werden auf Ihrem Gerät berechnet und
          dienen nur Ihrer Information.
        </p>
      </div>

      <div className={s.section}>
        <h2>14. Minderjährige</h2>
        <p>
          MOY IQ richtet sich nicht an Personen unter 18 Jahren. Wir erheben wissentlich keine
          Daten von Minderjährigen.
        </p>
      </div>

      <div className={s.section}>
        <h2>15. Änderungen</h2>
        <p>
          Wir passen diese Datenschutzerklärung an, wenn sich unsere Datenverarbeitung oder die
          Rechtslage ändert. Es gilt die jeweils hier veröffentlichte Fassung.
        </p>
      </div>

      <div className={s.section}>
        <h2>16. Weitere rechtliche Informationen</h2>
        <p>
          Die deutschen Rechtstexte werden unter moyiq.app/de/ veröffentlicht:{' '}
          {deLegalRef('impressum', 'Impressum')}, {deLegalRef('agb', 'AGB')},{' '}
          {deLegalRef('widerruf', 'Widerrufsbelehrung')} und{' '}
          {deLegalRef('datenschutz', 'Datenschutzerklärung')}.
        </p>
      </div>

    </div>
  )
}

export const PRIVACY_CONTENT = {
  es: { title: 'Política de Privacidad', sub: `${LAST_UPDATED.es} · ${OPERATOR}`, Body: EsBody },
  en: { title: 'Privacy Policy', sub: `${LAST_UPDATED.en} · ${OPERATOR}`, Body: EnBody },
  pt: { title: 'Política de Privacidade', sub: `${LAST_UPDATED.pt} · ${OPERATOR}`, Body: PtBody },
  de: { title: 'Datenschutzerklärung', sub: `${LAST_UPDATED.de} · ${OPERATOR}`, Body: DeBody },
}
