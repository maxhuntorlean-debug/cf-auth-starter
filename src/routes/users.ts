import { Hono } from 'hono'

import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { hashPassword } from '../lib/password'

type Bindings = {
  DB: D1Database
}

type Variables = {
  user: {
    id: number
    email: string
    role: string
  }
}

const users = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()


// ======================================
// GET USERS
// ======================================

users.get(
  '/',
  authMiddleware,
  requirePermission('users.read'),
  async (c) => {
    const result = await c.env.DB
      .prepare(`
        SELECT
          users.id,
          users.email,
          users.active,
          users.created_at,

          roles.id AS role_id,
          roles.code AS role,
          roles.name AS role_name

        FROM users

        LEFT JOIN roles
          ON roles.id = users.role_id

        ORDER BY users.id
      `)
      .all()

    return c.json({
      ok: true,
      users: result.results
    })
  }
)


// ======================================
// GET USER
// ======================================

users.get(
  '/:id',
  authMiddleware,
  requirePermission('users.read'),
  async (c) => {
    const userId = Number(c.req.param('id'))

    if (!Number.isInteger(userId) || userId <= 0) {
      return c.json(
        {
          ok: false,
          error: 'Invalid user id'
        },
        400
      )
    }

    const user = await c.env.DB
      .prepare(`
        SELECT
          users.id,
          users.email,
          users.active,
          users.created_at,

          roles.id AS role_id,
          roles.code AS role,
          roles.name AS role_name

        FROM users

        LEFT JOIN roles
          ON roles.id = users.role_id

        WHERE users.id = ?
        LIMIT 1
      `)
      .bind(userId)
      .first()

    if (!user) {
      return c.json(
        {
          ok: false,
          error: 'User not found'
        },
        404
      )
    }

    return c.json({
      ok: true,
      user
    })
  }
)


// ======================================
// CREATE USER
// ======================================

users.post(
  '/',
  authMiddleware,
  requirePermission('users.create'),
  async (c) => {
    const body = await c.req.json<{
      email: string
      password: string
      roleId: number
    }>()

    const email = String(body.email ?? '').trim()
    const password = String(body.password ?? '')
    const roleId = Number(body.roleId)

    if (!email || !password) {
      return c.json(
        {
          ok: false,
          error: 'Email and password are required'
        },
        400
      )
    }

    if (!Number.isInteger(roleId) || roleId <= 0) {
      return c.json(
        {
          ok: false,
          error: 'Invalid role'
        },
        400
      )
    }

    const existingUser = await c.env.DB
      .prepare(`
        SELECT id
        FROM users
        WHERE email = ?
        LIMIT 1
      `)
      .bind(email)
      .first()

    if (existingUser) {
      return c.json(
        {
          ok: false,
          error: 'User already exists'
        },
        409
      )
    }

    const role = await c.env.DB
      .prepare(`
        SELECT
          id,
          code,
          name
        FROM roles
        WHERE id = ?
          AND active = 1
        LIMIT 1
      `)
      .bind(roleId)
      .first<{
        id: number
        code: string
        name: string
      }>()

    if (!role) {
      return c.json(
        {
          ok: false,
          error: 'Role not found or inactive'
        },
        400
      )
    }

    const passwordHash = await hashPassword(password)

    const result = await c.env.DB
      .prepare(`
        INSERT INTO users (
          email,
          password_hash,
          role_id,
          active
        )
        VALUES (?, ?, ?, 1)
      `)
      .bind(
        email,
        passwordHash,
        role.id
      )
      .run()

    return c.json(
      {
        ok: true,
        user: {
          id: result.meta.last_row_id,
          email,
          roleId: role.id,
          role: role.code,
          active: true
        }
      },
      201
    )
  }
)


// ======================================
// UPDATE USER
// ======================================

users.put(
  '/:id',
  authMiddleware,
  requirePermission('users.update'),
  async (c) => {
    const userId = Number(c.req.param('id'))

    if (!Number.isInteger(userId) || userId <= 0) {
      return c.json(
        {
          ok: false,
          error: 'Invalid user id'
        },
        400
      )
    }

    const existingUser = await c.env.DB
      .prepare(`
        SELECT
          id,
          email
        FROM users
        WHERE id = ?
        LIMIT 1
      `)
      .bind(userId)
      .first<{
        id: number
        email: string
      }>()

    if (!existingUser) {
      return c.json(
        {
          ok: false,
          error: 'User not found'
        },
        404
      )
    }

    const body = await c.req.json<{
      roleId: number
      active: boolean
    }>()

    const roleId = Number(body.roleId)

    if (!Number.isInteger(roleId) || roleId <= 0) {
      return c.json(
        {
          ok: false,
          error: 'Invalid role'
        },
        400
      )
    }

    if (typeof body.active !== 'boolean') {
      return c.json(
        {
          ok: false,
          error: 'active must be boolean'
        },
        400
      )
    }

    const role = await c.env.DB
      .prepare(`
        SELECT
          id,
          code,
          name
        FROM roles
        WHERE id = ?
          AND active = 1
        LIMIT 1
      `)
      .bind(roleId)
      .first<{
        id: number
        code: string
        name: string
      }>()

    if (!role) {
      return c.json(
        {
          ok: false,
          error: 'Role not found or inactive'
        },
        400
      )
    }

    await c.env.DB
      .prepare(`
        UPDATE users
        SET
          role_id = ?,
          active = ?
        WHERE id = ?
      `)
      .bind(
        role.id,
        body.active ? 1 : 0,
        userId
      )
      .run()

    return c.json({
      ok: true,
      user: {
        id: userId,
        email: existingUser.email,
        roleId: role.id,
        role: role.code,
        active: body.active
      }
    })
  }
)


// ======================================
// CHANGE PASSWORD
// ======================================

users.put(
  '/:id/password',
  authMiddleware,
  requirePermission('users.update'),
  async (c) => {
    const userId = Number(c.req.param('id'))

    if (!Number.isInteger(userId) || userId <= 0) {
      return c.json(
        {
          ok: false,
          error: 'Invalid user id'
        },
        400
      )
    }

    const user = await c.env.DB
      .prepare(`
        SELECT id
        FROM users
        WHERE id = ?
        LIMIT 1
      `)
      .bind(userId)
      .first()

    if (!user) {
      return c.json(
        {
          ok: false,
          error: 'User not found'
        },
        404
      )
    }

    const body = await c.req.json<{
      password: string
    }>()

    const password = String(body.password ?? '')

    if (!password) {
      return c.json(
        {
          ok: false,
          error: 'Password is required'
        },
        400
      )
    }

    const passwordHash = await hashPassword(password)

    await c.env.DB
      .prepare(`
        UPDATE users
        SET password_hash = ?
        WHERE id = ?
      `)
      .bind(
        passwordHash,
        userId
      )
      .run()

    // После смены пароля выкидываем пользователя
    // со всех устройств.
    await c.env.DB
      .prepare(`
        DELETE FROM sessions
        WHERE user_id = ?
      `)
      .bind(userId)
      .run()

    return c.json({
      ok: true,
      userId,
      passwordChanged: true
    })
  }
)

export default users