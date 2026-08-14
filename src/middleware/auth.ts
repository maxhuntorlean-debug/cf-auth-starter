import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { hashSessionToken } from '../lib/session'

type Bindings = {
  DB: D1Database
}

type User = {
  id: number
  email: string
  role: string
}

type Variables = {
  user: User
}

export const authMiddleware = createMiddleware<{
  Bindings: Bindings
  Variables: Variables
}>(async (c, next) => {
  const sessionToken = getCookie(c, 'session')

  if (!sessionToken) {
    return c.json(
      {
        ok: false,
        error: 'Unauthorized'
      },
      401
    )
  }

  const sessionHash = await hashSessionToken(sessionToken)

  const user = await c.env.DB
    .prepare(`
      SELECT
        users.id,
        users.email,
        users.active,
        users.role_id,
        roles.code AS role,
        sessions.expires_at
      FROM sessions

      JOIN users
        ON users.id = sessions.user_id

      LEFT JOIN roles
        ON roles.id = users.role_id

      WHERE sessions.token_hash = ?
      LIMIT 1
    `)
    .bind(sessionHash)
    .first<{
      id: number
      email: string
      active: number
      role_id: number | null
      role: string | null
      expires_at: string
    }>()

  if (!user) {
    return c.json(
      {
        ok: false,
        error: 'Unauthorized'
      },
      401
    )
  }

  if (!user.active) {
    return c.json(
      {
        ok: false,
        error: 'User is inactive'
      },
      403
    )
  }

  if (!user.role_id || !user.role) {
    return c.json(
      {
        ok: false,
        error: 'User role is not configured'
      },
      403
    )
  }

  if (new Date(user.expires_at) <= new Date()) {
    return c.json(
      {
        ok: false,
        error: 'Session expired'
      },
      401
    )
  }

  c.set('user', {
    id: user.id,
    email: user.email,
    role: user.role
  })

  await next()
})