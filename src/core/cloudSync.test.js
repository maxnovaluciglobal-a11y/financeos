// Candado del stub cloudSync (auditoría 360, ING-3): aunque se prenda
// CLOUD_ENABLED, no sube datos sin cifrar mientras CLOUD_ENCRYPTION_READY sea false.
import { describe, it, expect, vi } from 'vitest'

const upsert = vi.fn()
vi.mock('./supabase.js', () => ({
  CLOUD_ENABLED: true,
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    from: () => ({ upsert }),
  },
}))
vi.mock('./db/index.js', () => ({ exportAllData: async () => ({ expenses: [{ amount: 1 }] }) }))

const { cloudPush } = await import('./cloudSync.js')

describe('cloudSync (stub v2.0)', () => {
  it('cloudPush falla fuerte y no llama a la base', async () => {
    await expect(cloudPush()).rejects.toThrow(/cifrado/)
    expect(upsert).not.toHaveBeenCalled()
  })
})
