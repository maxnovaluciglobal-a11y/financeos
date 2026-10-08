import { describe, it, expect } from 'vitest'
import { autoSubscribeEnabled } from './newsletterSubscribe.ts'

describe('autoSubscribeEnabled', () => {
  it('solo "true" exacto la prende; sin variable queda apagada', () => {
    expect(autoSubscribeEnabled('true')).toBe(true)
    for (const v of [undefined, null, '', 'false', 'TRUE', '1', 'yes']) expect(autoSubscribeEnabled(v as any)).toBe(false)
  })
})
