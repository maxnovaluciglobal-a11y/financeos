// src/pages/legal/privacyContent.jsx
// Política de Privacidad — MOY IQ, contenido por idioma (es/en/pt/de).
// Sin hooks ni useT: Privacy.jsx elige el idioma y legal.test.js lo renderiza en node.
// Revisión legal completada 2026-10-08 (investigación con fuentes, sin abogado colegiado).
// Riesgos residuales: sin representante art. 27 RGPD. Double opt-in para emails promocionales: implementado (migración 20261010010000), activo con MARKETING_DOI_ENABLED.
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
        Solo salen del dispositivo si el usuario activa la sincronización (se cifran en el
        dispositivo antes de subirse; ver el punto 5 sobre la llave) o si envía un reporte PDF por
        email. Contamos las aperturas de la app de forma anónima y sin cookies (punto 8), sin
        seguimiento de comportamiento, y la app no se
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
            <strong>Correos de marketing (doble opt-in):</strong> solo si se marca la casilla
            correspondiente y se confirma con el enlace del correo que enviamos; guardamos la fecha y
            hora de la confirmación como prueba del consentimiento.
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
            <strong>Plan Pro:</strong> el email de la compra, un hash de la clave de licencia en el
            registro de licencias, la clave asociada a la cuenta (para reponer el plan al iniciar
            sesión en otro dispositivo), el plan y las fechas de activación y vencimiento.
          </li>
          <li>
            <strong>Notificaciones push (opcional):</strong> el identificador técnico (endpoint)
            del navegador, asociado al hash de la licencia. Las notificaciones contienen solo
            avisos del sistema, nunca datos financieros.
          </li>
          <li>
            <strong>Sincronización (opcional):</strong> la copia cifrada descrita en el punto 5.
          </li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>5. Sincronización entre dispositivos (opcional y cifrada)</h2>
        <p>
          La sincronización viene desactivada. Si el usuario la activa en Ajustes, sus datos se
          cifran en el dispositivo con <strong>AES-GCM</strong> antes de enviarse y se almacenan
          cifrados. Desde el 20 de octubre de 2026, al activarla se crea una frase de paso: la
          llave se deriva de esa frase en el dispositivo (PBKDF2 con 600 000 iteraciones y sal
          aleatoria), la frase no se envía ni se guarda en nuestro servidor y, por eso, no podemos
          leer esa copia ni recuperarla si se olvida la frase. Quien ya sincronizaba antes de esa
          fecha sigue con el modelo anterior hasta que elija pasar a una frase de paso en Ajustes:
          en ese modelo la llave se deriva de la clave de licencia, que nuestro servidor conserva
          mientras exista esa copia, así que para esas copias no podemos asegurar que sea
          técnicamente imposible leerlas; solo las usamos para sincronizar los dispositivos del
          usuario. Para el resto de las cuentas, el servidor guarda solo un hash de la licencia.
          Quien prefiera que sus datos no salgan del dispositivo puede dejar la sincronización
          desactivada. Desactivarla detiene las subidas, pero no borra la copia ya guardada: para
          borrarla, escribir a support@moyiq.app o eliminar la cuenta desde Ajustes.
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
          <li><strong>Vercel:</strong> alojamiento de la app y del sitio web, y estadísticas de uso anónimas (punto 8).</li>
          <li><strong>Formspree:</strong> recibe el formulario de contacto del sitio web.</li>
          <li><strong>Google:</strong> solo si el usuario elige entrar con Google.</li>
        </ul>
        <p>
          Ninguno de estos proveedores accede a los datos financieros guardados en el dispositivo.
          Varios tienen sede en Estados Unidos, por lo que los datos de cuenta y contacto pueden
          procesarse allí. No vendemos datos ni los cedemos a terceros con fines publicitarios.
        </p>
      </div>

      <div className={s.section}>
        <h2>8. Estadísticas de uso, seguimiento y bancos</h2>
        <p>
          Para saber cuántas veces se abre la app usamos <strong>Vercel Web Analytics</strong>, sin
          cookies. Registra la apertura de forma anónima: la dirección de la app sin datos
          personales (solo las etiquetas de campaña utm y ref), el sitio de origen, un país y
          región aproximados, el navegador, el sistema operativo y el tipo de dispositivo. No
          recibe datos financieros, el email ni el identificador de la cuenta, no usa cookies ni
          crea perfiles, y para distinguir visitas del mismo día usa un identificador temporal que
          se descarta a las 24 horas. El encargado es Vercel Inc. (EE. UU.). Base: nuestro interés
          legítimo en conocer, de forma agregada, el uso de la app. No medimos si el navegador
          envía la señal «No rastrear» o Global Privacy Control; también se puede bloquear el
          script o pedirnos la exclusión en support@moyiq.app.
        </p>
        <p>
          MOY IQ no incluye otras herramientas de analítica (Google Analytics, Mixpanel, Hotjar u
          otras) ni seguimiento de comportamiento: no se registran eventos ni clics. La app no se
          conecta con cuentas bancarias y nunca pide credenciales del banco.
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
          La cuenta también se puede eliminar sin escribirnos, desde Ajustes → Eliminar la cuenta
          (o en app.moyiq.app/delete-account). Eso borra al instante la cuenta y lo que el servidor
          guarda de ella en MOY IQ y MOY IQ Invest. Solo se conservan los comprobantes de pago y la
          constancia de una cancelación, como se indica en esta política.
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
          sincronizados se guardan cifrados con una llave derivada de la clave de licencia (ver el
          punto 5 sobre sus límites actuales). Recomendamos exportar respaldos JSON periódicamente y
          guardar la clave de licencia en un lugar seguro.
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
        leaves the device if you turn on sync (it is encrypted on the device before upload; see
        section 5 about the key) or if you email a PDF report. We count app openings anonymously
        and without cookies (section 8), with no behavior tracking, and the app does not connect
        to banks.
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
            <strong>Marketing emails (double opt-in):</strong> only if the matching box is ticked and
            then confirmed through the link in the email we send; we keep the date and time of that
            confirmation as proof of consent.
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
            <strong>Pro plan:</strong> the purchase email, a hash of the license key in the license
            registry, the key linked to the account (to restore the plan when signing in on another
            device), the plan, and the activation and expiration dates.
          </li>
          <li>
            <strong>Push notifications (optional):</strong> the browser's technical identifier
            (endpoint), linked to the license hash. Notifications contain only system notices,
            never financial data.
          </li>
          <li>
            <strong>Sync (optional):</strong> the encrypted copy described in section 5.
          </li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>5. Cross-device sync (optional and encrypted)</h2>
        <p>
          Sync is off by default. If the user turns it on in Settings, their data is encrypted on
          the device with <strong>AES-GCM</strong> before it is sent and is stored encrypted.
          Since October 20, 2026, turning it on creates a passphrase: the key is derived from that
          phrase on the device (PBKDF2 with 600,000 iterations and a random salt), the phrase is
          never sent to or stored on our server and, for that reason, we cannot read that copy or
          recover it if the phrase is forgotten. Users who were already syncing before that date
          keep the previous model until they choose to move to a passphrase in Settings: in that
          model the key is derived from the license key, which our server keeps while that copy
          exists, so for those copies we cannot guarantee that reading them is technically
          impossible; we only use them to sync the user's devices. For all other accounts, the
          server stores only a hash of the license. Anyone who prefers that their data never
          leaves the device can keep sync turned off. Turning it off stops uploads but does not
          delete the copy already stored: to delete it, write to support@moyiq.app or delete the
          account from Settings.
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
          <li><strong>Vercel:</strong> hosting for the app and the website, and anonymous usage statistics (section 8).</li>
          <li><strong>Formspree:</strong> receives the contact form on the website.</li>
          <li><strong>Google:</strong> only if the user chooses to sign in with Google.</li>
        </ul>
        <p>
          None of these providers has access to the financial data stored on the device. Several
          are based in the United States, so account and contact data may be processed there. We
          do not sell data or share it with third parties for advertising.
        </p>
      </div>

      <div className={s.section}>
        <h2>8. Usage statistics, tracking, and banks</h2>
        <p>
          To know how often the app is opened we use <strong>Vercel Web Analytics</strong>, without
          cookies. It records each opening anonymously: the app address without personal data
          (only the utm and ref campaign tags), the referring site, an approximate country and
          region, the browser, the operating system, and the device type. It does not receive
          financial data, the email, or the account identifier, does not use cookies or build
          profiles, and to tell same-day visits apart it uses a temporary identifier discarded after
          24 hours. The processor is Vercel Inc. (USA). Basis: our legitimate interest in knowing,
          in aggregate, how the app is used. We do not measure when the browser sends Do Not Track
          or Global Privacy Control; you can also block the script or ask us to exclude you at
          support@moyiq.app.
        </p>
        <p>
          MOY IQ does not include other analytics tools (Google Analytics, Mixpanel, Hotjar, or
          others) or behavior tracking: no events or clicks are recorded. The app does not connect
          to bank accounts and never asks for bank credentials.
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
          The account can also be deleted without writing to us, from Settings → Delete account
          (or at app.moyiq.app/delete-account). This immediately deletes the account and what the
          server keeps about it in MOY IQ and MOY IQ Invest. Only payment receipts and the record
          of a cancellation are kept, as described in this policy.
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
          Local data depends on the security of the user's device. Synced data is stored encrypted
          with a key derived from the license key (see section 5 about its current limits). We
          recommend exporting JSON backups periodically and keeping the license key somewhere safe.
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
        recebemos. Eles só saem do dispositivo se o usuário ativar a sincronização (são
        criptografados no dispositivo antes do envio; veja o item 5 sobre a chave) ou se enviar um
        relatório PDF por email. Contamos as aberturas do app de forma anônima e sem cookies (item
        8), sem rastreamento de comportamento, e o app não se conecta a bancos.
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
            <strong>Emails de marketing (double opt-in):</strong> só se a caixa correspondente for
            marcada e depois confirmada pelo link do email que enviamos; guardamos a data e a hora
            dessa confirmação como prova do consentimento.
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
            <strong>Plano Pro:</strong> o email da compra, um hash da chave de licença no registro de
            licenças, a chave vinculada à conta (para restaurar o plano ao entrar em outro
            dispositivo), o plano e as datas de ativação e vencimento.
          </li>
          <li>
            <strong>Notificações push (opcional):</strong> o identificador técnico (endpoint) do
            navegador, vinculado ao hash da licença. As notificações contêm apenas avisos do
            sistema, nunca dados financeiros.
          </li>
          <li>
            <strong>Sincronização (opcional):</strong> a cópia criptografada descrita no item 5.
          </li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>5. Sincronização entre dispositivos (opcional e criptografada)</h2>
        <p>
          A sincronização vem desativada. Se o usuário a ativar em Configurações, os dados são
          criptografados no dispositivo com <strong>AES-GCM</strong> antes do envio e armazenados
          criptografados. Desde 20 de outubro de 2026, ao ativá-la se cria uma frase-senha: a chave
          é derivada dessa frase no dispositivo (PBKDF2 com 600.000 iterações e sal aleatório), a
          frase não é enviada nem guardada no nosso servidor e, por isso, não podemos ler essa
          cópia nem recuperá-la se a frase for esquecida. Quem já sincronizava antes dessa data
          continua no modelo anterior até escolher passar para uma frase-senha em Configurações:
          nesse modelo a chave é derivada da chave de licença, que nosso servidor conserva enquanto
          existir essa cópia, então para essas cópias não podemos garantir que seja tecnicamente
          impossível lê-las; só as usamos para sincronizar os dispositivos do usuário. Para as
          demais contas, o servidor guarda apenas um hash da licença. Quem preferir que os dados
          não saiam do dispositivo pode manter a sincronização desativada. Desativá-la interrompe os
          envios, mas não apaga a cópia já armazenada: para apagá-la, escreva para
          support@moyiq.app ou exclua a conta em Configurações.
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
          <li><strong>Vercel:</strong> hospedagem do app e do site, e estatísticas de uso anônimas (item 8).</li>
          <li><strong>Formspree:</strong> recebe o formulário de contato do site.</li>
          <li><strong>Google:</strong> apenas se o usuário escolher entrar com o Google.</li>
        </ul>
        <p>
          Nenhum desses fornecedores acessa os dados financeiros armazenados no dispositivo. Vários
          têm sede nos Estados Unidos, por isso os dados de conta e contato podem ser processados
          lá. Não vendemos dados nem os compartilhamos com terceiros para fins publicitários.
        </p>
      </div>

      <div className={s.section}>
        <h2>8. Estatísticas de uso, rastreamento e bancos</h2>
        <p>
          Para saber quantas vezes o app é aberto usamos o <strong>Vercel Web Analytics</strong>,
          sem cookies. Ele registra cada abertura de forma anônima: o endereço do app sem dados
          pessoais (apenas as etiquetas de campanha utm e ref), o site de origem, um país e região
          aproximados, o navegador, o sistema operacional e o tipo de dispositivo. Não recebe dados
          financeiros, o email nem o identificador da conta, não usa cookies nem cria perfis e,
          para distinguir visitas do mesmo dia, usa um identificador temporário descartado após 24
          horas. O operador é a Vercel Inc. (EUA). Base: nosso interesse legítimo em conhecer, de
          forma agregada, o uso do app. Não medimos quando o navegador envia «Não rastrear» ou
          Global Privacy Control; também é possível bloquear o script ou pedir a exclusão em
          support@moyiq.app.
        </p>
        <p>
          O MOY IQ não inclui outras ferramentas de analytics (Google Analytics, Mixpanel, Hotjar
          ou outras) nem rastreamento de comportamento: não são registrados eventos nem cliques. O
          app não se conecta a contas bancárias e nunca pede credenciais do banco.
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
          A conta também pode ser excluída sem nos escrever, em Ajustes → Excluir a conta (ou em
          app.moyiq.app/delete-account). Isso apaga na hora a conta e o que o servidor guarda dela
          no MOY IQ e no MOY IQ Invest. Ficam apenas os comprovantes de pagamento e o registro de
          um cancelamento, como indica esta política.
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
          são armazenados criptografados com uma chave derivada da chave de licença (veja o item 5
          sobre seus limites atuais). Recomendamos exportar backups JSON periodicamente e guardar
          a chave de licença em local seguro.
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
        nicht. Sie verlassen das Gerät nur, wenn Sie die Synchronisierung aktivieren (dann vor dem
        Hochladen auf dem Gerät verschlüsselt; zum Schlüssel siehe Abschnitt 5) oder einen
        PDF-Bericht per E-Mail versenden. App-Aufrufe zählen wir anonym und ohne Cookies
        (Abschnitt 8), ohne Verhaltens-Tracking, und die App verbindet sich nicht mit Ihrer Bank.
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
            <strong>Werbliche E-Mails (Double-Opt-in):</strong> nur, wenn Sie das entsprechende
            Kästchen ankreuzen und über den Link in unserer E-Mail bestätigen; Datum und Uhrzeit der
            Bestätigung speichern wir als Nachweis Ihrer Einwilligung (Art. 7 Abs. 1 DSGVO).
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
            <strong>Pro-Abo:</strong> E-Mail-Adresse des Kaufs, Hash des Lizenzschlüssels im
            Lizenzregister, der mit dem Konto verknüpfte Schlüssel (um den Tarif bei der Anmeldung
            auf einem anderen Gerät wiederherzustellen), Tarif, Aktivierungs- und Ablaufdatum,
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
          Die Synchronisierung ist standardmäßig ausgeschaltet. Aktivieren Sie sie in den
          Einstellungen, werden Ihre Daten auf Ihrem Gerät mit <strong>AES-GCM</strong>
          verschlüsselt, bevor sie übertragen und verschlüsselt gespeichert werden. Seit dem
          20. Oktober 2026 erstellen Sie beim Aktivieren eine Passphrase: Der Schlüssel wird auf
          Ihrem Gerät aus dieser Phrase abgeleitet (PBKDF2 mit 600.000 Iterationen und zufälligem
          Salt), die Phrase wird weder an unseren Server gesendet noch dort gespeichert, und
          deshalb können wir diese Kopie weder lesen noch wiederherstellen, wenn Sie die Phrase
          vergessen. Wer schon vor diesem Datum synchronisiert hat, behält das bisherige Modell,
          bis er in den Einstellungen zu einer Passphrase wechselt: Dort wird der Schlüssel aus dem
          Lizenzschlüssel abgeleitet, den unser Server aufbewahrt, solange diese Kopie besteht;
          für diese Kopien können wir daher nicht zusichern, dass ein Lesen technisch unmöglich
          ist, und wir nutzen sie ausschließlich zur Synchronisierung Ihrer Geräte. Für alle
          anderen Konten speichert der Server nur einen Hash der Lizenz. Wenn Ihre Daten das Gerät
          nicht verlassen sollen, lassen Sie die Synchronisierung ausgeschaltet. Das Ausschalten
          stoppt neue Uploads, löscht aber die bereits gespeicherte Kopie nicht; zur Löschung
          schreiben Sie an support@moyiq.app oder löschen Sie das Konto in den Einstellungen.
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
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
        <h2>8. Nutzungsstatistik, kein Tracking, keine Bankverbindung</h2>
        <p>
          Um zu wissen, wie oft die App geöffnet wird, nutzen wir <strong>Vercel Web
          Analytics</strong> ohne Cookies. Erfasst wird jeder Aufruf anonym: die App-Adresse ohne
          personenbezogene Daten (nur die Kampagnenparameter utm und ref), die verweisende Website,
          ungefähres Land und Region, Browser, Betriebssystem und Gerätetyp. Finanzdaten,
          E-Mail-Adresse und Konto-Kennung werden nicht übermittelt; es werden keine Cookies gesetzt
          und keine Profile gebildet. Zur Unterscheidung von Aufrufen desselben Tages dient eine
          temporäre Kennung, die nach 24 Stunden verworfen wird. Auftragsverarbeiter ist Vercel Inc.
          (USA). Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse liegt
          darin, die Nutzung der App in zusammengefasster Form zu kennen. Sendet Ihr Browser „Do Not
          Track" oder Global Privacy Control, messen wir nicht; Sie können das Skript auch blockieren
          oder uns unter support@moyiq.app um Ausschluss bitten.
        </p>
        <p>
          Darüber hinaus setzen wir keine Analysewerkzeuge, keine Werbenetzwerke und keine Cookies
          zu Analyse- oder Werbezwecken ein. Ereignisse oder Klicks werden nicht aufgezeichnet. MOY IQ
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
          <li><strong>Vercel Inc. (USA):</strong> Hosting von App und Website sowie anonyme Nutzungsstatistik (Abschnitt 8).</li>
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
          <li>
            Kontodaten: bis zur Löschung Ihres Kontos. Sie können das Konto jederzeit selbst unter
            Einstellungen → Konto löschen (oder unter app.moyiq.app/delete-account) löschen; die beim
            Server gespeicherten Daten in MOY IQ und MOY IQ Invest werden dabei sofort gelöscht.
          </li>
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
