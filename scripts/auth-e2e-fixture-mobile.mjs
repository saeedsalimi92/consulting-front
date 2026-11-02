import { randomInt } from 'node:crypto'

// Generate the exact national form accepted by Nuxt's public login validator.
// Laravel then canonicalizes the same number to +98 followed by the national
// number without its leading zero.
export function generateAuthE2EMobile() {
  return `0912${String(randomInt(0, 10_000_000)).padStart(7, '0')}`
}
