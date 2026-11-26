// Ayuda de Inversiones (F7), español neutro con "tú". Las preguntas de la
// ayuda de Invest (inventario 06, "Ayuda") reescritas para la navegación de
// moyiq. Viaja en el chunk de la hoja de ayuda (src/i18n/lazyDict.js); en/pt/de
// tienen las mismas claves y variables (help.test.js). Un párrafo por línea en
// blanco ("\n\n"). Sin emoji ni exclamaciones; nada de consejos de compra.
export default {
  'hlp.title': 'Ayuda de Inversiones',
  'hlp.intro': 'Respuestas cortas sobre cómo funciona esta sección. Toca una pregunta para abrirla.',
  'hlp.close': 'Cerrar',
  'hlp.loading': 'Cargando…',

  'hlp.g.nav': 'Cómo está ordenada',
  'hlp.q.sections': '¿Qué hay en cada pestaña?',
  'hlp.a.sections': "Inversiones tiene cinco pestañas.\n\nResumen: el valor de tu portafolio hoy, tus posiciones, cómo cambió y el contexto del mercado. Portafolio: tus posiciones, movimientos, dividendos y objetivos; toca una posición para abrir su ficha. Siguiendo: Mi lista, con la alerta de precio de cada activo y los botones para seguir, crear una alerta y comparar; y Descubrir. Planificar: Tus tramos (con la calculadora de cuánto puedes perder al pie) y Aportes (con tus planes guardados). Mercado: índices, resultados de empresas, noticias y tipos de cambio.",
  'hlp.q.views': '¿Qué cambia entre la vista esencial y la completa?',
  'hlp.a.views': 'La vista esencial muestra lo básico, con una línea simple de precio. La vista completa suma velas, indicadores (medias, RSI, MACD y bandas de Bollinger), el stop y la cinta de mercado.\n\nSe cambia con el interruptor "Vista completa", debajo de las pestañas. Cambiar de vista no borra nada.',
  'hlp.q.asset': '¿Cómo abro la ficha de un activo?',
  'hlp.a.asset': 'Toca la lupa, debajo de las pestañas, y escribe su símbolo, o toca un símbolo en cualquier lista. La ficha muestra el precio, el gráfico, los indicadores, los datos de la empresa, tu posición si la tienes y noticias. Desde ahí puedes seguir el activo, crearle una alerta o registrar una operación.',

  'hlp.g.data': 'Datos e indicadores',
  'hlp.q.fresh': '¿Qué tan al día están los precios?',
  'hlp.a.fresh': 'Los precios llegan de fuentes públicas, como Yahoo Finance, y pueden tener retraso. Junto al precio ves una etiqueta con la hora del último precio informado:\n\n"Al día": ese precio tiene 2 minutos o menos. "Retraso hasta N min": tiene más de 2 minutos. "Mercado cerrado": la bolsa está fuera de su horario. "Sin conexión": no se pudo actualizar y ves el último precio que llegó. "Retraso no informado": la fuente no dice la hora.\n\nSon datos de referencia, no para operar al instante.',
  'hlp.q.ma': '¿Qué es una media móvil?',
  'hlp.a.ma': 'Es el precio promedio de los últimos días. La media de 50 días suma los cierres de los últimos 50 días y los divide por 50. Suaviza los saltos de cada día y deja ver la tendencia.\n\nSi el precio está sobre su media, en ese período tendió a subir; si está debajo, a bajar. Es un dato del pasado: no dice qué va a pasar.',
  'hlp.q.rsi': '¿Qué es el RSI?',
  'hlp.a.rsi': 'El RSI (índice de fuerza relativa) compara las subidas y las bajadas de los últimos 14 días en una escala de 0 a 100.\n\nSobre 70 suele leerse como que el precio subió rápido en poco tiempo; bajo 30, que bajó rápido. No anticipa un cambio de dirección: un precio puede seguir subiendo con el RSI alto.',
  'hlp.q.macd': '¿Qué es el MACD?',
  'hlp.a.macd': 'El MACD (12, 26, 9) mide el impulso del precio: compara una media rápida, de 12 días, con una lenta, de 26 días.\n\nLa app muestra su histograma. Sobre cero, el impulso de corto plazo es positivo; bajo cero, negativo. Si las barras se achican, ese impulso pierde fuerza. Como los demás indicadores, describe lo que ya pasó.',

  'hlp.g.risk': 'Riesgo y planificación',
  'hlp.q.calc': '¿Qué hace la calculadora?',
  'hlp.a.calc': 'En Planificar › Tus tramos, al pie, «¿Cuánto puedo perder si sale mal?» se abre con un toque: escribes qué quieres comprar, a qué precio y dónde pondrías tu stop. Con tu capital de referencia y tu regla de riesgo, calcula cuántas unidades caben para que, si el precio llega al stop, la pérdida no pase del porcentaje que elegiste.\n\nSolo calcula: no compra nada ni se conecta a ningún bróker.',
  'hlp.q.stop': '¿Qué es el riesgo al stop?',
  'hlp.a.stop': 'El stop es el precio al que venderías para cortar una pérdida. El riesgo al stop es lo que perderías si el precio llega ahí: (entrada − stop) × unidades.\n\nTu regla de riesgo dice qué porcentaje de tu capital aceptas perder en una operación (1 % si no la cambias). Si no escribes un stop, la calculadora usa uno estimado, 8 % bajo la entrada.',
  'hlp.q.cash': '¿Qué es el efectivo?',
  'hlp.a.cash': 'Es el saldo de los depósitos, retiros y operaciones que registras en Portafolio › Movimientos. Los depósitos lo suben y los retiros lo bajan; una compra lo baja y una venta o un dividendo lo sube cuando eliges que pase por tu efectivo.\n\n"Total aportado" son tus depósitos menos tus retiros, más las compras que registraste fuera del efectivo. No es el saldo de tu banco ni de tu bróker: es lo que registras aquí.',
  'hlp.q.tramos': '¿Cómo funcionan los aportes por tramos?',
  'hlp.a.tramos': 'En Planificar › Tus tramos, «Repartir mi capital» reparte un monto entre tus activos y divide la parte de cada uno en 4 tramos, uno por media móvil (20, 50, 100 y 200 días). Por defecto, 10/15/25/50 %.\n\nUn tramo se cumple hoy si el precio está en o bajo su media y, con la condición de RSI encendida (por defecto), si el RSI de 14 días está entre 30 y 45. Es un cálculo con tus propias reglas, no una recomendación de inversión.',

  'hlp.g.alerts': 'Alertas de precio',
  'hlp.q.alertsHow': '¿Cómo funcionan las alertas?',
  'hlp.a.alertsHow': 'En Siguiendo › Alertas eliges un activo y cuándo quieres el aviso: si sube hasta un precio, si baja hasta un precio o si se mueve en el día cierto porcentaje.\n\nLas alertas se guardan en tu cuenta y el servidor las revisa cada 15 minutos aproximadamente, así que te avisan aunque la app esté cerrada, si activaste los avisos en ese dispositivo (en Siguiendo › Alertas o en Ajustes › Inversiones). Cada alerta avisa como máximo una vez al día. Los avisos en tus dispositivos necesitan una licencia activa de moyiq; sin ella, las alertas igual se guardan y en la app ves cuáles se cumplen.',
  'hlp.q.alertsOld': '¿Dónde están las alertas que tenía en invest.moyiq.app?',
  'hlp.a.alertsOld': 'No se trasladaron. En la versión anterior las alertas vivían solo en el navegador donde las creaste, no en tu cuenta, así que no hay de dónde traerlas.\n\nVuelve a crearlas en Siguiendo › Alertas; desde ahora quedan en tu cuenta. Si tienes un archivo de alertas exportado (.json), puedes elegirlo ahí mismo.',

  'hlp.g.account': 'Tu cuenta y tus datos',
  'hlp.q.where': '¿Dónde se guardan mis datos de Inversiones?',
  'hlp.a.where': 'En tu cuenta, en nuestro servidor, no en el dispositivo: tus posiciones, movimientos, los activos que sigues, alertas y capital de referencia, además de tu perfil de inversionista, tu regla de riesgo y tus planes guardados. Solo tú, con tu sesión iniciada, puedes verlos o cambiarlos.\n\nEn el dispositivo quedan solo las preferencias de vista, los totales que muestra Panorama y el aporte del mes. Los objetivos de Portafolio duran mientras la app está abierta; puedes llevarlos en la copia JSON.\n\nTus finanzas personales siguen en tu dispositivo, aparte de Inversiones. Solo salen de él si activas la sincronización; la Política de privacidad explica cómo se protege esa copia.\n\nEn Ajustes › Inversiones puedes exportar tus datos o eliminarlos. Eliminar la cuenta completa también los borra.',
  'hlp.q.ai': '¿Usa inteligencia artificial para recomendarme inversiones?',
  'hlp.a.ai': 'No. Inversiones no usa IA ni tu perfil de inversionista para recomendarte qué comprar o vender. Los indicadores y las lecturas son cálculos fijos sobre precios históricos, los mismos para todas las personas. Las decisiones son tuyas.',
  'hlp.q.free': '¿Cuánto cuesta?',
  'hlp.a.free': 'Nada: Inversiones es gratis. Solo los avisos de alertas en tus dispositivos necesitan una licencia activa de moyiq.\n\nEs una herramienta educativa: muestra datos y cálculos, no es asesoría financiera.',

  'hlp.contact': '¿Otra pregunta? Escríbenos a {email}.',
  'hlp.foot': 'moyiq · Inversiones · análisis educativo · no es asesoría financiera.',
}
