// src/pages/legal/Privacy.jsx
// Política de Privacidad — MOY IQ (es/en/pt, seleccionada por settings.language)
// AVISO: Este texto fue redactado como punto de partida.
// Debe ser revisado por un abogado antes de uso comercial definitivo.
// ACTUALIZADO 2026-07: refleja las funciones opcionales de sync cifrado E2E,
// validación de licencia y notificaciones push (el texto anterior decía "sin nube",
// lo cual quedó impreciso desde v1.5).

import { PageHeader } from '../../components/ui/index.jsx'
import { useT } from '../../i18n/useT.js'
import s from './legal.module.css'

function EsContent() {
  return (
    <>
      <PageHeader title="Política de Privacidad" sub="Última actualización: julio 2026 · MAXNOVA & LUCI Global LLC" />
      <div className={s.legalWrap}>
        <div className={s.highlight}>
          <strong>Resumen ejecutivo:</strong> Tus datos financieros viven en tu dispositivo.
          MOY IQ no puede leerlos: si activas la sincronización opcional, viajan y se
          almacenan <strong>cifrados de extremo a extremo</strong> con una llave que solo tú tienes.
          No hay cuentas de usuario, no hay tracking, no conectas tu banco.
        </div>

        <div className={s.section}>
          <h2>1. Quién opera esta herramienta</h2>
          <p>
            MOY IQ es desarrollado y distribuido por MAXNOVA & LUCI Global LLC. Esta política describe
            cómo funciona el almacenamiento de datos dentro de la herramienta y qué información,
            si alguna, puede ser recopilada en relación con su uso.
          </p>
        </div>

        <div className={s.section}>
          <h2>2. Datos financieros — almacenamiento local</h2>
          <p>
            Todos los datos financieros que el usuario ingresa en MOY IQ — ingresos, gastos,
            presupuestos, deudas, metas, propiedades y configuraciones — se almacenan en el
            navegador del dispositivo del usuario mediante IndexedDB, un estándar de
            almacenamiento local. Por defecto, <strong>no se transmiten a ningún servidor</strong> y
            no son accesibles por MAXNOVA & LUCI Global LLC ni por terceros.
          </p>
          <div className={s.infoBox}>
            <strong>Implicación práctica:</strong> Si el usuario borra los datos del navegador,
            desinstala la app o cambia de dispositivo sin haber exportado un respaldo (o sin
            tener el sync activo), sus datos se perderán de forma permanente.
          </div>
          <div className={s.warnBox} style={{ marginTop: 8 }}>
            <strong>Atención — modo incógnito o privado:</strong> En ventanas de incógnito los
            datos se borran automáticamente al cerrar la sesión. Para uso regular, accede desde
            una ventana normal o desde la app instalada (Agregar a pantalla de inicio).
          </div>
        </div>

        <div className={s.section}>
          <h2>3. Sincronización entre dispositivos (opcional, cifrada de extremo a extremo)</h2>
          <p>
            Si el usuario activa la sincronización en Ajustes, sus datos se almacenan en los
            servidores de MOY IQ <strong>únicamente en forma cifrada</strong> (AES-GCM). La llave
            de cifrado se deriva de la clave de licencia del usuario y <strong>nunca se envía al
            servidor</strong>: ni MAXNOVA & LUCI Global LLC ni el proveedor de infraestructura pueden
            descifrar ni leer el contenido. La sincronización es estrictamente opt-in y puede
            desactivarse en cualquier momento desde Ajustes.
          </p>
        </div>

        <div className={s.section}>
          <h2>4. Datos de licencia, email y notificaciones</h2>
          <p>
            Para validar el acceso, MOY IQ almacena en sus servidores un <strong>hash
            irreversible</strong> de la clave de licencia (nunca la clave en texto plano), el plan
            adquirido y las fechas de activación/vencimiento. El usuario puede asociar
            opcionalmente un email a su licencia, usado solo para avisos de vencimiento y soporte.
          </p>
          <p>
            Si el usuario activa las notificaciones push, se almacena la suscripción técnica del
            navegador (endpoint) asociada a su licencia. Las notificaciones contienen únicamente
            recordatorios de sistema (por ejemplo, vencimiento de la prueba) —{' '}
            <strong>nunca datos financieros</strong>, que el servidor no puede leer.
          </p>
        </div>

        <div className={s.section}>
          <h2>5. Datos de uso y analítica</h2>
          <p>
            MOY IQ <strong>no incluye</strong> Google Analytics, Mixpanel, Hotjar ni ningún
            sistema de seguimiento de comportamiento. No se registran eventos, sesiones, clics
            ni patrones de uso.
          </p>
          <p>
            La plataforma de hosting puede registrar datos técnicos estándar (direcciones IP,
            tiempos de carga) a efectos de operación, gestionados según sus propias políticas
            de privacidad.
          </p>
        </div>

        <div className={s.section}>
          <h2>6. Cookies y almacenamiento del navegador</h2>
          <p>
            MOY IQ utiliza IndexedDB y localStorage para persistir los datos localmente.
            No utiliza cookies de seguimiento ni de terceros. El único almacenamiento usado
            es el estrictamente necesario para el funcionamiento de la aplicación.
          </p>
        </div>

        <div className={s.section}>
          <h2>7. Exportación e importación de datos</h2>
          <p>
            El usuario puede exportar todos sus datos en formato JSON o CSV desde Ajustes.
            La exportación queda bajo su control exclusivo — MOY IQ no recibe copia.
            La importación de respaldos ocurre íntegramente en el dispositivo.
          </p>
        </div>

        <div className={s.section}>
          <h2>8. Seguridad</h2>
          <p>
            Los datos locales dependen de la seguridad del dispositivo del usuario. Los datos
            sincronizados están cifrados de extremo a extremo: una filtración del servidor no
            expondría contenido legible. Recomendamos exportar respaldos JSON periódicamente y
            guardar la clave de licencia en un lugar seguro (es también la llave del cifrado).
          </p>
        </div>

        <div className={s.section}>
          <h2>9. Menores de edad</h2>
          <p>
            MOY IQ no está dirigido a menores de 18 años. No recopilamos intencionalmente
            información de menores. Si un menor utiliza la herramienta bajo supervisión de un
            adulto, la responsabilidad recae en ese adulto.
          </p>
        </div>

        <div className={s.section}>
          <h2>10. Cambios a esta política</h2>
          <p>
            MAXNOVA & LUCI Global LLC puede actualizar esta política en cualquier momento. Los cambios
            se publicarán en esta página con la fecha de actualización. El uso continuado de la
            herramienta implica aceptación de la política vigente.
          </p>
        </div>

        <div className={s.section}>
          <h2>11. Contacto</h2>
          <p>Para consultas relacionadas con privacidad: <strong>support@moyiq.app</strong></p>
        </div>

        <div className={s.legalNotice}>
          ⚠ Este documento fue redactado como punto de partida informativo. No constituye
          asesoría legal. Se recomienda revisión por un abogado especializado antes de uso
          comercial definitivo, especialmente para jurisdicciones con regulaciones específicas
          de protección de datos (GDPR, LGPD, etc.).
        </div>
      </div>
    </>
  )
}

function EnContent() {
  return (
    <>
      <PageHeader title="Privacy Policy" sub="Last updated: July 2026 · MAXNOVA & LUCI Global LLC" />
      <div className={s.legalWrap}>
        <div className={s.highlight}>
          <strong>Executive summary:</strong> Your financial data lives on your device.
          MOY IQ cannot read it: if you enable the optional sync, it travels and is stored{' '}
          <strong>end-to-end encrypted</strong> with a key only you hold. There are no user
          accounts, no tracking, and you never connect your bank.
        </div>

        <div className={s.section}>
          <h2>1. Who operates this tool</h2>
          <p>
            MOY IQ is developed and distributed by MAXNOVA & LUCI Global LLC. This policy describes
            how data storage works inside the tool and what information, if any, may be collected
            in connection with its use.
          </p>
        </div>

        <div className={s.section}>
          <h2>2. Financial data — local storage</h2>
          <p>
            All financial data the user enters in MOY IQ — income, expenses, budgets, debts,
            goals, properties, and settings — is stored in the browser of the user's device using
            IndexedDB, a local storage standard. By default it is{' '}
            <strong>not transmitted to any server</strong> and is not accessible to
            MAXNOVA & LUCI Global LLC or any third party.
          </p>
          <div className={s.infoBox}>
            <strong>Practical implication:</strong> If the user clears browser data, uninstalls
            the app, or switches devices without exporting a backup (or without sync enabled),
            their data will be permanently lost.
          </div>
          <div className={s.warnBox} style={{ marginTop: 8 }}>
            <strong>Note — incognito or private mode:</strong> In incognito windows, data is
            automatically erased when the session closes. For regular use, access from a normal
            window or from the installed app (Add to Home Screen).
          </div>
        </div>

        <div className={s.section}>
          <h2>3. Cross-device sync (optional, end-to-end encrypted)</h2>
          <p>
            If the user enables sync in Settings, their data is stored on MOY IQ servers{' '}
            <strong>only in encrypted form</strong> (AES-GCM). The encryption key is derived from
            the user's license key and <strong>is never sent to the server</strong>: neither
            MAXNOVA & LUCI Global LLC nor the infrastructure provider can decrypt or read the
            content. Sync is strictly opt-in and can be disabled at any time from Settings.
          </p>
        </div>

        <div className={s.section}>
          <h2>4. License data, email, and notifications</h2>
          <p>
            To validate access, MOY IQ stores on its servers an <strong>irreversible hash</strong>{' '}
            of the license key (never the plain-text key), the purchased plan, and
            activation/expiration dates. The user may optionally associate an email with their
            license, used only for expiration notices and support.
          </p>
          <p>
            If the user enables push notifications, the browser's technical subscription
            (endpoint) is stored, tied to their license. Notifications contain only system
            reminders (e.g., trial expiration) — <strong>never financial data</strong>, which the
            server cannot read.
          </p>
        </div>

        <div className={s.section}>
          <h2>5. Usage data and analytics</h2>
          <p>
            MOY IQ <strong>does not include</strong> Google Analytics, Mixpanel, Hotjar, or any
            behavior-tracking system. No events, sessions, clicks, or usage patterns are recorded.
          </p>
          <p>
            The hosting platform may log standard technical data (IP addresses, load times) for
            operational purposes, managed under its own privacy policies.
          </p>
        </div>

        <div className={s.section}>
          <h2>6. Cookies and browser storage</h2>
          <p>
            MOY IQ uses IndexedDB and localStorage to persist data locally. It does not use
            tracking or third-party cookies. The only storage used is strictly what the
            application needs to function.
          </p>
        </div>

        <div className={s.section}>
          <h2>7. Data export and import</h2>
          <p>
            The user can export all their data in JSON or CSV format from Settings. The export
            remains under their exclusive control — MOY IQ receives no copy. Backup imports
            happen entirely on the device.
          </p>
        </div>

        <div className={s.section}>
          <h2>8. Security</h2>
          <p>
            Local data depends on the security of the user's device. Synced data is end-to-end
            encrypted: a server breach would not expose readable content. We recommend exporting
            JSON backups periodically and keeping the license key somewhere safe (it is also the
            encryption key).
          </p>
        </div>

        <div className={s.section}>
          <h2>9. Minors</h2>
          <p>
            MOY IQ is not directed at people under 18. We do not knowingly collect information
            from minors. If a minor uses the tool under adult supervision, responsibility rests
            with that adult.
          </p>
        </div>

        <div className={s.section}>
          <h2>10. Changes to this policy</h2>
          <p>
            MAXNOVA & LUCI Global LLC may update this policy at any time. Changes will be published
            on this page with the update date. Continued use of the tool implies acceptance of the
            current policy.
          </p>
        </div>

        <div className={s.section}>
          <h2>11. Contact</h2>
          <p>For privacy-related inquiries: <strong>support@moyiq.app</strong></p>
        </div>

        <div className={s.legalNotice}>
          ⚠ This document was drafted as an informational starting point. It does not constitute
          legal advice. Review by a specialized attorney is recommended before definitive
          commercial use, especially for jurisdictions with specific data-protection regulations
          (GDPR, LGPD, etc.).
        </div>
      </div>
    </>
  )
}

function PtContent() {
  return (
    <>
      <PageHeader title="Política de Privacidade" sub="Última atualização: julho 2026 · MAXNOVA & LUCI Global LLC" />
      <div className={s.legalWrap}>
        <div className={s.highlight}>
          <strong>Resumo executivo:</strong> Seus dados financeiros vivem no seu dispositivo.
          O MOY IQ não pode lê-los: se você ativar a sincronização opcional, eles viajam e são
          armazenados <strong>criptografados de ponta a ponta</strong> com uma chave que só você
          tem. Não há contas de usuário, não há rastreamento, você não conecta seu banco.
        </div>

        <div className={s.section}>
          <h2>1. Quem opera esta ferramenta</h2>
          <p>
            O MOY IQ é desenvolvido e distribuído pela MAXNOVA & LUCI Global LLC. Esta política
            descreve como funciona o armazenamento de dados dentro da ferramenta e que
            informações, se houver, podem ser recolhidas em relação ao seu uso.
          </p>
        </div>

        <div className={s.section}>
          <h2>2. Dados financeiros — armazenamento local</h2>
          <p>
            Todos os dados financeiros que o usuário insere no MOY IQ — receitas, despesas,
            orçamentos, dívidas, metas, propriedades e configurações — são armazenados no
            navegador do dispositivo do usuário via IndexedDB, um padrão de armazenamento local.
            Por padrão, <strong>não são transmitidos a nenhum servidor</strong> e não são
            acessíveis pela MAXNOVA & LUCI Global LLC nem por terceiros.
          </p>
          <div className={s.infoBox}>
            <strong>Implicação prática:</strong> Se o usuário apagar os dados do navegador,
            desinstalar o app ou trocar de dispositivo sem ter exportado um backup (ou sem a
            sincronização ativa), seus dados serão perdidos permanentemente.
          </div>
          <div className={s.warnBox} style={{ marginTop: 8 }}>
            <strong>Atenção — modo anônimo ou privado:</strong> Em janelas anônimas, os dados são
            apagados automaticamente ao fechar a sessão. Para uso regular, acesse por uma janela
            normal ou pelo app instalado (Adicionar à tela inicial).
          </div>
        </div>

        <div className={s.section}>
          <h2>3. Sincronização entre dispositivos (opcional, criptografada de ponta a ponta)</h2>
          <p>
            Se o usuário ativar a sincronização em Configurações, seus dados são armazenados nos
            servidores do MOY IQ <strong>apenas em forma criptografada</strong> (AES-GCM). A
            chave de criptografia é derivada da chave de licença do usuário e{' '}
            <strong>nunca é enviada ao servidor</strong>: nem a MAXNOVA & LUCI Global LLC nem o
            provedor de infraestrutura podem descriptografar ou ler o conteúdo. A sincronização é
            estritamente opt-in e pode ser desativada a qualquer momento em Configurações.
          </p>
        </div>

        <div className={s.section}>
          <h2>4. Dados de licença, email e notificações</h2>
          <p>
            Para validar o acesso, o MOY IQ armazena em seus servidores um{' '}
            <strong>hash irreversível</strong> da chave de licença (nunca a chave em texto plano),
            o plano adquirido e as datas de ativação/vencimento. O usuário pode associar
            opcionalmente um email à sua licença, usado apenas para avisos de vencimento e suporte.
          </p>
          <p>
            Se o usuário ativar as notificações push, é armazenada a assinatura técnica do
            navegador (endpoint) associada à sua licença. As notificações contêm apenas
            lembretes de sistema (por exemplo, vencimento do período de teste) —{' '}
            <strong>nunca dados financeiros</strong>, que o servidor não pode ler.
          </p>
        </div>

        <div className={s.section}>
          <h2>5. Dados de uso e analytics</h2>
          <p>
            O MOY IQ <strong>não inclui</strong> Google Analytics, Mixpanel, Hotjar nem nenhum
            sistema de rastreamento de comportamento. Não são registrados eventos, sessões,
            cliques nem padrões de uso.
          </p>
          <p>
            A plataforma de hosting pode registrar dados técnicos padrão (endereços IP, tempos de
            carregamento) para fins operacionais, geridos segundo suas próprias políticas de
            privacidade.
          </p>
        </div>

        <div className={s.section}>
          <h2>6. Cookies e armazenamento do navegador</h2>
          <p>
            O MOY IQ usa IndexedDB e localStorage para persistir os dados localmente. Não usa
            cookies de rastreamento nem de terceiros. O único armazenamento usado é o estritamente
            necessário para o funcionamento da aplicação.
          </p>
        </div>

        <div className={s.section}>
          <h2>7. Exportação e importação de dados</h2>
          <p>
            O usuário pode exportar todos os seus dados em formato JSON ou CSV a partir de
            Configurações. A exportação fica sob seu controle exclusivo — o MOY IQ não recebe
            cópia. A importação de backups ocorre integralmente no dispositivo.
          </p>
        </div>

        <div className={s.section}>
          <h2>8. Segurança</h2>
          <p>
            Os dados locais dependem da segurança do dispositivo do usuário. Os dados
            sincronizados são criptografados de ponta a ponta: uma violação do servidor não
            exporia conteúdo legível. Recomendamos exportar backups JSON periodicamente e guardar
            a chave de licença em local seguro (ela também é a chave da criptografia).
          </p>
        </div>

        <div className={s.section}>
          <h2>9. Menores de idade</h2>
          <p>
            O MOY IQ não é dirigido a menores de 18 anos. Não recolhemos intencionalmente
            informações de menores. Se um menor usar a ferramenta sob supervisão de um adulto, a
            responsabilidade recai sobre esse adulto.
          </p>
        </div>

        <div className={s.section}>
          <h2>10. Alterações a esta política</h2>
          <p>
            A MAXNOVA & LUCI Global LLC pode atualizar esta política a qualquer momento. As
            alterações serão publicadas nesta página com a data de atualização. O uso continuado
            da ferramenta implica aceitação da política vigente.
          </p>
        </div>

        <div className={s.section}>
          <h2>11. Contato</h2>
          <p>Para questões relacionadas com privacidade: <strong>support@moyiq.app</strong></p>
        </div>

        <div className={s.legalNotice}>
          ⚠ Este documento foi redigido como ponto de partida informativo. Não constitui
          aconselhamento jurídico. Recomenda-se revisão por um advogado especializado antes de uso
          comercial definitivo, especialmente em jurisdições com regulações específicas de
          proteção de dados (RGPD, LGPD, etc.).
        </div>
      </div>
    </>
  )
}

export default function Privacy() {
  const { lang } = useT()
  const Content = lang === 'en' ? EnContent : lang === 'pt' ? PtContent : EsContent
  return <div className="stack"><Content /></div>
}
