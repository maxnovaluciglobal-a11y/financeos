// src/pages/legal/privacyContent.jsx
// Política de Privacidad — moyiq, contenido por idioma (es/en/pt/de).
// Sin hooks ni useT: Privacy.jsx elige el idioma y legal.test.js lo renderiza en node.
// Revisión legal completada 2026-10-08 (investigación con fuentes, sin abogado colegiado).
// Riesgos residuales: sin representante art. 27 RGPD. Double opt-in para emails promocionales: implementado (migración 20261010010000), activo con MARKETING_DOI_ENABLED.
// ACTUALIZADO 2026-10: la app exige cuenta (email/Google); se listan los datos que
// sí guardamos (Supabase), los proveedores y el envío de reportes PDF del Modo
// Asesor, que pasa sin cifrado de extremo a extremo por el servidor y Resend.
// ACTUALIZADO 2026-11-19 (auditoría 360, LEG-N1/LEG-N2/LEG-N8/SEC-N7): alineada con
// ../financeos-landing/privacy.html. Sin Formspree (no se usa); con Cloudflare
// (Turnstile), Google (bandeja de soporte), mindicador.cl y dolarapi.com (los mismos
// orígenes de la CSP de vercel.json, ver legal.test.js), Inversiones (posiciones en
// el servidor y perfil de inversionista en user_metadata), comentarios y NPS, clics
// de Resend, la cancelación en Stripe al borrar la cuenta (automática, con respaldo
// manual) y los apartados de Chile (Ley 21.719) y Brasil (LGPD).

// vitest.config.js no carga el plugin de React: el JSX se transforma con el runtime
// clásico (React.createElement), así que React tiene que estar en scope.
import React from 'react'
import s from './legal.module.css'
import { LAST_UPDATED, OPERATOR } from './legalMeta.js'
import { deLegalRef } from './deLegal.js'
import { CompanyBlock, withRebrandNotice } from './companyBlock.jsx'

function EsBody() {
  return (
    <div className={s.legalWrap}>
      <div className={s.highlight}>
        <strong>Resumen:</strong> Para usar moyiq se necesita una cuenta gratuita, asociada a un
        email. Los datos financieros del usuario se guardan en su dispositivo y no los recibimos.
        Solo salen del dispositivo si el usuario activa la sincronización (se cifran en el
        dispositivo antes de subirse; ver el punto 5 sobre la llave) o si envía un reporte PDF por
        email. Las posiciones de Inversiones, si se usa esa sección, se guardan en nuestro servidor
        (punto 4). Contamos las aperturas de la app de forma anónima y sin cookies (punto 8), sin
        seguimiento de comportamiento, y la app no se
        conecta con bancos.
      </div>

      <div className={s.section}>
        <h2>1. Quién opera moyiq</h2>
        <p>
          Moyiq es desarrollado y distribuido por MAXNOVA & LUCI Global LLC. Esta política explica
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
        <p>
          <strong>Registro automático.</strong> Si usas <em>Dictar</em>, el reconocimiento de voz lo hace
          el sistema de tu teléfono o navegador (Apple en iPhone y Safari, Google en Android y Chrome), que
          puede enviar el audio a sus servidores para transcribirlo según sus propias políticas. moyiq recibe
          solo el texto, lo interpreta en tu dispositivo y no guarda audio; el micrófono se usa solo mientras
          dictas. Si configuras el Atajo de iPhone para Apple Pay, iOS le pasa a moyiq el monto y el comercio
          del pago al abrir la app: ese dato se guarda solo en tu dispositivo, y moyiq no se conecta a tu
          banco, a tu tarjeta ni a Apple Pay.
        </p>
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
            <strong>Plan Pro:</strong> el email de la compra, la cuenta a la que está asociado, un
            hash irreversible de la clave de licencia (la clave misma solo si el usuario sincroniza
            con el modelo anterior; ver el punto 5), el plan y las fechas de activación y
            vencimiento.
          </li>
          <li>
            <strong>Notificaciones push (opcional):</strong> el identificador técnico (endpoint)
            del navegador, asociado al hash de la licencia. Las notificaciones contienen solo
            avisos del sistema, nunca datos financieros.
          </li>
          <li>
            <strong>Sincronización (opcional):</strong> la copia cifrada descrita en el punto 5.
          </li>
          <li>
            <strong>Inversiones (opcional, apagado por defecto):</strong> las posiciones de inversión
            que registras en moyiq · Inversiones (invest.moyiq.app) se guardan en nuestro servidor,
            asociadas a tu cuenta, para que puedas verlas en cualquier dispositivo. Si activas el
            módulo en Más › Ajustes › Funciones, la app lee esas posiciones y envía a la API de
            Inversiones solo los símbolos, para obtener las cotizaciones. Tus movimientos siguen en tu
            dispositivo. Base: ejecución de lo que pides.
          </li>
          <li>
            <strong>Perfil de inversionista (solo si abres Inversiones en la app):</strong> tus
            respuestas a las 3 preguntas del cuestionario (experiencia, horizonte y qué harías ante una
            caída) y la fecha y hora, tomadas de tu dispositivo, en que aceptaste el aviso de que es una
            herramienta educativa. Se guardan en tu cuenta (servicio de autenticación de Supabase) para
            no pedírtelas en cada dispositivo. Solo sirven para habilitar la sección: cualquier
            respuesta la habilita, no cambian lo que ves y no las usamos para recomendarte inversiones
            ni para publicidad. Base: ejecución de lo que pides. Se borran al eliminar la cuenta y se
            incluyen si pides acceso a tus datos o su portabilidad.
          </li>
          <li>
            <strong>Comentarios y encuesta (NPS):</strong> si nos escribes desde la app o respondes la
            encuesta, recibimos tu mensaje, tu puntaje, el correo de tu cuenta, la versión de la app,
            el idioma, el país y el plan y, solo si lo marcas, un registro técnico de errores en el que
            los números se reemplazan por «#». Nos llega por correo (Resend) a nuestra bandeja de
            soporte (Google) para responderte. En la base guardamos solo la fecha de cada envío, para
            limitar la cantidad (los envíos de comentarios, 30 días; la encuesta, que respondiste, hasta
            que elimines la cuenta). Base: tu solicitud.
          </li>
          <li>
            <strong>Cancelaciones y consultas:</strong> los datos que nos envías al cancelar en línea o
            escribir a soporte, para tramitarlos y poder probar que los recibimos.
          </li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>5. Sincronización entre dispositivos (opcional y cifrada)</h2>
        <p>
          La sincronización viene desactivada. Si el usuario la activa en Ajustes, sus datos se
          cifran en el dispositivo con <strong>AES-GCM</strong> antes de enviarse y se almacenan
          cifrados. Desde el 19 de octubre de 2026, al activarla se crea una frase de paso: la
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
          <li><strong>Supabase (EE. UU.):</strong> base de datos, autenticación (incluido el perfil de inversionista), sincronización cifrada, validación de licencias y las posiciones de Inversiones (servidores en Ohio, EE. UU., región us-east-2).</li>
          <li>
            <strong>Stripe (EE. UU.):</strong> pagos, facturación y portal de clientes para gestionar o
            cancelar la suscripción. Nunca vemos los datos de la tarjeta; recibimos solo la
            confirmación del pago y el email asociado a la compra.
          </li>
          <li><strong>Resend (EE. UU.):</strong> envío de correos, lista de los newsletters y medición de clics en los enlaces de los correos (punto 8).</li>
          <li><strong>Vercel (EE. UU.):</strong> alojamiento de la app y del sitio web, y estadísticas de uso anónimas (punto 8).</li>
          <li>
            <strong>Cloudflare (EE. UU.):</strong> DNS del dominio, reenvío de los correos que escribes
            a nuestras direcciones @moyiq.app y Turnstile, la verificación que comprueba que no eres un
            robot al entrar a la app, al registrarte y al enviar comentarios. Turnstile recibe tu
            dirección IP y datos técnicos de tu navegador. Cloudflare actúa como encargado y, para
            mejorar esa detección de robots, como responsable propio.
          </li>
          <li><strong>Google (EE. UU.):</strong> la bandeja de Gmail donde recibimos y respondemos los correos y comentarios, y el inicio de sesión si el usuario elige entrar con Google.</li>
          <li>
            <strong>mindicador.cl (Chile) y dolarapi.com:</strong> servicios públicos de cotizaciones.
            La app los consulta desde tu dispositivo (incluido ve.dolarapi.com para Venezuela) para
            mostrar valores de referencia como la UF, la UTM y los tipos de cambio. Reciben tu dirección
            IP, pero no tus montos ni otros datos tuyos.
          </li>
        </ul>
        <p>
          Salvo el reporte PDF que decidas enviar por email, ninguno de estos proveedores accede a los
          datos financieros guardados en el dispositivo. Los que guardan datos tienen sede en Estados
          Unidos, por lo que los datos de cuenta y contacto se procesan allí. No vendemos datos ni los
          cedemos a terceros con fines publicitarios.
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
          Moyiq no incluye otras herramientas de analítica (Google Analytics, Mixpanel, Hotjar u
          otras) ni seguimiento de comportamiento: la app no registra eventos ni clics dentro de
          ella. La app no se conecta con cuentas bancarias y nunca pide credenciales del banco.
        </p>
        <p>
          <strong>Correos y medición de clics.</strong> Los correos que enviamos (newsletters,
          bienvenida y consejos, confirmaciones, licencias y avisos de la cuenta) salen por Resend, que
          mide los clics en todos ellos: cada enlace pasa primero por un servidor de Resend, que
          registra que hiciste clic, en qué enlace y cuándo, junto con datos técnicos como tu dirección
          IP y tu navegador, y después te lleva al destino. No medimos aperturas. Usamos los clics de
          forma agregada. Base: tu consentimiento en los correos de marketing y nuestro interés
          legítimo en los correos de servicio. Si te opones a esta medición, escríbenos a
          support@moyiq.app.
        </p>
        <p>
          La plataforma de alojamiento puede registrar datos técnicos estándar (como direcciones
          IP) para operar el servicio, según sus propias políticas.
        </p>
      </div>

      <div className={s.section}>
        <h2>9. Cookies y almacenamiento del navegador</h2>
        <p>
          Moyiq usa IndexedDB y localStorage para guardar los datos en el dispositivo. No usa
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
          guarda de ella en moyiq y en moyiq · Inversiones, incluido el perfil de inversionista. Si hay
          un plan Pro activo, la eliminación también cancela la suscripción en Stripe; si esa
          cancelación automática falla, nos llega un aviso y la hacemos a mano en un día hábil (quien
          prefiera hacerlo antes puede usar la página de cancelación). Si el correo estaba suscrito a
          un newsletter, nosotros lo quitamos de la lista de nuestro proveedor de envío. Solo se
          conservan los comprobantes de pago y la constancia de una cancelación, como se indica en
          esta política.
        </p>
        <p>
          Puedes pedir acceso, rectificación, supresión, oposición, portabilidad, limitación o bloqueo
          del tratamiento, y retirar tu consentimiento, escribiendo a support@moyiq.app desde el correo
          de tu cuenta (si escribes desde otro, podemos pedirte que confirmes que eres tú). Es gratis.
          Respondemos en un plazo máximo de 30 días corridos, salvo la prórroga que permita la ley que
          te aplica, que te avisaríamos antes de que venza. Los datos se tratan en EE. UU.; para
          usuarios del Espacio Económico Europeo, el Reino Unido o Suiza, la transferencia se apoya en
          el Marco de Privacidad de Datos UE-EE. UU. cuando el destinatario está certificado y, si no,
          en las cláusulas contractuales tipo de la Comisión Europea; en otros países, la
          transferencia es necesaria para prestarte el servicio. No vendemos datos personales.
        </p>
        <p>
          También puedes reclamar ante la autoridad de protección de datos que corresponda: en la UE o
          el EEE, la de tu país (en España, la AEPD); en Chile, la Agencia de Protección de Datos
          Personales; en Brasil, la ANPD; en México, la Secretaría Anticorrupción y Buen Gobierno; en
          Argentina, la Agencia de Acceso a la Información Pública (AAIP); en Perú, la Autoridad
          Nacional de Protección de Datos Personales; en Colombia, la Superintendencia de Industria y
          Comercio (SIC); en otros países, la autoridad local.
        </p>
      </div>

      <div className={s.section}>
        <h2>12. Si vives en Chile (Ley 19.628 y Ley 21.719)</h2>
        <p>
          La Ley 21.719 reforma la Ley 19.628 y también se aplica a quienes, sin estar establecidos en
          Chile, ofrecen bienes o servicios a personas que se encuentran allí. A la fecha de esta
          versión, su entrada en vigencia está fijada para el 1 de diciembre de 2026; el Congreso
          despachó un proyecto que la posterga al 15 de octubre de 2027 (boletín 18.623-07), que aún no
          se publica. Esta sección ya sigue lo que esa ley pide; lo que depende de la Agencia de
          Protección de Datos Personales aplica desde que la ley rija.
        </p>
        <ul className={s.list}>
          <li><strong>Responsable:</strong> MAXNOVA & LUCI Global LLC (datos en el punto 1). No tenemos domicilio ni representante en Chile, y no hemos designado un encargado de prevención. support@moyiq.app es nuestro medio de contacto para ti y para la Agencia.</li>
          <li><strong>Origen y finalidades:</strong> los datos vienen de ti (y, si entras con Google, de Google; los de pago, de Stripe). Las finalidades y bases son las de cada dato en el punto 4: ejecución del contrato, tu consentimiento, obligaciones legales e intereses legítimos.</li>
          <li><strong>Intereses legítimos:</strong> conocer de forma agregada el uso de la app (estadísticas), saber si se usan los enlaces de los correos de servicio (medición de clics) y proteger el servicio de robots y abusos (Cloudflare Turnstile y límites de uso). Puedes oponerte.</li>
          <li><strong>Consentimiento:</strong> puedes retirarlo en cualquier momento y sin dar motivos, con el enlace de baja de cada correo o escribiendo a support@moyiq.app. Retirarlo no afecta lo tratado antes.</li>
          <li><strong>Tus derechos:</strong> acceso, rectificación, supresión, oposición, portabilidad y bloqueo. Los ejerces por escrito a support@moyiq.app, sin costo, indicando quién eres, una dirección para responderte y qué datos o tratamiento pides revisar.</li>
          <li><strong>Plazos:</strong> respondemos dentro de 30 días corridos, prorrogables una sola vez hasta por otros 30 días corridos, con aviso antes de que venza el plazo. Si junto con una solicitud de rectificación, supresión u oposición pides el bloqueo temporal, respondemos en 2 días hábiles. El bloqueo suspende el tratamiento, pero los datos siguen almacenados.</li>
          <li><strong>Transferencias:</strong> tus datos se tratan en EE. UU., donde estamos nosotros y los proveedores del punto 7, porque es necesario para prestarte el servicio. A la fecha de esta versión la Agencia no ha publicado su listado de países adecuados ni sus cláusulas modelo, así que no podemos decirte que EE. UU. ofrezca un nivel adecuado según la ley chilena, y no hemos firmado cláusulas aprobadas por la Agencia.</li>
          <li><strong>Autoridad de control:</strong> la Agencia de Protección de Datos Personales. Si rechazamos tu solicitud, en todo o en parte, o no respondemos a tiempo, tienes 30 días hábiles para reclamar ante ella.</li>
          <li><strong>Incidentes de seguridad:</strong> si ocurre una vulneración que afecte tus datos, la informaremos a la Agencia y, cuando corresponda, también a ti, como exige la ley.</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>13. Si vives en Brasil (LGPD)</h2>
        <ul className={s.list}>
          <li><strong>Controlador:</strong> MAXNOVA & LUCI Global LLC. Canal de comunicación con el encargado de datos (encarregado): support@moyiq.app.</li>
          <li><strong>Bases legales:</strong> ejecución del contrato (art. 7, V), consentimiento (art. 7, I), cumplimiento de obligaciones legales (art. 7, II) e interés legítimo (art. 7, IX), según el dato.</li>
          <li><strong>Tus derechos (art. 18):</strong> confirmación de que tratamos tus datos, acceso, corrección, anonimización, bloqueo o eliminación de datos innecesarios, portabilidad, información sobre con quién los compartimos y revocación del consentimiento. Si pides la confirmación y el acceso completo, respondemos en 15 días.</li>
          <li><strong>Transferencias:</strong> nos das tus datos directamente a nosotros, una empresa en EE. UU., y nuestros proveedores los tratan allí porque es necesario para prestarte el servicio (art. 33, IX, en relación con el art. 7, V). La ANPD no ha reconocido a EE. UU. como país con protección adecuada y no hemos firmado las cláusulas estándar de la ANPD.</li>
          <li><strong>Autoridad:</strong> puedes presentar una petición ante la Agencia Nacional de Protección de Datos (ANPD).</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>14. Seguridad</h2>
        <p>
          Los datos locales dependen de la seguridad del dispositivo del usuario. Los datos
          sincronizados se guardan cifrados con una llave derivada de la frase de paso del usuario
          (o, en el modelo anterior, de la clave de licencia; ver el punto 5). Recomendamos exportar
          respaldos JSON periódicamente y guardar la frase de paso en un lugar seguro.
        </p>
      </div>

      <div className={s.section}>
        <h2>15. Menores de edad</h2>
        <p>
          Moyiq no está dirigido a menores de 18 años. No recopilamos intencionalmente
          información de menores.
        </p>
      </div>

      <div className={s.section}>
        <h2>16. Cambios a esta política</h2>
        <p>
          MAXNOVA & LUCI Global LLC puede actualizar esta política. Los cambios se publican en esta
          página con la fecha de actualización.
        </p>
      </div>

      <div className={s.section}>
        <h2>17. Contacto</h2>
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
        moyiq. Your financial data is stored on your device and we do not receive it. It only
        leaves the device if you turn on sync (it is encrypted on the device before upload; see
        section 5 about the key) or if you email a PDF report. Investments positions, if you use that
        section, are stored on our server (section 4). We count app openings anonymously
        and without cookies (section 8), with no behavior tracking, and the app does not connect
        to banks.
      </div>

      <div className={s.section}>
        <h2>1. Who operates moyiq</h2>
        <p>
          Moyiq is developed and distributed by MAXNOVA & LUCI Global LLC. This policy explains
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
        <p>
          <strong>Automatic entry.</strong> If you use <em>Dictate</em>, speech recognition is done by your
          phone or browser (Apple on iPhone and Safari, Google on Android and Chrome), which may send the
          audio to its servers to transcribe it under its own policies. moyiq only receives the text,
          interprets it on your device and does not store audio; the microphone is used only while you
          dictate. If you set up the iPhone Shortcut for Apple Pay, iOS passes the payment amount and
          merchant to moyiq when the app opens: that data is stored only on your device, and moyiq does not
          connect to your bank, your card or Apple Pay.
        </p>
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
            <strong>Pro plan:</strong> the purchase email, the account it is linked to, an
            irreversible hash of the license key (the key itself only if the user syncs with the
            previous model; see section 5), the plan, and the activation and expiration dates.
          </li>
          <li>
            <strong>Push notifications (optional):</strong> the browser's technical identifier
            (endpoint), linked to the license hash. Notifications contain only system notices,
            never financial data.
          </li>
          <li>
            <strong>Sync (optional):</strong> the encrypted copy described in section 5.
          </li>
          <li>
            <strong>Investments (optional, off by default):</strong> the investment positions you record
            in moyiq · Investments (invest.moyiq.app) are stored on our server, linked to your account,
            so you can see them on any device. If you turn the module on in More › Settings › Features,
            the app reads those positions and sends only the ticker symbols to the Investments API to
            get quotes. Your transactions stay on your device. Basis: performing what you ask for.
          </li>
          <li>
            <strong>Investor profile (only if you open Investments in the app):</strong> your answers to
            the 3 questionnaire questions (experience, horizon and what you would do after a drop) and
            the date and time, taken from your device, when you accepted the notice that it is an
            educational tool. They are stored in your account (Supabase's authentication service) so
            you are not asked again on each device. They only unlock the section: any answer unlocks
            it, they do not change what you see, and we do not use them to recommend investments or for
            advertising. Basis: performing what you ask for. They are deleted when you delete the
            account and are included if you request access to or portability of your data.
          </li>
          <li>
            <strong>Feedback and survey (NPS):</strong> if you write to us from the app or answer the
            survey, we receive your message, your score, your account email, the app version, language,
            country and plan and, only if you tick it, a technical error log in which numbers are
            replaced with "#". It reaches our support inbox (Google) by email (Resend) so we can reply.
            In the database we keep only the date of each submission, to limit how many are sent
            (feedback submissions, 30 days; the survey you answered, until you delete the account).
            Basis: your request.
          </li>
          <li>
            <strong>Cancellations and inquiries:</strong> the data you send us when you cancel online or
            write to support, to process them and to be able to prove we received them.
          </li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>5. Cross-device sync (optional and encrypted)</h2>
        <p>
          Sync is off by default. If the user turns it on in Settings, their data is encrypted on
          the device with <strong>AES-GCM</strong> before it is sent and is stored encrypted.
          Since October 19, 2026, turning it on creates a passphrase: the key is derived from that
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
          <li><strong>Supabase (USA):</strong> database, authentication (including the investor profile), encrypted sync, license validation, and Investments positions (servers in Ohio, USA, region us-east-2).</li>
          <li>
            <strong>Stripe (USA):</strong> payments, billing, and the customer portal to manage or
            cancel the subscription. We never see card details; we only receive the payment
            confirmation and the email used for the purchase.
          </li>
          <li><strong>Resend (USA):</strong> sending emails, the newsletter list, and click measurement on email links (section 8).</li>
          <li><strong>Vercel (USA):</strong> hosting for the app and the website, and anonymous usage statistics (section 8).</li>
          <li>
            <strong>Cloudflare (USA):</strong> the domain's DNS, forwarding of the emails you write to
            our @moyiq.app addresses, and Turnstile, the check that confirms you are not a bot when you
            sign in, sign up, or send feedback. Turnstile receives your IP address and technical data
            about your browser. Cloudflare acts as a processor and, to improve that bot detection, as an
            independent controller.
          </li>
          <li><strong>Google (USA):</strong> the Gmail inbox where we receive and answer emails and feedback, and sign-in if the user chooses to sign in with Google.</li>
          <li>
            <strong>mindicador.cl (Chile) and dolarapi.com:</strong> public exchange-rate services. The
            app queries them from your device (including ve.dolarapi.com for Venezuela) to show
            reference values such as the UF, the UTM, and exchange rates. They receive your IP address,
            but not your amounts or any other data about you.
          </li>
        </ul>
        <p>
          Except for a PDF report you choose to email, none of these providers has access to the
          financial data stored on the device. The ones that store data are based in the United
          States, so account and contact data is processed there. We do not sell data or share it
          with third parties for advertising.
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
          Moyiq does not include other analytics tools (Google Analytics, Mixpanel, Hotjar, or
          others) or behavior tracking: the app does not record events or clicks inside it. The app
          does not connect to bank accounts and never asks for bank credentials.
        </p>
        <p>
          <strong>Emails and click measurement.</strong> The emails we send (newsletters, welcome and
          tips, confirmations, licenses, and account notices) go out through Resend, which measures
          clicks in all of them: each link first goes through a Resend server that records that you
          clicked, which link and when, together with technical data such as your IP address and
          browser, and then takes you to the destination. We do not measure opens. We use clicks in
          aggregate. Basis: your consent for marketing emails and our legitimate interest for service
          emails. If you object to this measurement, write to support@moyiq.app.
        </p>
        <p>
          The hosting platform may log standard technical data (such as IP addresses) to operate
          the service, under its own policies.
        </p>
      </div>

      <div className={s.section}>
        <h2>9. Cookies and browser storage</h2>
        <p>
          Moyiq uses IndexedDB and localStorage to keep data on the device. It does not use
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
          server keeps about it in moyiq and moyiq · Investments, including the investor profile. If
          there is an active Pro plan, deletion also cancels the subscription in Stripe; if that
          automatic cancellation fails, we get an alert and do it by hand within one business day
          (anyone who prefers to do it sooner can use the cancellation page). If the email was
          subscribed to a newsletter, we remove it from our email provider's list. Only payment
          receipts and the record of a cancellation are kept, as described in this policy.
        </p>
        <p>
          You can request access, rectification, erasure, objection, portability, restriction or
          blocking of processing, and withdraw your consent, by writing to support@moyiq.app from your
          account email (if you write from another address, we may ask you to confirm it is you). It
          is free. We reply within 30 calendar days, unless the law that applies to you allows an
          extension, which we would tell you about before the deadline. Data is processed in the USA;
          for users in the European Economic Area, the UK, or Switzerland, the transfer relies on the
          EU-US Data Privacy Framework where the recipient is certified and, otherwise, on the European
          Commission's standard contractual clauses; in other countries, the transfer is necessary to
          provide the service. We do not sell personal information.
        </p>
        <p>
          You can also complain to the relevant data protection authority: in the EU or EEA, the one
          in your country; in Chile, the Personal Data Protection Agency (Agencia de Protección de
          Datos Personales); in Brazil, the ANPD; in Mexico, the Ministry of Anti-Corruption and Good
          Governance (Secretaría Anticorrupción y Buen Gobierno); in Argentina, the Agency for Access
          to Public Information (AAIP); in Peru, the National Authority for Personal Data Protection;
          in Colombia, the Superintendence of Industry and Commerce (SIC); elsewhere, your local
          authority.
        </p>
      </div>

      <div className={s.section}>
        <h2>12. If you live in Chile (Law 19.628 and Law 21.719)</h2>
        <p>
          Law 21.719 amends Law 19.628 and also applies to those who, without being established in
          Chile, offer goods or services to people located there. As of this version, it is set to
          take effect on December 1, 2026; Congress has passed a bill that postpones it to October
          15, 2027 (bulletin 18.623-07), which has not yet been published. This section already
          follows what the law requires; whatever depends on the Personal Data Protection Agency
          applies once the law is in force.
        </p>
        <ul className={s.list}>
          <li><strong>Controller:</strong> MAXNOVA & LUCI Global LLC (details in section 1). We have no address or representative in Chile and have not appointed a prevention officer. support@moyiq.app is our contact channel for you and for the Agency.</li>
          <li><strong>Sources and purposes:</strong> the data comes from you (and, if you sign in with Google, from Google; payment data, from Stripe). Purposes and bases are those listed for each item in section 4: performance of the contract, your consent, legal obligations, and legitimate interests.</li>
          <li><strong>Legitimate interests:</strong> knowing in aggregate how the app is used (statistics), knowing whether links in service emails are used (click measurement), and protecting the service from bots and abuse (Cloudflare Turnstile and usage limits). You can object.</li>
          <li><strong>Consent:</strong> you can withdraw it at any time without giving reasons, through the unsubscribe link in each email or by writing to support@moyiq.app. Withdrawing it does not affect earlier processing.</li>
          <li><strong>Your rights:</strong> access, rectification, erasure, objection, portability, and blocking. You exercise them in writing at support@moyiq.app, free of charge, stating who you are, an address for our reply, and which data or processing you want reviewed.</li>
          <li><strong>Deadlines:</strong> we reply within 30 calendar days, extendable once by up to another 30 calendar days, with notice before the deadline. If, together with a request for rectification, erasure, or objection, you ask for temporary blocking, we reply within 2 business days. Blocking suspends processing, but the data remains stored.</li>
          <li><strong>Transfers:</strong> your data is processed in the USA, where we and the providers in section 7 are, because it is necessary to provide the service. As of this version the Agency has not published its list of adequate countries or its model clauses, so we cannot tell you that the USA offers an adequate level of protection under Chilean law, and we have not signed clauses approved by the Agency.</li>
          <li><strong>Supervisory authority:</strong> the Personal Data Protection Agency. If we reject your request, in whole or in part, or do not reply in time, you have 30 business days to complain to it.</li>
          <li><strong>Security incidents:</strong> if a breach affects your data, we will report it to the Agency and, where applicable, to you, as the law requires.</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>13. If you live in Brazil (LGPD)</h2>
        <ul className={s.list}>
          <li><strong>Controller:</strong> MAXNOVA & LUCI Global LLC. Contact channel under art. 41 LGPD (encarregado): support@moyiq.app.</li>
          <li><strong>Legal bases:</strong> performance of the contract (art. 7, V), consent (art. 7, I), compliance with legal obligations (art. 7, II), and legitimate interest (art. 7, IX), depending on the data.</li>
          <li><strong>Your rights (art. 18):</strong> confirmation that we process your data, access, correction, anonymization, blocking or deletion of unnecessary data, portability, information about who we share it with, and withdrawal of consent. If you ask for confirmation and full access, we reply within 15 days.</li>
          <li><strong>Transfers:</strong> you give your data directly to us, a US company, and our providers process it there because it is necessary to provide the service (art. 33, IX, together with art. 7, V). The ANPD has not recognized the USA as offering adequate protection, and we have not signed the ANPD standard clauses.</li>
          <li><strong>Authority:</strong> you can file a petition with the National Data Protection Authority (ANPD).</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>14. Security</h2>
        <p>
          Local data depends on the security of the user's device. Synced data is stored encrypted
          with a key derived from the user's passphrase (or, in the previous model, from the
          license key; see section 5). We recommend exporting JSON backups periodically and keeping
          the passphrase somewhere safe.
        </p>
      </div>

      <div className={s.section}>
        <h2>15. Minors</h2>
        <p>
          Moyiq is not directed at people under 18. We do not knowingly collect information from
          minors.
        </p>
      </div>

      <div className={s.section}>
        <h2>16. Changes to this policy</h2>
        <p>
          MAXNOVA & LUCI Global LLC may update this policy. Changes are published on this page with
          the date of the update.
        </p>
      </div>

      <div className={s.section}>
        <h2>17. Contact</h2>
        <p>For privacy questions: <strong>support@moyiq.app</strong></p>
      </div>

    </div>
  )
}

function PtBody() {
  return (
    <div className={s.legalWrap}>
      <div className={s.highlight}>
        <strong>Resumo:</strong> Para usar o moyiq é preciso ter uma conta gratuita, vinculada a
        um email. Os dados financeiros do usuário ficam no dispositivo dele e nós não os
        recebemos. Eles só saem do dispositivo se o usuário ativar a sincronização (são
        criptografados no dispositivo antes do envio; veja o item 5 sobre a chave) ou se enviar um
        relatório PDF por email. As posições de Investimentos, se você usar essa seção, ficam no nosso
        servidor (item 4). Contamos as aberturas do app de forma anônima e sem cookies (item
        8), sem rastreamento de comportamento, e o app não se conecta a bancos.
      </div>

      <div className={s.section}>
        <h2>1. Quem opera o moyiq</h2>
        <p>
          O moyiq é desenvolvido e distribuído pela MAXNOVA & LUCI Global LLC. Esta política
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
        <p>
          <strong>Registro automático.</strong> Se você usa <em>Ditar</em>, o reconhecimento de voz é feito
          pelo sistema do seu telefone ou navegador (Apple no iPhone e Safari, Google no Android e Chrome),
          que pode enviar o áudio aos seus servidores para transcrevê-lo conforme as próprias políticas. O
          moyiq recebe só o texto, interpreta no seu dispositivo e não guarda áudio; o microfone é usado só
          enquanto você dita. Se você configurar o Atalho do iPhone para Apple Pay, o iOS passa ao moyiq o
          valor e o estabelecimento do pagamento ao abrir o app: esse dado fica só no seu dispositivo, e o
          moyiq não se conecta ao seu banco, ao seu cartão nem ao Apple Pay.
        </p>
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
            <strong>Plano Pro:</strong> o email da compra, a conta à qual está vinculado, um hash
            irreversível da chave de licença (a própria chave só se o usuário sincroniza com o
            modelo anterior; veja o item 5), o plano e as datas de ativação e vencimento.
          </li>
          <li>
            <strong>Notificações push (opcional):</strong> o identificador técnico (endpoint) do
            navegador, vinculado ao hash da licença. As notificações contêm apenas avisos do
            sistema, nunca dados financeiros.
          </li>
          <li>
            <strong>Sincronização (opcional):</strong> a cópia criptografada descrita no item 5.
          </li>
          <li>
            <strong>Investimentos (opcional, desligado por padrão):</strong> as posições de investimento
            que você registra no moyiq · Investimentos (invest.moyiq.app) ficam no nosso servidor,
            vinculadas à sua conta, para que você possa vê-las em qualquer dispositivo. Se você ativar o
            módulo em Mais › Ajustes › Funções, o app lê essas posições e envia à API de Investimentos
            apenas os símbolos, para obter as cotações. Suas movimentações continuam no seu dispositivo.
            Base: execução do que você pede.
          </li>
          <li>
            <strong>Perfil de investidor (só se você abrir Investimentos no app):</strong> suas
            respostas às 3 perguntas do questionário (experiência, horizonte e o que você faria diante de
            uma queda) e a data e hora, tomadas do seu dispositivo, em que você aceitou o aviso de que é
            uma ferramenta educativa. Ficam guardadas na sua conta (serviço de autenticação do Supabase)
            para não serem pedidas em cada dispositivo. Servem só para liberar a seção: qualquer
            resposta libera, elas não mudam o que você vê e não as usamos para recomendar investimentos
            nem para publicidade. Base: execução do que você pede. São apagadas ao excluir a conta e
            incluídas se você pedir acesso aos seus dados ou a portabilidade.
          </li>
          <li>
            <strong>Comentários e pesquisa (NPS):</strong> se você nos escreve pelo app ou responde à
            pesquisa, recebemos sua mensagem, sua nota, o email da sua conta, a versão do app, o idioma,
            o país e o plano e, só se você marcar, um registro técnico de erros em que os números são
            substituídos por «#». Isso chega por email (Resend) à nossa caixa de suporte (Google) para
            podermos responder. No banco de dados guardamos só a data de cada envio, para limitar a
            quantidade (envios de comentários, 30 dias; a pesquisa respondida, até você excluir a
            conta). Base: sua solicitação.
          </li>
          <li>
            <strong>Cancelamentos e consultas:</strong> os dados que você nos envia ao cancelar on-line
            ou escrever ao suporte, para processá-los e poder provar que os recebemos.
          </li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>5. Sincronização entre dispositivos (opcional e criptografada)</h2>
        <p>
          A sincronização vem desativada. Se o usuário a ativar em Configurações, os dados são
          criptografados no dispositivo com <strong>AES-GCM</strong> antes do envio e armazenados
          criptografados. Desde 19 de outubro de 2026, ao ativá-la se cria uma frase-senha: a chave
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
          <li><strong>Supabase (EUA):</strong> banco de dados, autenticação (incluído o perfil de investidor), sincronização criptografada, validação de licenças e as posições de Investimentos (servidores em Ohio, EUA, região us-east-2).</li>
          <li>
            <strong>Stripe (EUA):</strong> pagamentos, faturamento e portal do cliente para gerenciar
            ou cancelar a assinatura. Nunca vemos os dados do cartão; recebemos apenas a confirmação do
            pagamento e o email da compra.
          </li>
          <li><strong>Resend (EUA):</strong> envio de emails, lista das newsletters e medição de cliques nos links dos emails (item 8).</li>
          <li><strong>Vercel (EUA):</strong> hospedagem do app e do site, e estatísticas de uso anônimas (item 8).</li>
          <li>
            <strong>Cloudflare (EUA):</strong> DNS do domínio, encaminhamento dos emails que você escreve
            para nossos endereços @moyiq.app e Turnstile, a verificação que confirma que você não é um
            robô ao entrar no app, ao se cadastrar e ao enviar comentários. O Turnstile recebe seu
            endereço IP e dados técnicos do seu navegador. A Cloudflare atua como operadora e, para
            melhorar essa detecção de robôs, como controladora própria.
          </li>
          <li><strong>Google (EUA):</strong> a caixa do Gmail onde recebemos e respondemos emails e comentários, e o login se o usuário escolher entrar com o Google.</li>
          <li>
            <strong>mindicador.cl (Chile) e dolarapi.com:</strong> serviços públicos de cotações. O app
            os consulta a partir do seu dispositivo (incluído ve.dolarapi.com para a Venezuela) para
            mostrar valores de referência como a UF, a UTM e as taxas de câmbio. Recebem seu endereço
            IP, mas não seus valores nem outros dados seus.
          </li>
        </ul>
        <p>
          Exceto o relatório PDF que você decidir enviar por email, nenhum desses fornecedores acessa
          os dados financeiros armazenados no dispositivo. Os que guardam dados têm sede nos Estados
          Unidos, por isso os dados de conta e contato são processados lá. Não vendemos dados nem os
          compartilhamos com terceiros para fins publicitários.
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
          O moyiq não inclui outras ferramentas de analytics (Google Analytics, Mixpanel, Hotjar
          ou outras) nem rastreamento de comportamento: o app não registra eventos nem cliques dentro
          dele. O app não se conecta a contas bancárias e nunca pede credenciais do banco.
        </p>
        <p>
          <strong>Emails e medição de cliques.</strong> Os emails que enviamos (newsletters, boas-vindas
          e dicas, confirmações, licenças e avisos da conta) saem pelo Resend, que mede os cliques em
          todos eles: cada link passa primeiro por um servidor do Resend, que registra que você clicou,
          em qual link e quando, junto com dados técnicos como seu endereço IP e seu navegador, e
          depois leva você ao destino. Não medimos aberturas. Usamos os cliques de forma agregada.
          Base: seu consentimento nos emails de marketing e nosso interesse legítimo nos emails de
          serviço. Se você se opuser a essa medição, escreva para support@moyiq.app.
        </p>
        <p>
          A plataforma de hospedagem pode registrar dados técnicos padrão (como endereços IP) para
          operar o serviço, segundo suas próprias políticas.
        </p>
      </div>

      <div className={s.section}>
        <h2>9. Cookies e armazenamento do navegador</h2>
        <p>
          O moyiq usa IndexedDB e localStorage para manter os dados no dispositivo. Não usa
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
          no moyiq e no moyiq · Investimentos, incluído o perfil de investidor. Se houver um plano Pro
          ativo, a exclusão também cancela a assinatura na Stripe; se esse cancelamento automático
          falhar, recebemos um aviso e o fazemos manualmente em um dia útil (quem preferir fazer antes
          pode usar a página de cancelamento). Se o email estava inscrito em uma newsletter, nós o
          retiramos da lista do nosso provedor de envio. Ficam apenas os comprovantes de pagamento e o
          registro de um cancelamento, como indica esta política.
        </p>
        <p>
          Você pode pedir acesso, retificação, eliminação, oposição, portabilidade, limitação ou
          bloqueio do tratamento, e revogar seu consentimento, escrevendo para support@moyiq.app a
          partir do email da sua conta (se escrever de outro, podemos pedir que confirme que é você).
          É gratuito. Respondemos em até 30 dias corridos, salvo a prorrogação permitida pela lei que
          se aplica a você, que avisaríamos antes do vencimento; no Brasil, a confirmação e o acesso
          completo, em 15 dias. Os dados são tratados nos EUA; para usuários do Espaço Econômico
          Europeu, do Reino Unido ou da Suíça, a transferência se apoia no Marco de Privacidade de
          Dados UE-EUA quando o destinatário é certificado e, caso contrário, nas cláusulas
          contratuais-padrão da Comissão Europeia; em outros países, a transferência é necessária
          para prestar o serviço. Não vendemos dados pessoais.
        </p>
        <p>
          Você também pode reclamar à autoridade de proteção de dados competente: no Brasil, à ANPD; na
          UE ou no EEE, à do seu país; no Chile, à Agencia de Protección de Datos Personales; no
          México, à Secretaría Anticorrupción y Buen Gobierno; na Argentina, à Agencia de Acceso a la
          Información Pública (AAIP); no Peru, à Autoridad Nacional de Protección de Datos Personales;
          na Colômbia, à Superintendencia de Industria y Comercio (SIC); em outros países, à autoridade
          local.
        </p>
      </div>

      <div className={s.section}>
        <h2>12. Se você mora no Brasil (LGPD)</h2>
        <ul className={s.list}>
          <li><strong>Controlador:</strong> MAXNOVA & LUCI Global LLC (dados no item 1). Canal de comunicação com o encarregado: support@moyiq.app.</li>
          <li><strong>Bases legais:</strong> execução do contrato (art. 7º, V), consentimento (art. 7º, I), cumprimento de obrigação legal (art. 7º, II) e legítimo interesse (art. 7º, IX), conforme o dado.</li>
          <li><strong>Seus direitos (art. 18):</strong> confirmação da existência de tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dados desnecessários, portabilidade, informação sobre com quem compartilhamos os dados e revogação do consentimento. A confirmação e o acesso completo, em até 15 dias.</li>
          <li><strong>Transferência internacional:</strong> você nos envia seus dados diretamente, a uma empresa nos EUA, e nossos fornecedores os tratam lá porque é necessário para prestar o serviço que você contrata ou pede (art. 33, IX, combinado com o art. 7º, V). A ANPD não reconheceu os EUA como país com nível adequado de proteção, e não assinamos as cláusulas-padrão contratuais da ANPD.</li>
          <li><strong>Autoridade:</strong> você pode peticionar perante a Autoridade Nacional de Proteção de Dados (ANPD).</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>13. Se você mora no Chile (Lei 19.628 e Lei 21.719)</h2>
        <p>
          A Lei 21.719 reforma a Lei 19.628 e também se aplica a quem, sem estar estabelecido no Chile,
          oferece bens ou serviços a pessoas que estão lá. Na data desta versão, sua entrada em vigor
          está fixada para 1º de dezembro de 2026; o Congresso aprovou um projeto que a adia para 15 de
          outubro de 2027 (boletim 18.623-07), que ainda não foi publicado. Esta seção já segue o que a
          lei pede; o que depende da Agencia de Protección de Datos Personales vale desde que a lei
          entre em vigor.
        </p>
        <ul className={s.list}>
          <li><strong>Responsável e contato:</strong> MAXNOVA & LUCI Global LLC (item 1). Não temos domicílio nem representante no Chile; support@moyiq.app é nosso canal para você e para a Agência.</li>
          <li><strong>Finalidades e bases:</strong> as de cada dado no item 4. Os interesses legítimos são estatísticas agregadas, medição de cliques nos emails de serviço e proteção contra robôs e abusos (Cloudflare Turnstile); você pode se opor.</li>
          <li><strong>Seus direitos:</strong> acesso, retificação, eliminação, oposição, portabilidade e bloqueio, por escrito a support@moyiq.app, sem custo, indicando quem você é, um endereço para resposta e o que pede revisar.</li>
          <li><strong>Prazos:</strong> 30 dias corridos, prorrogáveis uma vez por até mais 30, com aviso antes do vencimento; se pedir o bloqueio temporal junto com uma retificação, eliminação ou oposição, 2 dias úteis.</li>
          <li><strong>Transferências:</strong> os dados são tratados nos EUA porque é necessário para prestar o serviço. A Agência ainda não publicou sua lista de países adequados nem suas cláusulas modelo, e não assinamos cláusulas aprovadas por ela.</li>
          <li><strong>Autoridade e incidentes:</strong> você pode reclamar à Agência em até 30 dias úteis se rejeitarmos sua solicitação ou não respondermos a tempo. Se houver uma violação que afete seus dados, informaremos a Agência e, quando couber, você.</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2>14. Segurança</h2>
        <p>
          Os dados locais dependem da segurança do dispositivo do usuário. Os dados sincronizados
          são armazenados criptografados com uma chave derivada da frase-senha do usuário (ou, no
          modelo anterior, da chave de licença; veja o item 5). Recomendamos exportar backups JSON
          periodicamente e guardar a frase-senha em local seguro.
        </p>
      </div>

      <div className={s.section}>
        <h2>15. Menores de idade</h2>
        <p>
          O moyiq não é direcionado a menores de 18 anos. Não coletamos intencionalmente
          informações de menores.
        </p>
      </div>

      <div className={s.section}>
        <h2>16. Alterações nesta política</h2>
        <p>
          A MAXNOVA & LUCI Global LLC pode atualizar esta política. As alterações são publicadas
          nesta página com a data de atualização.
        </p>
      </div>

      <div className={s.section}>
        <h2>17. Contato</h2>
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
        <strong>Kurz gesagt:</strong> Für die Nutzung von moyiq benötigen Sie ein kostenloses
        Konto mit Ihrer E-Mail-Adresse. Ihre Finanzdaten bleiben auf Ihrem Gerät; wir erhalten sie
        nicht. Sie verlassen das Gerät nur, wenn Sie die Synchronisierung aktivieren (dann vor dem
        Hochladen auf dem Gerät verschlüsselt; zum Schlüssel siehe Abschnitt 5) oder einen
        PDF-Bericht per E-Mail versenden. Positionen in Investments speichern wir, wenn Sie diesen
        Bereich nutzen, auf unserem Server (Abschnitt 4). App-Aufrufe zählen wir anonym und ohne Cookies
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
            Lizenzregister (irreversibel; den Schlüssel selbst nur, wenn Sie mit dem bisherigen
            Modell synchronisieren, siehe Abschnitt 5), das Konto, mit dem das Abo verknüpft ist,
            Tarif, Aktivierungs- und Ablaufdatum,
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
          <li>
            <strong>Investments (optional, standardmäßig aus):</strong> Die Anlagepositionen, die Sie in
            moyiq · Investments (invest.moyiq.app) erfassen, speichern wir auf unserem Server, verknüpft
            mit Ihrem Konto, damit Sie sie auf jedem Gerät sehen. Aktivieren Sie das Modul unter Mehr ›
            Einstellungen › Funktionen, liest die App diese Positionen und sendet nur die Tickersymbole
            an die Investments-API, um Kurse abzurufen. Ihre Buchungen bleiben auf Ihrem Gerät (Art. 6
            Abs. 1 lit. b DSGVO).
          </li>
          <li>
            <strong>Anlegerprofil (nur wenn Sie Investments in der App öffnen):</strong> Ihre Antworten
            auf die 3 Fragen des Fragebogens (Erfahrung, Anlagehorizont und Ihre Reaktion auf einen
            Kursrückgang) sowie Datum und Uhrzeit laut Ihrem Gerät, zu denen Sie den Hinweis akzeptiert
            haben, dass es sich um ein Bildungswerkzeug handelt. Sie werden in Ihrem Konto
            (Authentifizierungsdienst von Supabase) gespeichert, damit Sie nicht auf jedem Gerät erneut
            gefragt werden. Sie dienen nur der Freischaltung des Bereichs: Jede Antwort schaltet ihn
            frei, ändert nichts an den angezeigten Inhalten und wird weder für Anlageempfehlungen noch
            für Werbung genutzt (Art. 6 Abs. 1 lit. b DSGVO). Sie werden mit dem Konto gelöscht und sind
            Teil einer Auskunft oder Datenübertragung.
          </li>
          <li>
            <strong>Feedback und Umfrage (NPS):</strong> Schreiben Sie uns aus der App oder beantworten
            Sie die Umfrage, erhalten wir Ihre Nachricht, Ihre Bewertung, die E-Mail-Adresse Ihres
            Kontos, App-Version, Sprache, Land und Tarif sowie, nur wenn Sie es ankreuzen, ein
            technisches Fehlerprotokoll, in dem Zahlen durch „#“ ersetzt sind. Es erreicht unser
            Support-Postfach (Google) per E-Mail (Resend), damit wir antworten können. In der Datenbank
            speichern wir nur das Datum jeder Übermittlung, um die Anzahl zu begrenzen
            (Feedback-Übermittlungen 30 Tage; die beantwortete Umfrage bis zur Löschung des Kontos).
            Rechtsgrundlage ist Ihre Anfrage (Art. 6 Abs. 1 lit. b DSGVO).
          </li>
        </ul>
        <p>
          <strong>Automatische Erfassung.</strong> Wenn Sie <em>Diktieren</em> nutzen, übernimmt die
          Spracherkennung Ihr Telefon oder Browser (Apple auf iPhone und Safari, Google auf Android und
          Chrome), der den Ton nach eigenen Richtlinien zur Transkription an seine Server senden kann. moyiq
          erhält nur den Text, wertet ihn auf Ihrem Gerät aus und speichert keine Audiodaten; das Mikrofon
          wird nur während des Diktierens genutzt. Wenn Sie den iPhone-Kurzbefehl für Apple Pay einrichten,
          übergibt iOS beim Öffnen der App Betrag und Händler der Zahlung an moyiq: Diese Daten bleiben nur
          auf Ihrem Gerät, und moyiq verbindet sich weder mit Ihrer Bank noch mit Ihrer Karte oder Apple Pay.
        </p>
      </div>

      <div className={s.section}>
        <h2>5. Optionale Synchronisierung</h2>
        <p>
          Die Synchronisierung ist standardmäßig ausgeschaltet. Aktivieren Sie sie in den
          Einstellungen, werden Ihre Daten auf Ihrem Gerät mit <strong>AES-GCM</strong>
          verschlüsselt, bevor sie übertragen und verschlüsselt gespeichert werden. Seit dem
          19. Oktober 2026 erstellen Sie beim Aktivieren eine Passphrase: Der Schlüssel wird auf
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
          zu Analyse- oder Werbezwecken ein. Ereignisse oder Klicks innerhalb der App werden nicht
          aufgezeichnet. moyiq verbindet sich nicht mit Ihrem Bankkonto und fragt keine
          Bankzugangsdaten ab. Für den Betrieb nutzt die App ausschließlich den technisch
          erforderlichen Speicher Ihres Browsers (IndexedDB, localStorage).
        </p>
        <p>
          <strong>E-Mails und Klickmessung.</strong> Unsere E-Mails (Newsletter, Willkommens- und
          Tipp-E-Mails, Bestätigungen, Lizenzen und Kontohinweise) versenden wir über Resend, das in
          allen Klicks misst: Jeder Link läuft zuerst über einen Server von Resend, der festhält, dass
          Sie geklickt haben, welchen Link und wann, zusammen mit technischen Daten wie IP-Adresse und
          Browser, und Sie dann zum Ziel weiterleitet. Öffnungen messen wir nicht. Wir werten Klicks
          nur zusammengefasst aus. Rechtsgrundlage ist Ihre Einwilligung bei Werbe-E-Mails (Art. 6
          Abs. 1 lit. a DSGVO) und unser berechtigtes Interesse bei Service-E-Mails (Art. 6 Abs. 1 lit.
          f DSGVO). Widerspruch jederzeit an support@moyiq.app.
        </p>
      </div>

      <div className={s.section}>
        <h2>9. Empfänger und Auftragsverarbeiter</h2>
        <p>
          Wir setzen folgende Dienstleister ein. Soweit sie Daten in unserem Auftrag verarbeiten,
          geschieht dies auf Grundlage eines Vertrags zur Auftragsverarbeitung (Art. 28 DSGVO).
        </p>
        <ul className={s.list}>
          <li><strong>Supabase Inc. (USA, Serverstandort Ohio, Region us-east-2):</strong> Datenbank, Authentifizierung (einschließlich Anlegerprofil), verschlüsselte Synchronisierung, Lizenzprüfung und Positionen von Investments.</li>
          <li>
            <strong>Stripe (USA bzw. Irland, je nach Vertragspartner):</strong> Zahlungsabwicklung.
            Stripe verarbeitet Zahlungsdaten teilweise als eigener Verantwortlicher (z. B. zur
            Betrugsprävention). Wir erhalten nur die Zahlungsbestätigung und die E-Mail-Adresse des
            Kaufs, nie Kartendaten. Über das Kundenportal von Stripe können Sie das Abo verwalten oder
            kündigen.
          </li>
          <li><strong>Resend (USA):</strong> Versand von E-Mails, Newsletter-Liste und Klickmessung in E-Mails (Abschnitt 8).</li>
          <li><strong>Vercel Inc. (USA):</strong> Hosting von App und Website sowie anonyme Nutzungsstatistik (Abschnitt 8).</li>
          <li>
            <strong>Cloudflare, Inc. (USA):</strong> DNS der Domain, Weiterleitung der E-Mails an unsere
            Adressen @moyiq.app und Turnstile, die Prüfung, ob ein Mensch die App nutzt, bei Anmeldung,
            Registrierung und beim Senden von Feedback. Turnstile erhält Ihre IP-Adresse und technische
            Daten Ihres Browsers. Cloudflare handelt als Auftragsverarbeiter und, zur Verbesserung der
            Bot-Erkennung, als eigener Verantwortlicher (Art. 6 Abs. 1 lit. f DSGVO).
          </li>
          <li><strong>Google (Google Ireland Ltd. / Google LLC):</strong> das Gmail-Postfach, in dem wir E-Mails und Feedback empfangen und beantworten, und die Anmeldung mit Google, wenn Sie diese wählen.</li>
          <li>
            <strong>mindicador.cl (Chile) und dolarapi.com:</strong> öffentliche Kursdienste. Die App
            ruft sie von Ihrem Gerät aus ab (einschließlich ve.dolarapi.com für Venezuela), um
            Referenzwerte wie UF, UTM und Wechselkurse anzuzeigen. Sie erhalten Ihre IP-Adresse, aber
            keine Beträge und keine weiteren Daten über Sie.
          </li>
        </ul>
        <p>
          Außer einem PDF-Bericht, den Sie selbst per E-Mail versenden, hat keiner dieser Dienstleister
          Zugriff auf die Finanzdaten auf Ihrem Gerät. Eine Weitergabe Ihrer Daten zu Werbezwecken oder
          ein Verkauf an Dritte findet nicht statt.
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
            Server gespeicherten Daten in moyiq und moyiq · Investments, einschließlich des
            Anlegerprofils, werden dabei sofort gelöscht. Bei einem aktiven Pro-Abo kündigt die Löschung
            auch das Abonnement bei Stripe; schlägt diese automatische Kündigung fehl, erhalten wir einen
            Hinweis und erledigen sie innerhalb eines Werktags von Hand (wer es früher erledigen möchte,
            nutzt die Kündigungsseite). War die E-Mail-Adresse für einen Newsletter angemeldet,
            entfernen wir sie aus der Liste unseres E-Mail-Dienstleisters.
          </li>
          <li>E-Mail-Adressen für Neuigkeiten: bis zu Ihrer Abmeldung oder dem Widerruf Ihrer Einwilligung.</li>
          <li>
            Pro-Daten (Lizenz-Hash, Tarif, Zeiträume, Zahlungsnachweise): für die Dauer des Vertrags
            und darüber hinaus, soweit gesetzliche Aufbewahrungspflichten bestehen.
          </li>
          <li>Verschlüsselte Synchronisierungsdaten: bis zur Löschung Ihres Kontos oder auf Ihre Anfrage an support@moyiq.app (das Ausschalten der Synchronisierung stoppt nur neue Uploads).</li>
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
        <p>
          Zur Ausübung Ihrer Rechte genügt eine E-Mail an <strong>support@moyiq.app</strong>, am besten
          von der E-Mail-Adresse Ihres Kontos (sonst bitten wir Sie gegebenenfalls, Ihre Identität zu
          bestätigen). Die Bearbeitung ist kostenlos; wir antworten innerhalb eines Monats (Art. 12 Abs.
          3 DSGVO).
        </p>
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
        <h2>14. Wenn Sie in Chile leben (Gesetze 19.628 und 21.719)</h2>
        <p>
          Das Gesetz 21.719 reformiert das Gesetz 19.628 und gilt auch für Anbieter ohne Niederlassung
          in Chile, die dort Personen Waren oder Dienstleistungen anbieten. Zum Stand dieser Fassung
          tritt es am 1. Dezember 2026 in Kraft; der Kongress hat eine Verschiebung auf den 15. Oktober
          2027 beschlossen (Bulletin 18.623-07), die noch nicht veröffentlicht ist. Verantwortlicher
          ist die MAXNOVA & LUCI Global LLC (Abschnitt 1); wir haben weder Sitz noch Vertreter in
          Chile, und support@moyiq.app ist unser Kontakt für Sie und die Behörde. Sie haben das Recht
          auf Auskunft, Berichtigung, Löschung, Widerspruch, Übertragbarkeit und Sperrung. Wir
          antworten innerhalb von 30 Kalendertagen (einmal um bis zu 30 weitere Tage verlängerbar, mit
          vorheriger Mitteilung); eine vorläufige Sperrung zusammen mit einem Antrag auf Berichtigung,
          Löschung oder Widerspruch beantworten wir innerhalb von 2 Werktagen. Die Daten werden in den
          USA verarbeitet, weil dies für den Dienst erforderlich ist; die Behörde hat noch keine Liste
          angemessener Länder und keine Musterklauseln veröffentlicht, und wir haben keine von ihr
          genehmigten Klauseln unterzeichnet. Aufsichtsbehörde ist die Agencia de Protección de Datos
          Personales; bei einer Verletzung, die Ihre Daten betrifft, informieren wir sie und, soweit
          erforderlich, Sie.
        </p>
      </div>

      <div className={s.section}>
        <h2>15. Wenn Sie in Brasilien leben (LGPD)</h2>
        <p>
          Verantwortlicher (controlador) ist die MAXNOVA & LUCI Global LLC; Kommunikationskanal nach
          Art. 41 LGPD (encarregado): support@moyiq.app. Rechtsgrundlagen sind
          Vertragserfüllung (Art. 7 V), Einwilligung (Art. 7 I), gesetzliche Pflichten (Art. 7 II) und
          berechtigtes Interesse (Art. 7 IX). Sie haben die Rechte aus Art. 18 LGPD; eine Bestätigung
          und vollständige Auskunft erhalten Sie innerhalb von 15 Tagen. Die Übermittlung in die USA
          beruht auf Art. 33 IX in Verbindung mit Art. 7 V LGPD; die ANPD hat die USA nicht als
          angemessen anerkannt, und wir haben die Standardklauseln der ANPD nicht unterzeichnet.
          Aufsichtsbehörde ist die Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </div>

      <div className={s.section}>
        <h2>16. Minderjährige</h2>
        <p>
          Moyiq richtet sich nicht an Personen unter 18 Jahren. Wir erheben wissentlich keine
          Daten von Minderjährigen.
        </p>
      </div>

      <div className={s.section}>
        <h2>17. Änderungen</h2>
        <p>
          Wir passen diese Datenschutzerklärung an, wenn sich unsere Datenverarbeitung oder die
          Rechtslage ändert. Es gilt die jeweils hier veröffentlichte Fassung.
        </p>
      </div>

      <div className={s.section}>
        <h2>18. Weitere rechtliche Informationen</h2>
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
  es: { title: 'Política de Privacidad', sub: `${LAST_UPDATED.es} · ${OPERATOR}`, Body: withRebrandNotice(EsBody, 'es') },
  en: { title: 'Privacy Policy', sub: `${LAST_UPDATED.en} · ${OPERATOR}`, Body: withRebrandNotice(EnBody, 'en') },
  pt: { title: 'Política de Privacidade', sub: `${LAST_UPDATED.pt} · ${OPERATOR}`, Body: withRebrandNotice(PtBody, 'pt') },
  de: { title: 'Datenschutzerklärung', sub: `${LAST_UPDATED.de} · ${OPERATOR}`, Body: withRebrandNotice(DeBody, 'de') },
}
