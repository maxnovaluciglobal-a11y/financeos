// Cobertura del webhook de Stripe — el único código que emite licencias
// pagas (ver PLAN_REMEDIACION_TECNICA_CARLOS_FINANCEOS.md, punto 2). Antes de
// esto, cero tests; cada cambio se probaba en producción con dinero real.
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  verifyStripeSignature, generateKey, planFromAmount, planFromSession, isTestModeCheckout, shouldSkipCheckout,
  extractPaymentIntent, issueLicense, sessionAlreadyProcessed, revokeLicense, sendKeyEmail,
  notifyKeyDeliveryFailure,
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

  it('salta si el monto pagado es $0', () => {
    expect(shouldSkipCheckout({ payment_status: 'paid', amount_total: 0 })).toBe(true)
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
    it('llama al RPC con los params correctos y no lanza si Supabase responde ok', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      await issueLicense('FNOS-AAAA-BBBB-CCCC', 'pro', 'a@b.com', 'sess_1', 'pi_1', CONFIG)
      expect(fetchMock).toHaveBeenCalledWith(
        `${CONFIG.supabaseUrl}/rest/v1/rpc/issue_license`,
        expect.objectContaining({ method: 'POST' }),
      )
      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body).toEqual({ p_key: 'FNOS-AAAA-BBBB-CCCC', p_plan: 'pro', p_email: 'a@b.com', p_session: 'sess_1', p_payment_intent: 'pi_1' })
    })

    it('lanza si Supabase responde error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }))
      await expect(issueLicense('K', 'personal', null, null, null, CONFIG)).rejects.toThrow('issue_license failed')
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
})
