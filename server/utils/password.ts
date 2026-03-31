import { createHash, randomBytes } from 'crypto'

export function hashUserPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = createHash('sha256').update(password + salt).digest('hex')
  return `${salt}:${hash}`
}

export function verifyUserPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const check = createHash('sha256').update(password + salt).digest('hex')
  return check === hash
}

export function generateToken(): string {
  return randomBytes(32).toString('hex')
}
