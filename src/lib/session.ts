export function createSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashSessionToken(
  token: string
): Promise<string> {
  const data = new TextEncoder().encode(token)

  const hash = await crypto.subtle.digest(
    'SHA-256',
    data
  )

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}