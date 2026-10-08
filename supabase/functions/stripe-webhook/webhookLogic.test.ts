// Cobertura del webhook de Stripe — el único código que emite licencias
// pagas (ver PLAN_REMEDIACION_TECNICA_CARLOS_FINANCEOS.md, punto 2). Antes de
// esto, cero tests; cada cambio se probaba en producción con dinero real.
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  verifyStripeSignature, generateKey, planFromAmount, planFromSession, isTestModeCheckout, shouldSkipCheckout,
  extractPaymentIntent, issueLicense, sessionAlreadyProcessed, revokeLicense, sendKeyEmail,
  notifyKeyDeliveryFailure, notifyNewProPurchase, subscriptionIntervalFromSession, subscriptionIdFromSession,
  extendLicenseExpiry, periodEndFromInvoice,
  checkoutSkipReason, isTrialCheckout, initialExpiryFromSession, subscriptionIdFromInvoice, PAYMENT_LINK_PLAN,
  TRIAL_LINK_MONTHLY_TODO, TRIAL_LINK_ANNUAL_TODO, TRIAL_DAYS, revokeLicenseBySubscription, claimWebhookEvent,
  handleInvoicePaid, handleSubscriptionDeleted, handleTrialWillEnd, handleInvoicePaymentFailed,
  trialBillingFromSubscription, trialBillingFromSession, sendTrialEndingEmail, formatDateEs,
  notifyUnmappedTrialCheckout,
} from './webhookLogic.ts'

const CONFIG = { supabaseUrl: 'https://proj.supabase.co', serviceRole: 'srv-key', resendApiKey: 're_key', fromEmail: 'a@b.com', alertEmail: 'admin@x.com' }

async function signPayload(secret: string, rawBody: string, t: number) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${rawBody}`))
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('verifyStripeSignature — vectores conocidos', () => {
  const secret = 'whsec_test123'
  const rawBody = '{"type":"checkout.session.completed"}'

  it('acepta una firma válida con el secret correcto', async () => {
    const t = Math.floor(Date.now() / 1000)
    const v1 = await signPayload(secret, rawBody, t)
    expect(await verifyStripeSignature(rawBody, `t=${t},v1=${v1}`, [secret])).toBe(true)
  })

  it('rechaza si el secret no matchea', async () => {
    const t = Math.floor(Date.now() / 1000)
    const v1 = await signPayload('otro-secret', rawBody, t)
    expect(await verifyStripeSignature(rawBody, `t=${t},v1=${v1}`, [secret])).toBe(false)
  })

  it('rechaza un timestamp fuera de la tolerancia de replay (5 min)', async () => {
    const tOld = Math.floor(Date.now() / 1000) - 301
    const v1 = await signPayload(secret, rawBody, tOld)
    expect(await verifyStripeSignature(rawBody, `t=${tOld},v1=${v1}`, [secret])).toBe(false)
  })

  it('acepta un timestamp justo dentro de la tolerancia (300s)', async () => {
    const t = Math.floor(Date.now() / 1000) - 300
    const v1 = await signPayload(secret, rawBody, t)
    expect(await verifyStripeSignature(rawBody, `t=${t},v1=${v1}`, [secret])).toBe(true)
  })

  it('rechaza un header sin t= o sin v1=', async () => {
    expect(await verifyStripeSignature(rawBody, 'v1=abc', [secret])).toBe(false)
    expect(await verifyStripeSignature(rawBody, 't=123', [secret])).toBe(false)
  })

  it('rechaza sigHeader vacío o lista de secrets vacía', async () => {
    const t = Math.floor(Date.now() / 1000)
    const v1 = await signPayload(secret, rawBody, t)
    expect(await verifyStripeSignature(rawBody, '', [secret])).toBe(false)
    expect(await verifyStripeSignature(rawBody, `t=${t},v1=${v1}`, [])).toBe(false)
  })

  it('prueba contra varios secrets (test+live) y acepta si matchea el segundo', async () => {
    const t = Math.floor(Date.now() / 1000)
    const v1 = await signPayload('secret-live', rawBody, t)
    expect(await verifyStripeSignature(rawBody, `t=${t},v1=${v1}`, ['secret-test', 'secret-live'])).toBe(true)
  })
})

describe('generateKey', () => {
  it('tiene el formato FNOS-XXXX-XXXX-XXXX sin caracteres ambiguos (I,O,0,1)', () => {
    for (let i = 0; i < 50; i++) {
      const key = generateKey()
      expect(key).toMatch(/^FNOS-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
      // El prefijo literal "FNOS-" no es parte del charset aleatorio (y
      // contiene una O a propósito) — el chequeo de ambigüedad va solo sobre
      // los 12 caracteres generados.
      expect(key.slice(5)).not.toMatch(/[IO01]/)
    }
  })

  it('genera claves distintas entre llamadas', () => {
    const keys = new Set(Array.from({ length: 20 }, () => generateKey()))
    expect(keys.size).toBe(20)
  })
})

describe('planFromAmount', () => {
  it.each([
    [1900, 'personal'], [2399, 'personal'], [0, 'personal'], [null, 'personal'],
    [2400, 'pro'], [2900, 'pro'],
  ])('%i centavos → %s', (amount, expected) => {
    expect(planFromAmount(amount as number | null)).toBe(expected)
  })
})

describe('planFromSession — clasifica por Payment Link real, con fallback a monto', () => {
  it('Payment Link real de Personal → personal, sin importar el monto', () => {
    expect(planFromSession({ payment_link: 'plink_1TsMlSRxn4y6AU3r6CkGfuhO', amount_total: 999999 })).toBe('personal')
  })

  it('Payment Link real de Pro → pro, sin importar el monto', () => {
    expect(planFromSession({ payment_link: 'plink_1TsMlpRxn4y6AU3rcPN5urIw', amount_total: 1 })).toBe('pro')
  })

  it('Payment Link desconocido cae al umbral de monto (fallback)', () => {
    expect(planFromSession({ payment_link: 'plink_no_registrado', amount_total: 2900 })).toBe('pro')
    expect(planFromSession({ payment_link: 'plink_no_registrado', amount_total: 1900 })).toBe('personal')
  })

  it('sin payment_link (checkout fuera de Payment Links) cae al umbral de monto', () => {
    expect(planFromSession({ amount_total: 2400 })).toBe('pro')
    expect(planFromSession({ amount_total: 0 })).toBe('personal')
  })

  it('Payment Links de suscripción (mensual/anual) → pro, agregados 2026-09-11', () => {
    expect(planFromSession({ payment_link: 'plink_1UEfHBRxn4y6AU3r2Cd9SAmi', amount_total: 499 })).toBe('pro')
    expect(planFromSession({ payment_link: 'plink_1UEfI7Rxn4y6AU3rgSX3eaOQ', amount_total: 3999 })).toBe('pro')
  })
})

describe('subscriptionIntervalFromSession', () => {
  it('month para el Payment Link de Pro mensual', () => {
    expect(subscriptionIntervalFromSession({ payment_link: 'plink_1UEfHBRxn4y6AU3r2Cd9SAmi' })).toBe('month')
  })
  it('year para el Payment Link de Pro anual', () => {
    expect(subscriptionIntervalFromSession({ payment_link: 'plink_1UEfI7Rxn4y6AU3rgSX3eaOQ' })).toBe('year')
  })
  it('null para pago único o sin payment_link (no es una suscripción)', () => {
    expect(subscriptionIntervalFromSession({ payment_link: 'plink_1TsMlpRxn4y6AU3rcPN5urIw' })).toBeNull()
    expect(subscriptionIntervalFromSession({})).toBeNull()
  })
})

describe('subscriptionIdFromSession', () => {
  it('devuelve el string directo', () => {
    expect(subscriptionIdFromSession({ subscription: 'sub_123' })).toBe('sub_123')
  })
  it('devuelve el .id de un objeto expandido', () => {
    expect(subscriptionIdFromSession({ subscription: { id: 'sub_456' } })).toBe('sub_456')
  })
  it('null si no hay subscription (checkout de pago único)', () => {
    expect(subscriptionIdFromSession({})).toBeNull()
    expect(subscriptionIdFromSession({ subscription: null })).toBeNull()
  })
})

describe('periodEndFromInvoice', () => {
  it('convierte lines.data[0].period.end (unix seconds) a ISO', () => {
    expect(periodEndFromInvoice({ lines: { data: [{ period: { end: 1735689600 } }] } }))
      .toBe(new Date(1735689600 * 1000).toISOString())
  })
  it('null si la invoice no trae period.end (forma inesperada, no debe romper el webhook)', () => {
    expect(periodEndFromInvoice({})).toBeNull()
    expect(periodEndFromInvoice({ lines: { data: [] } })).toBeNull()
  })
})

describe('isTestModeCheckout — guard de livemode', () => {
  it('ignora checkout.session.completed en modo test', () => {
    expect(isTestModeCheckout({ type: 'checkout.session.completed', livemode: false })).toBe(true)
  })

  it('ignora checkout.session.async_payment_succeeded en modo test (regresión del 2026-09-01)', () => {
    expect(isTestModeCheckout({ type: 'checkout.session.async_payment_succeeded', livemode: false })).toBe(true)
  })

  it('NO ignora un checkout real (livemode true)', () => {
    expect(isTestModeCheckout({ type: 'checkout.session.completed', livemode: true })).toBe(false)
  })

  it('no aplica a eventos que no son de checkout', () => {
    expect(isTestModeCheckout({ type: 'charge.refunded', livemode: false })).toBe(false)
  })
})

describe('shouldSkipCheckout', () => {
  it('salta si no está pagado', () => {
    expect(shouldSkipCheckout({ payment_status: 'unpaid', amount_total: 2900 })).toBe(true)
  })

  it('YA NO salta un pago real por debajo de US$19 — precio regional (fix 2026-09-11, ver planFromSession)', () => {
    expect(shouldSkipCheckout({ payment_status: 'paid', amount_total: 999 })).toBe(false)
  })

  it('no salta con el mínimo exacto pagado', () => {
    expect(shouldSkipCheckout({ payment_status: 'paid', amount_total: 1900 })).toBe(false)
  })

  // T10 (2026-10-08): este test fijaba "todo $0 se descarta", que es justo lo
  // que impedía emitir la licencia de una prueba de Pro (amount_total=0,
  // payment_status 'paid'). Se acota a propósito: un $0 de pago único (sin
  // mode 'subscription') se sigue descartando; la prueba de un Payment Link
  // conocido ya no — ver el describe "T10 · checkout de prueba" más abajo.
  it('salta si el monto pagado es $0 en un pago único (no suscripción)', () => {
    expect(shouldSkipCheckout({ payment_status: 'paid', amount_total: 0 })).toBe(true)
    expect(shouldSkipCheckout({ payment_status: 'paid', amount_total: 0, mode: 'payment' })).toBe(true)
  })

  it('salta si falta amount_total (trata como 0)', () => {
    expect(shouldSkipCheckout({ payment_status: 'paid' })).toBe(true)
  })
})

describe('extractPaymentIntent', () => {
  it('devuelve el string directo', () => {
    expect(extractPaymentIntent({ payment_intent: 'pi_123' })).toBe('pi_123')
  })
  it('devuelve el .id de un objeto expandido', () => {
    expect(extractPaymentIntent({ payment_intent: { id: 'pi_456' } })).toBe('pi_456')
  })
  it('devuelve null si no hay payment_intent', () => {
    expect(extractPaymentIntent({})).toBeNull()
    expect(extractPaymentIntent({ payment_intent: null })).toBeNull()
  })
})

describe('llamadas HTTP (fetch mockeado)', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  describe('issueLicense', () => {
    it('llama al RPC con los params correctos (sin subscriptionId, pago único) y no lanza si Supabase responde ok', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      await issueLicense('FNOS-AAAA-BBBB-CCCC', 'pro', 'a@b.com', 'sess_1', 'pi_1', CONFIG)
      expect(fetchMock).toHaveBeenCalledWith(
        `${CONFIG.supabaseUrl}/rest/v1/rpc/issue_license`,
        expect.objectContaining({ method: 'POST' }),
      )
      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body).toEqual({ p_key: 'FNOS-AAAA-BBBB-CCCC', p_plan: 'pro', p_email: 'a@b.com', p_session: 'sess_1', p_payment_intent: 'pi_1', p_subscription: null })
    })

    it('incluye p_subscription cuando es una suscripción (2026-09-11)', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      await issueLicense('FNOS-AAAA-BBBB-CCCC', 'pro', 'a@b.com', 'sess_1', null, CONFIG, 'sub_1')
      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.p_subscription).toBe('sub_1')
    })

    it('lanza si Supabase responde error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }))
      await expect(issueLicense('K', 'personal', null, null, null, CONFIG)).rejects.toThrow('issue_license failed')
    })
  })

  describe('extendLicenseExpiry (renovación de suscripción, 2026-09-11)', () => {
    it('llama al RPC con subscription y expires_at, no lanza si Supabase responde ok', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      const iso = new Date('2026-10-12T00:00:00.000Z').toISOString()
      await extendLicenseExpiry('sub_1', iso, CONFIG)
      expect(fetchMock).toHaveBeenCalledWith(
        `${CONFIG.supabaseUrl}/rest/v1/rpc/extend_license_expiry`,
        expect.objectContaining({ method: 'POST' }),
      )
      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body).toEqual({ p_subscription: 'sub_1', p_expires_at: iso })
    })

    it('devuelve updated/pending de la RPC nueva (migración 20261008000000) y tolera el cuerpo vacío de la vieja', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, updated: 0, pending: true }) }))
      expect(await extendLicenseExpiry('sub_1', '2026-10-12T00:00:00.000Z', CONFIG)).toEqual({ updated: 0, pending: true })
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error('empty') } }))
      expect(await extendLicenseExpiry('sub_1', '2026-10-12T00:00:00.000Z', CONFIG)).toEqual({ updated: null, pending: false })
    })

    it('lanza si Supabase responde error (el handler en index.ts debe devolver 500 para que Stripe reintente)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }))
      await expect(extendLicenseExpiry('sub_1', '2026-10-12T00:00:00.000Z', CONFIG)).rejects.toThrow('extend_license_expiry failed')
    })
  })

  describe('sessionAlreadyProcessed', () => {
    it('true si ya hay una fila con ese session id', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ key_hash: 'x' }] }))
      expect(await sessionAlreadyProcessed('sess_1', CONFIG)).toBe(true)
    })
    it('false si no hay ninguna fila', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))
      expect(await sessionAlreadyProcessed('sess_1', CONFIG)).toBe(false)
    })
    it('false (no bloquea la emisión) si el chequeo mismo falla', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'down' }))
      expect(await sessionAlreadyProcessed('sess_1', CONFIG)).toBe(false)
    })
  })

  describe('revokeLicense', () => {
    it('devuelve el resultado de la RPC si responde ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }))
      expect(await revokeLicense('pi_1', CONFIG)).toEqual({ ok: true })
    })
    it('devuelve {ok:false} sin lanzar si la RPC falla', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => 'not found' }))
      expect(await revokeLicense('pi_1', CONFIG)).toEqual({ ok: false, error: 'http_404' })
    })
  })

  describe('sendKeyEmail', () => {
    it('devuelve false sin llamar a fetch si no hay RESEND_API_KEY', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const result = await sendKeyEmail('a@b.com', 'FNOS-X', 'pro', 'sess_1', { ...CONFIG, resendApiKey: undefined })
      expect(result).toBe(false)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('true en el primer intento si Resend responde ok', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      expect(await sendKeyEmail('a@b.com', 'FNOS-X', 'pro', 'sess_1', CONFIG)).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('reintenta una vez si el primer intento falla, y cuenta como éxito si el segundo funciona', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'timeout' })
        .mockResolvedValueOnce({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      expect(await sendKeyEmail('a@b.com', 'FNOS-X', 'pro', 'sess_1', CONFIG)).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('false si fallan ambos intentos', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'down' })
      vi.stubGlobal('fetch', fetchMock)
      expect(await sendKeyEmail('a@b.com', 'FNOS-X', 'pro', 'sess_1', CONFIG)).toBe(false)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('sin interval (pago único) no menciona renovación ni cancelación', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      await sendKeyEmail('a@b.com', 'FNOS-X', 'pro', 'sess_1', CONFIG)
      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.html).not.toContain('renovación')
    })

    it('con interval month/year avisa la renovación automática y cómo cancelar (2026-09-11)', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      await sendKeyEmail('a@b.com', 'FNOS-X', 'pro', 'sess_1', CONFIG, 'month')
      const bodyMonth = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(bodyMonth.html).toContain('renovación automática mensual')
      expect(bodyMonth.html).toContain('support@moyiq.app')

      await sendKeyEmail('a@b.com', 'FNOS-X', 'pro', 'sess_1', CONFIG, 'year')
      const bodyYear = JSON.parse(fetchMock.mock.calls[1][1].body)
      expect(bodyYear.html).toContain('renovación automática anual')
    })

    it('usa la voz del producto: sin voseo, sin exclamaciones y sin emoji (B4, 2026-10-07)', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      await sendKeyEmail('a@b.com', 'FNOS-X', 'pro', 'sess_1', CONFIG, 'month')
      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      const text = `${body.subject} ${body.html}`
      expect(text).not.toMatch(/escribinos|podés|tenés|activá/i)
      expect(text).not.toMatch(/[¡!]/)
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u)
      expect(body.html).toContain('FNOS-X')
    })
  })

  describe('notifyKeyDeliveryFailure', () => {
    const details = { sessionRef: 'sess_1', email: 'cliente@x.com', plan: 'pro', paymentIntent: 'pi_1' }

    it('manda el email de alerta a config.alertEmail con los datos del caso', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      await notifyKeyDeliveryFailure(details, CONFIG)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.to).toBe(CONFIG.alertEmail)
      expect(body.html).toContain('sess_1')
      expect(body.html).toContain('cliente@x.com')
      expect(body.html).toContain('pi_1')
    })

    it('no hace nada (sin llamar a fetch) si falta resendApiKey o alertEmail', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      await notifyKeyDeliveryFailure(details, { ...CONFIG, alertEmail: undefined })
      await notifyKeyDeliveryFailure(details, { ...CONFIG, resendApiKey: undefined })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('no lanza si Resend responde error (best-effort, no debe tumbar el webhook)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'down' }))
      await expect(notifyKeyDeliveryFailure(details, CONFIG)).resolves.toBeUndefined()
    })

    it('no lanza si fetch mismo rechaza (fallo de red)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
      await expect(notifyKeyDeliveryFailure(details, CONFIG)).resolves.toBeUndefined()
    })
  })

  describe('notifyNewProPurchase', () => {
    const details = { email: 'cliente@x.com', plan: 'pro', interval: 'month' }

    it('manda el email de alerta a config.alertEmail con los datos de la venta', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      await notifyNewProPurchase(details, CONFIG)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.to).toBe(CONFIG.alertEmail)
      expect(body.subject).toBe('MOY IQ: nueva compra Pro')
      expect(body.html).toContain('cliente@x.com')
      expect(body.html).toContain('month')
    })

    it('pago único (interval null) no rompe', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      await notifyNewProPurchase({ ...details, interval: null }, CONFIG)
      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.html).toContain('pago único')
    })

    it('no hace nada si falta resendApiKey o alertEmail', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      await notifyNewProPurchase(details, { ...CONFIG, alertEmail: undefined })
      await notifyNewProPurchase(details, { ...CONFIG, resendApiKey: undefined })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('no lanza si Resend o la red fallan (best-effort)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'down' }))
      await expect(notifyNewProPurchase(details, CONFIG)).resolves.toBeUndefined()
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
      await expect(notifyNewProPurchase(details, CONFIG)).resolves.toBeUndefined()
    })
  })
})


// ── T10 · prueba de Pro por 14 días CON tarjeta (2026-10-08) ────────────────
// Un Payment Link "conocido" para estos tests: el de Pro mensual real (cuenta
// propia MOY IQ). Los de prueba (TRIAL_LINK_*) siguen en null hasta que
// Walter pegue los ids, así que no se pueden usar acá.
const KNOWN_SUB_LINK = 'plink_1UEgvJ2L52ZuuTMr1Agq0t4b' // Pro mensual
const KNOWN_ANNUAL_LINK = 'plink_1UEgve2L52ZuuTMrdS1OE9fh' // Pro anual
const CREATED = 1791504000 // 2026-10-09T00:00:00Z
const trialSession = (over = {}) => ({
  id: 'cs_trial', mode: 'subscription', payment_status: 'paid', amount_total: 0,
  payment_link: KNOWN_SUB_LINK, subscription: 'sub_trial', created: CREATED, currency: 'usd', ...over,
})

describe('T10 · checkout de prueba', () => {
  it('los links de prueba siguen sin pegar: no se inventaron ids', () => {
    expect(TRIAL_LINK_MONTHLY_TODO).toBeNull()
    expect(TRIAL_LINK_ANNUAL_TODO).toBeNull()
    expect(Object.keys(PAYMENT_LINK_PLAN)).toHaveLength(6)
    expect(TRIAL_DAYS).toBe(14)
  })

  it('prueba con monto 0 de un link conocido NO se descarta y resuelve a Pro', () => {
    const s = trialSession()
    expect(checkoutSkipReason(s)).toBeNull()
    expect(shouldSkipCheckout(s)).toBe(false)
    expect(isTrialCheckout(s)).toBe(true)
    expect(planFromSession(s)).toBe('pro')
  })

  it('prueba con monto 0 → expires_at = created + 14 días (nunca NULL)', () => {
    expect(initialExpiryFromSession(trialSession())).toBe('2026-10-23T00:00:00.000Z')
  })

  it('$0 de un link desconocido se sigue descartando, como antes (posible producto ajeno o link sin pegar)', () => {
    const s = trialSession({ payment_link: 'plink_desconocido' })
    expect(checkoutSkipReason(s)).toBe('zero_amount_unknown_link')
    expect(shouldSkipCheckout(s)).toBe(true)
    expect(checkoutSkipReason(trialSession({ payment_link: null }))).toBe('zero_amount_unknown_link')
  })

  it('un link desconocido CON monto sigue el fallback de siempre (planFromAmount), sin cambios', () => {
    const s = { mode: 'subscription', payment_status: 'paid', amount_total: 2900, payment_link: 'plink_desconocido' }
    expect(shouldSkipCheckout(s)).toBe(false)
    expect(planFromSession(s)).toBe('pro')
    expect(planFromSession({ ...s, amount_total: 499 })).toBe('personal')
  })

  it('una sesión de prueba sin pagar (unpaid) se descarta igual', () => {
    expect(checkoutSkipReason(trialSession({ payment_status: 'unpaid' }))).toBe('unpaid')
    expect(checkoutSkipReason(trialSession({ payment_status: 'no_payment_required' }))).toBe('unpaid')
  })

  it('suscripción paga: expires_at inicial = created + 1 mes / 1 año; pago único: null', () => {
    expect(initialExpiryFromSession({ mode: 'subscription', payment_status: 'paid', amount_total: 499, payment_link: KNOWN_SUB_LINK, created: CREATED }))
      .toBe('2026-11-09T00:00:00.000Z')
    expect(initialExpiryFromSession({ mode: 'subscription', payment_status: 'paid', amount_total: 3999, payment_link: KNOWN_ANNUAL_LINK, created: CREATED }))
      .toBe('2027-10-09T00:00:00.000Z')
    expect(initialExpiryFromSession({ mode: 'payment', payment_status: 'paid', amount_total: 2900, created: CREATED })).toBeNull()
  })

  it('suscripción con intervalo desconocido: tope acotado de 35 días en vez de NULL', () => {
    expect(initialExpiryFromSession({ mode: 'subscription', payment_status: 'paid', amount_total: 999, payment_link: 'plink_x', created: CREATED }))
      .toBe('2026-11-13T00:00:00.000Z')
  })

  it('31 de enero + 1 mes = 28/29 de febrero (no se desborda a marzo)', () => {
    const jan31 = Date.UTC(2027, 0, 31) / 1000
    expect(initialExpiryFromSession({ mode: 'subscription', payment_status: 'paid', amount_total: 499, payment_link: KNOWN_SUB_LINK, created: jan31 }))
      .toBe('2027-02-28T00:00:00.000Z')
  })

  it('issueLicense manda p_expires_at para la prueba (y no lo manda en pago único)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const s = trialSession()
    await issueLicense('FNOS-AAAA-BBBB-CCCC', planFromSession(s), 'a@b.com', s.id, null, CONFIG, 'sub_trial', initialExpiryFromSession(s))
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({ p_plan: 'pro', p_subscription: 'sub_trial', p_expires_at: '2026-10-23T00:00:00.000Z' })

    await issueLicense('FNOS-AAAA-BBBB-DDDD', 'pro', 'a@b.com', 'cs_x', 'pi_x', CONFIG)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty('p_expires_at')
    vi.unstubAllGlobals()
  })
})

describe('T10 · subscriptionIdFromInvoice (API vieja y basil 2025-03-31)', () => {
  it('lee invoice.subscription (API anterior a basil)', () => {
    expect(subscriptionIdFromInvoice({ subscription: 'sub_old' })).toBe('sub_old')
    expect(subscriptionIdFromInvoice({ subscription: { id: 'sub_obj' } })).toBe('sub_obj')
  })
  it('lee invoice.parent.subscription_details.subscription (basil)', () => {
    expect(subscriptionIdFromInvoice({ parent: { subscription_details: { subscription: 'sub_basil' } } })).toBe('sub_basil')
  })
  it('cae a las líneas (parent.subscription_item_details o subscription) si la raíz no lo trae', () => {
    expect(subscriptionIdFromInvoice({ lines: { data: [{ parent: { subscription_item_details: { subscription: 'sub_line' } } }] } })).toBe('sub_line')
    expect(subscriptionIdFromInvoice({ lines: { data: [{ subscription: 'sub_line_old' }] } })).toBe('sub_line_old')
  })
  it('null si no hay suscripción (invoice suelta)', () => {
    expect(subscriptionIdFromInvoice({})).toBeNull()
  })
  it('periodEndFromInvoice toma el máximo entre líneas (prorrateo)', () => {
    expect(periodEndFromInvoice({ lines: { data: [{ period: { end: 100 } }, { period: { end: 200 } }] } }))
      .toBe(new Date(200 * 1000).toISOString())
  })
})

describe('T10 · eventos de suscripción (fetch mockeado)', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('carrera: invoice de $0 antes que el checkout → extend no lanza (pending) y el checkout igual emite con expires_at', async () => {
    const calls: Array<{ url: string; body: any }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      calls.push({ url, body: init?.body ? JSON.parse(init.body) : null })
      if (url.endsWith('/rpc/extend_license_expiry')) return { ok: true, json: async () => ({ ok: true, updated: 0, pending: true }) }
      return { ok: true, json: async () => ({}) }
    }))
    const trialEnd = Date.parse('2026-10-23T00:05:00Z') / 1000
    // 1) llega primero la invoice de $0 de la prueba (forma basil)
    const inv = { parent: { subscription_details: { subscription: 'sub_trial' } }, amount_paid: 0, lines: { data: [{ period: { end: trialEnd } }] } }
    const r = await handleInvoicePaid(inv, CONFIG)
    expect(r.status).toBe(200)
    expect(calls[0].body).toEqual({ p_subscription: 'sub_trial', p_expires_at: '2026-10-23T00:05:00.000Z' })
    // 2) después el checkout: la licencia se emite con expires_at propio, no NULL
    const s = trialSession()
    await issueLicense('FNOS-AAAA-BBBB-CCCC', 'pro', 'a@b.com', s.id, null, CONFIG, 'sub_trial', initialExpiryFromSession(s))
    expect(calls[1].body.p_expires_at).toBe('2026-10-23T00:00:00.000Z')
    expect(calls[1].body.p_expires_at).not.toBeNull()
  })

  it('invoice.payment_succeeded devuelve 500 si la RPC falla (Stripe reintenta)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }))
    const r = await handleInvoicePaid({ subscription: 'sub_1', lines: { data: [{ period: { end: 1 } }] } }, CONFIG)
    expect(r.status).toBe(500)
  })

  it('invoice sin suscripción se ignora sin llamar a Supabase', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect((await handleInvoicePaid({ lines: { data: [{ period: { end: 1 } }] } }, CONFIG)).status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('customer.subscription.deleted → llama a revoke_license_by_subscription con el id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, revoked: 1 }) })
    vi.stubGlobal('fetch', fetchMock)
    const r = await handleSubscriptionDeleted({ id: 'sub_trial', status: 'canceled' }, CONFIG)
    expect(r.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(`${CONFIG.supabaseUrl}/rest/v1/rpc/revoke_license_by_subscription`, expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ p_subscription_id: 'sub_trial' })
  })

  it('subscription.deleted de otro producto (not found) responde 200; fallo HTTP responde 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: 'not_found_or_already_revoked' }) }))
    expect((await handleSubscriptionDeleted({ id: 'sub_ajena' }, CONFIG)).status).toBe(200)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => 'down' }))
    expect((await handleSubscriptionDeleted({ id: 'sub_1' }, CONFIG)).status).toBe(500)
    expect(await revokeLicenseBySubscription('sub_1', CONFIG)).toEqual({ ok: false, error: 'http_503' })
  })

  it('invoice.payment_failed solo registra, no llama a nada', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(handleInvoicePaymentFailed({ subscription: 'sub_1', attempt_count: 1 }).status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  describe('customer.subscription.trial_will_end', () => {
    const trialEnd = Date.parse('2026-10-23T00:00:00Z') / 1000
    const event = (over = {}) => ({
      id: 'evt_twe_1', type: 'customer.subscription.trial_will_end',
      data: { object: { id: 'sub_trial', status: 'trialing', trial_end: trialEnd, currency: 'usd',
        items: { data: [{ quantity: 1, price: { unit_amount: 499, currency: 'usd', recurring: { interval: 'month' } } }] }, ...over } },
    })

    // Simula Supabase + Resend + la tabla webhook_events_processed con estado.
    function fakeBackend(opts: { claimFails?: boolean } = {}) {
      const processed = new Set<string>()
      const emails: any[] = []
      const fetchMock = vi.fn(async (url: string, init: any = {}) => {
        if (url.includes('/rest/v1/licenses?')) {
          return { ok: true, json: async () => [{ email: 'cliente@x.com', status: 'active', plan: 'pro' }] }
        }
        if (url.includes('/rest/v1/webhook_events_processed') && init.method === 'POST') {
          if (opts.claimFails) return { ok: false, status: 404, text: async () => 'relation does not exist' }
          const { event_id } = JSON.parse(init.body)
          if (processed.has(event_id)) return { ok: true, json: async () => [] }
          processed.add(event_id)
          return { ok: true, json: async () => [{ event_id }] }
        }
        if (url.includes('/rest/v1/webhook_events_processed') && init.method === 'DELETE') {
          processed.clear()
          return { ok: true }
        }
        if (url === 'https://api.resend.com/emails') {
          emails.push(JSON.parse(init.body))
          return { ok: true }
        }
        throw new Error(`fetch inesperado: ${url}`)
      })
      vi.stubGlobal('fetch', fetchMock)
      return { emails, processed }
    }

    it('manda el aviso una vez; la segunda entrega del mismo event id NO lo reenvía', async () => {
      const { emails } = fakeBackend()
      expect((await handleTrialWillEnd(event(), CONFIG)).status).toBe(200)
      const second = await handleTrialWillEnd(event(), CONFIG)
      expect(second.status).toBe(200)
      expect(second.body.ignored).toBe('already_sent')
      expect(emails).toHaveLength(1)
      expect(emails[0].to).toBe('cliente@x.com')
    })

    it('el aviso dice la fecha, el monto, el intervalo y cómo cancelar, con la voz del producto', async () => {
      const { emails } = fakeBackend()
      await handleTrialWillEnd(event(), CONFIG)
      const text = `${emails[0].subject} ${emails[0].html}`
      expect(text).toContain('23 de octubre de 2026')
      expect(text).toContain('US$ 4,99 al mes')
      expect(text).toContain('support@moyiq.app')
      expect(text).not.toMatch(/[¡!]/)
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u)
      expect(text).not.toMatch(/escribinos|podés|tenés|cancelá|querés/i)
    })

    it('incluye el Customer Portal solo si STRIPE_PORTAL_URL está configurado', async () => {
      const a = fakeBackend()
      await handleTrialWillEnd(event(), CONFIG)
      expect(a.emails[0].html).not.toContain('portal de facturación')
      vi.unstubAllGlobals()
      const b = fakeBackend()
      await handleTrialWillEnd(event({}), { ...CONFIG, portalUrl: 'https://billing.stripe.com/p/login/test_x' })
      expect(b.emails[0].html).toContain('https://billing.stripe.com/p/login/test_x')
    })

    it('fail-open: si la tabla de idempotencia no responde, el aviso se manda igual', async () => {
      const { emails } = fakeBackend({ claimFails: true })
      expect((await handleTrialWillEnd(event(), CONFIG)).status).toBe(200)
      expect(emails).toHaveLength(1)
    })

    it('no avisa si la suscripción ya está cancelada (no habrá cobro)', async () => {
      const { emails } = fakeBackend()
      await handleTrialWillEnd(event({ cancel_at_period_end: true }), CONFIG)
      expect(emails).toHaveLength(0)
    })

    it('suscripción sin licencia de MOY IQ (otro producto) → 200 sin email ni claim', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
      vi.stubGlobal('fetch', fetchMock)
      const r = await handleTrialWillEnd(event(), CONFIG)
      expect(r.body.ignored).toBe('not_moyiq_subscription')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('si Resend falla, libera el evento y responde 500 para que el reintento de Stripe lo mande', async () => {
      const deletes: string[] = []
      vi.stubGlobal('fetch', vi.fn(async (url: string, init: any = {}) => {
        if (url.includes('/rest/v1/licenses?')) return { ok: true, json: async () => [{ email: 'c@x.com', status: 'active' }] }
        if (url.includes('webhook_events_processed') && init.method === 'POST') return { ok: true, json: async () => [{ event_id: 'evt_twe_1' }] }
        if (url.includes('webhook_events_processed') && init.method === 'DELETE') { deletes.push(url); return { ok: true } }
        return { ok: false, status: 500, text: async () => 'resend down' }
      }))
      const r = await handleTrialWillEnd(event(), CONFIG)
      expect(r.status).toBe(500)
      expect(deletes).toHaveLength(1)
    })

    it('claimWebhookEvent: duplicate cuando el insert choca, claimed cuando inserta', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))
      expect(await claimWebhookEvent('evt_1', 't', CONFIG)).toBe('duplicate')
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ event_id: 'evt_1' }] }))
      expect(await claimWebhookEvent('evt_1', 't', CONFIG)).toBe('claimed')
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')))
      expect(await claimWebhookEvent('evt_1', 't', CONFIG)).toBe('unknown')
    })
  })

  it('trialBillingFromSubscription cae al precio de lista si el evento no trae precio', () => {
    expect(trialBillingFromSubscription({ trial_end: 1, items: { data: [{ price: { recurring: { interval: 'year' } } }] } }))
      .toMatchObject({ amountCents: 3999, interval: 'year' })
    expect(trialBillingFromSubscription({})).toBeNull()
  })

  it('sendTrialEndingEmail sin RESEND_API_KEY devuelve false sin llamar a fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await sendTrialEndingEmail('a@b.com', { endsAt: '2026-10-23T00:00:00Z', amountCents: 499, currency: 'usd', interval: 'month' }, { ...CONFIG, resendApiKey: undefined })).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('notifyUnmappedTrialCheckout avisa a ALERT_EMAIL con el payment_link', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await notifyUnmappedTrialCheckout({ sessionRef: 'cs_1', email: 'c@x.com', paymentLink: 'plink_nuevo' }, CONFIG)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.to).toBe(CONFIG.alertEmail)
    expect(body.html).toContain('plink_nuevo')
  })
})

describe('T10 · email de inicio de prueba (variante de sendKeyEmail)', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('una prueba NO dice "Compra confirmada": dice que empezó, cuándo termina y qué se cobrará', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const s = trialSession()
    const trial = trialBillingFromSession(s, initialExpiryFromSession(s)!)
    await sendKeyEmail('a@b.com', 'FNOS-X', 'pro', s.id, CONFIG, 'month', trial)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const text = `${body.subject} ${body.html}`
    expect(text).not.toContain('Compra confirmada')
    expect(body.subject).toBe('Tu prueba de MOY IQ Pro')
    expect(body.html).toContain('23 de octubre de 2026')
    expect(body.html).toContain('US$ 4,99 al mes')
    expect(body.html).toContain('FNOS-X')
    expect(body.html).toContain('support@moyiq.app')
    expect(text).not.toMatch(/[¡!]/)
    expect(text).not.toMatch(/escribinos|podés|tenés|activá|cancelá/i)
  })

  it('sin prueba, el email de compra no cambia', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await sendKeyEmail('a@b.com', 'FNOS-X', 'pro', 'cs_1', CONFIG, 'year')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.subject).toBe('Tu licencia de MOY IQ')
    expect(body.html).toContain('Compra confirmada')
    expect(body.html).toContain('renovación automática anual')
  })

  it('formatDateEs usa UTC', () => {
    expect(formatDateEs('2026-10-23T00:00:00.000Z')).toBe('23 de octubre de 2026')
  })
})

describe('idioma de los correos al cliente (licencia, prueba, fin de prueba)', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  const billing = { endsAt: '2026-10-23T00:00:00Z', amountCents: 499, currency: 'usd', interval: 'month' as const }

  async function capture(fn: () => Promise<unknown>) {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await fn()
    return JSON.parse(fetchMock.mock.calls[0][1].body)
  }

  it.each([
    ['en', 'Your MOY IQ license', 'Purchase confirmed', 'renews automatically every year'],
    ['pt', 'Sua licença do MOY IQ', 'Compra confirmada', 'renovação automática anual'],
    ['de', 'Ihre MOY IQ-Lizenz', 'Kauf bestätigt', 'verlängert sich automatisch jedes Jahr'],
  ] as const)('licencia en %s', async (lang, subject, purchase, renewal) => {
    const body = await capture(() => sendKeyEmail('a@b.com', 'FNOS-X', 'pro', 'cs_1', CONFIG, 'year', null, lang))
    expect(body.subject).toBe(subject)
    expect(body.html).toContain(purchase)
    expect(body.html).toContain(renewal)
    expect(body.html).toContain('FNOS-X')
    expect(body.html).toContain(`lang="${lang}"`)
  })

  it.each([
    ['en', 'Your MOY IQ Pro trial', 'October 23, 2026', '$4.99 per month'],
    ['pt', 'Seu teste do MOY IQ Pro', '23 de outubro de 2026', 'US$ 4,99 por mês'],
    ['de', 'Ihre Testphase von MOY IQ Pro', '23. Oktober 2026', '4,99 $ pro Monat'],
  ] as const)('inicio de prueba en %s: fecha y monto en su formato', async (lang, subject, date, amount) => {
    const body = await capture(() => sendKeyEmail('a@b.com', 'FNOS-X', 'pro', 'cs_1', CONFIG, 'month', billing, lang))
    expect(body.subject).toBe(subject)
    expect(body.html).toContain(date)
    expect(body.html.replace(/ /g, ' ')).toContain(amount)
  })

  it.each([
    ['es', 'Tu prueba de MOY IQ Pro termina pronto'],
    ['en', 'Your MOY IQ Pro trial ends soon'],
    ['pt', 'Seu teste do MOY IQ Pro termina em breve'],
    ['de', 'Ihre Testphase von MOY IQ Pro endet bald'],
  ] as const)('fin de prueba en %s', async (lang, subject) => {
    const body = await capture(() => sendTrialEndingEmail('a@b.com', billing, CONFIG, lang))
    expect(body.subject).toBe(subject)
  })

  it('sin idioma: español de siempre', async () => {
    const body = await capture(() => sendTrialEndingEmail('a@b.com', billing, CONFIG))
    expect(body.subject).toBe('Tu prueba de MOY IQ Pro termina pronto')
    expect(body.html).toContain('23 de octubre de 2026')
  })

  it('ningún correo con exclamaciones; el alemán no tutea', async () => {
    for (const lang of ['es', 'en', 'pt', 'de'] as const) {
      const a = await capture(() => sendKeyEmail('a@b.com', 'K', 'pro', 's', CONFIG, 'month', billing, lang))
      const b = await capture(() => sendTrialEndingEmail('a@b.com', billing, { ...CONFIG, portalUrl: 'https://billing.example' }, lang))
      const text = `${a.subject} ${a.html} ${b.subject} ${b.html}`
      expect(text).not.toMatch(/[¡!]/)
      if (lang === 'de') expect(text).not.toMatch(/\b(du|dein|deine|dich|dir)\b/i)
    }
  })

  it('handleTrialWillEnd usa el idioma de la suscripción (metadata/customer expandido)', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/rest/v1/licenses')) return { ok: true, json: async () => [{ email: 'c@d.com', status: 'active', plan: 'pro' }] }
      if (String(url).includes('webhook_events_processed')) return { ok: true, status: 201, json: async () => [{}], text: async () => '' }
      return { ok: true, json: async () => ({}), text: async () => '' }
    })
    vi.stubGlobal('fetch', fetchMock)
    const event = { id: 'evt_lang', data: { object: { id: 'sub_1', status: 'trialing', trial_end: 1792713600, metadata: { lang: 'en' }, items: { data: [{ price: { unit_amount: 499, currency: 'usd', recurring: { interval: 'month' } }, quantity: 1 }] } } } }
    await handleTrialWillEnd(event, CONFIG)
    const resendCall = fetchMock.mock.calls.find(c => String(c[0]).includes('api.resend.com'))
    expect(resendCall).toBeTruthy()
    expect(JSON.parse(resendCall![1].body).subject).toBe('Your MOY IQ Pro trial ends soon')
  })
})
