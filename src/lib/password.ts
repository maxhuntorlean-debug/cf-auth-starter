export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()

  const salt = crypto.getRandomValues(new Uint8Array(16))

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )

  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: 100_000
    },
    key,
    256
  )

  const saltHex = toHex(salt)
  const hashHex = toHex(new Uint8Array(hash))

  return `${saltHex}:${hashHex}`
}


export async function verifyPassword(
  password: string,
  storedPassword: string
): Promise<boolean> {
  const [saltHex, storedHash] = storedPassword.split(':')

  if (!saltHex || !storedHash) {
    return false
  }

  const encoder = new TextEncoder()
  const salt = fromHex(saltHex)

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )

  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: 100_000
    },
    key,
    256
  )

  return toHex(new Uint8Array(hash)) === storedHash
}


function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}


function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }

  return bytes
}