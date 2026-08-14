import { createMiddleware } from 'hono/factory'

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

export function requirePermission(permissionCode: string) {
  return createMiddleware<{
    Bindings: Bindings
    Variables: Variables
  }>(async (c, next) => {
    const user = c.get('user')

    const permission = await c.env.DB
      .prepare(`
        SELECT permissions.id
        FROM users

        JOIN roles
          ON roles.id = users.role_id

        JOIN role_permissions
          ON role_permissions.role_id = roles.id

        JOIN permissions
          ON permissions.id = role_permissions.permission_id

        WHERE users.id = ?
          AND permissions.code = ?
          AND roles.active = 1

        LIMIT 1
      `)
      .bind(
        user.id,
        permissionCode
      )
      .first()

    if (!permission) {
      return c.json(
        {
          ok: false,
          error: 'Forbidden'
        },
        403
      )
    }

    await next()
  })
}