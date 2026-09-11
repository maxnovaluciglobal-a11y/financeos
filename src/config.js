// ─────────────────────────────────────────────────────────────────────────────
// FinanceOS — config.js
// Archivo de configuración centralizado para licencias Pro y Enterprise.
// ESTE es el único archivo que necesitas editar para personalizar la app.
// No toques ningún otro archivo a menos que quieras cambiar lógica de negocio.
// ─────────────────────────────────────────────────────────────────────────────

const config = {

  // ── IDENTIDAD ──────────────────────────────────────────────────────────────
  // Rebranding MOY IQ: mergeado y en producción (10-sep-2026). Falta búsqueda
  // de marca paga confirmada (alcance legal, no de código) — ver memoria
  // financeos_renaming_moy_ronda. Walter compró moyiq.app el 11-sep sin
  // esperar esa confirmación. moyiq.app es ahora el dominio PRIMARIO (11-sep):
  // DNS + hosting en Vercel (app./demo. incluidos) + Resend para envío.
  // financeospro.com sigue funcionando (mismo deploy, alias vigente) — no se
  // agregó redirect 301, es decisión aparte si se quiere más adelante.
  app: {
    name:        'MOY IQ',              // Nombre que aparece en sidebar y título
    tagline:     'Tu dinero, bajo control total',
    version:     '1.5.0',
    supportEmail:'support@moyiq.app',  // Aparece en Ajustes > soporte
    website:     'https://www.moyiq.app',
    logoText:    'MI',                  // Iniciales para favicon SVG si no hay imagen
  },

  // ── DEFAULTS DEL USUARIO ───────────────────────────────────────────────────
  defaults: {
    currency:            'CLP',   // 'CLP' | 'USD' | 'EUR' | 'VES' | 'MXN' | 'ARS' | 'COP'
    language:            'es',    // 'es' | 'en'
    theme:               'light', // 'light' | 'dark'
    savingGoalPct:       25,      // % de ingreso como meta de ahorro (1-100)
    emergencyFundMonths: 5,       // Meses de gastos como fondo de emergencia
  },

  // ── MONEDAS DISPONIBLES ────────────────────────────────────────────────────
  // Agrega o elimina monedas según tu mercado objetivo.
  currencies: [
    { code: 'CLP', label: 'CLP — Peso chileno',     symbol: '$'   },
    { code: 'USD', label: 'USD — Dólar',             symbol: 'US$' },
    { code: 'EUR', label: 'EUR — Euro',              symbol: '€'   },
    { code: 'VES', label: 'VES — Bolívar',           symbol: 'Bs.' },
    { code: 'MXN', label: 'MXN — Peso mexicano',    symbol: '$'   },
    { code: 'ARS', label: 'ARS — Peso argentino',   symbol: '$'   },
    { code: 'COP', label: 'COP — Peso colombiano',  symbol: '$'   },
    { code: 'PEN', label: 'PEN — Sol peruano',       symbol: 'S/.' },
  ],

  // ── CATEGORÍAS DE INGRESOS ─────────────────────────────────────────────────
  // Personaliza para tu audiencia. Ej: si tus clientes son freelancers,
  // agrega 'Proyecto web', 'Consultoría', etc.
  categoriesIncome: [
    'Salario',
    'Freelance',
    'Inversión',
    'Arriendo',
    'Bono',
    'Pensión',
    'Negocio propio',
    'Otro',
  ],

  // ── CATEGORÍAS DE GASTOS ───────────────────────────────────────────────────
  categoriesExpense: [
    'Vivienda',
    'Alimentación',
    'Transporte',
    'Salud',
    'Educación',
    'Entretención',
    'Servicios',
    'Ropa',
    'Tecnología',
    'Mascota',
    'Inversión',
    'Propiedad',
    'Otros',
  ],

  // ── COLORES POR CATEGORÍA ──────────────────────────────────────────────────
  // Asigna un color hex a cada categoría. Si una categoría no tiene color
  // asignado aquí, usa el fallback '#888780'.
  // Paleta derivada de la familia de marca MOY IQ (navy/latón/verde/ceniza +
  // variantes) — cosmético, sin relación con datos financieros reales.
  categoryColors: {
    Vivienda:        '#14213D',   // navy
    Alimentación:    '#5FA98C',   // verde
    Transporte:      '#B8863B',   // laton
    Salud:           '#5B7A99',   // info
    Educación:       '#8B7A55',   // ceniza
    Entretención:    '#A23E2E',   // error
    Servicios:       '#356E57',   // verde-800
    Ropa:            '#C97A3D',   // warning
    Tecnología:      '#4A5875',   // navy-400
    Mascota:         '#8A6329',   // laton-700
    Propiedad:       '#3E5A78',   // info-800
    Otros:           '#5F5236',   // ceniza-700
    Salario:         '#14213D',
    Freelance:       '#5B7A99',
    Inversión:       '#8B7A55',
    Arriendo:        '#B8863B',
    Bono:            '#5FA98C',
    Pensión:         '#5F5236',
    'Negocio propio':'#356E57',
  },

  // ── EMOJIS POR CATEGORÍA (opcional) ────────────────────────────────────────
  // Se muestran junto al nombre en chips de captura rápida para hacer el
  // registro más ágil y amigable (inspirado en apps de gastos LATAM). Si una
  // categoría no tiene emoji, simplemente se muestra el nombre sin icono.
  categoryEmojis: {
    Vivienda:        '🏠',
    Alimentación:    '🛒',
    Transporte:      '🚗',
    Salud:           '⚕️',
    Educación:       '📚',
    Entretención:    '🎬',
    Servicios:       '💡',
    Ropa:            '👕',
    Tecnología:      '💻',
    Mascota:         '🐾',
    Propiedad:       '🏢',
    Inversión:       '📈',
    Otros:           '📦',
    Salario:         '💼',
    Freelance:       '🧑‍💻',
    Arriendo:        '🔑',
    Bono:            '🎁',
    Pensión:         '🏦',
    'Negocio propio':'🏪',
  },

  // ── MÉTODOS DE PAGO ────────────────────────────────────────────────────────
  paymentMethods: [
    'Débito',
    'Crédito',
    'Efectivo',
    'Transferencia',
    'Billetera digital',
  ],

  // ── RECURRENCIAS ───────────────────────────────────────────────────────────
  recurrences: [
    'Único',
    'Semanal',
    'Quincenal',
    'Mensual',
    'Anual',
  ],

  // ── COLORES DE LA APP (BRAND) ──────────────────────────────────────────────
  // Para cambiar el color primario (verde por defecto), edita estos valores.
  // Luego copia los mismos valores en src/styles/globals.css → :root
  // para que afecten también los estilos CSS que no usan este config.
  brand: {
    primary:      '#14213D', // Navy — color principal (sidebar activo, estructura)
    primaryLight: 'rgba(20,33,61,0.07)', // Fondo claro del color principal
    primaryMid:   '#B8863B', // Latón — acento de CTAs, barras destacadas
  },

  // ── FEATURES ON/OFF ────────────────────────────────────────────────────────
  // Activa o desactiva módulos según el plan que estás vendiendo.
  features: {
    budgets:      true,  // Módulo de presupuestos
    debts:        true,  // Módulo de deudas
    goals:        true,  // Módulo de metas
    reports:      true,  // Módulo de reportes
    exportCSV:    true,  // Botón exportar CSV
    exportJSON:   true,  // Botón exportar JSON
    importJSON:   true,  // Botón importar JSON
    darkMode:     true,  // Toggle de tema oscuro
    demoData:     true,  // Botón "Cargar demo" en Ajustes
    onboarding:   true,  // Pantalla de bienvenida al primer uso
  },

  // ── ONBOARDING ─────────────────────────────────────────────────────────────
  onboarding: {
    enabled:       true,
    welcomeTitle:  'Bienvenido a MOY IQ',
    welcomeText:   'Tus datos se guardan en este dispositivo. Cifrado de extremo a extremo, sin suscripciones.',
    steps: [
      { id: 'currency',    title: 'Elige tu moneda',         desc: '¿Con qué moneda trabajas día a día?' },
      { id: 'income',      title: 'Tu ingreso principal',    desc: '¿Cuánto recibes este mes?' },
      { id: 'goal',        title: 'Meta de ahorro',          desc: '¿Qué porcentaje quieres ahorrar?' },
    ],
  },

  // ── DISCLAIMER LEGAL ───────────────────────────────────────────────────────
  // Aparece en el footer de Ajustes y en los reportes.
  legalDisclaimer: 'Orientación general sobre finanzas personales. No constituye asesoría financiera, tributaria ni legal certificada. Consulta a un profesional para decisiones financieras importantes.',

  // ── PLAN / TIER (fallback para features gating) ───────────────────────────
  // El plan REAL viene de la licencia validada (usePlan → getLicensePlan()).
  // Esto es solo el fallback si no hay licencia cacheada. 'personal' | 'pro' | 'enterprise'
  plan: 'personal',

}

export default config
