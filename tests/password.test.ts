import { describe, it, expect } from 'vitest'
import { hashUserPassword, verifyUserPassword, generateToken } from '../server/utils/password'

describe('hashUserPassword', () => {
  it('produces a salt:hash string', () => {
    const result = hashUserPassword('mypassword')
    expect(result).toMatch(/^[a-f0-9]{32}:[a-f0-9]{64}$/)
  })

  it('produces different hashes for the same password (random salt)', () => {
    const a = hashUserPassword('mypassword')
    const b = hashUserPassword('mypassword')
    expect(a).not.toBe(b)
  })
})

describe('verifyUserPassword', () => {
  it('verifies a correct password', () => {
    const stored = hashUserPassword('correct-horse-battery-staple')
    expect(verifyUserPassword('correct-horse-battery-staple', stored)).toBe(true)
  })

  it('rejects a wrong password', () => {
    const stored = hashUserPassword('correct-horse-battery-staple')
    expect(verifyUserPassword('wrong-password', stored)).toBe(false)
  })

  it('returns false for a malformed stored value (no salt:hash)', () => {
    expect(verifyUserPassword('anything', 'not-valid')).toBe(false)
  })

  it('returns false for an empty stored value', () => {
    expect(verifyUserPassword('anything', '')).toBe(false)
  })
})

describe('generateToken', () => {
  it('produces a 64-char hex string', () => {
    const token = generateToken()
    expect(token).toMatch(/^[a-f0-9]{64}$/)
  })

  it('produces unique tokens', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).not.toBe(b)
  })
})
