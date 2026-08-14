import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'

import { hashSessionToken } from '../lib/session'

type Bindings = {
  DB: D1Database
}

type Variables = {
  user: {
    id: number
    name: string
    username: string
    role: string
  }
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

  const session = await c.env.DB
    .prepare(`
      SELECT
        sessions.id AS session_id,
        sessions.expires_at,

        users.id AS user_id,
        users.name,
        users.username,
        users.active,

        roles.id AS role_id,
        roles.code AS role,
        roles.active AS role_active

      FROM sessions

      JOIN users
        ON users.id = sessions.user_id

      JOIN roles
        ON roles.id = users.role_id

      WHERE sessions.token_hash = ?
      LIMIT 1
    `)
    .bind(sessionHash)
    .first<{
      session_id: number
      expires_at: string

      user_id: number
      name: string
      username: string
      active: number

      role_id: number
      role: string
      role_active: number
    }>()

  if (!session) {
    return c.json(
      {
        ok: false,
        error: 'Unauthorized'
      },
      401
    )
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await c.env.DB
      .prepare(`
        DELETE FROM sessions
        WHERE id = ?
      `)
      .bind(session.session_id)
      .run()

    return c.json(
      {
        ok: false,
        error: 'Session expired'
      },
      401
    )
  }

  if (!session.active) {
    return c.json(
      {
        ok: false,
        error: 'User is inactive'
      },
      403
    )
  }

  if (!session.role_active) {
    return c.json(
      {
        ok: false,
        error: 'User role is inactive'
      },
      403
    )
  }

  c.set('user', {
    id: session.user_id,
    name: session.name,
    username: session.username,
    role: session.role
  })

  await next()
})