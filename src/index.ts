import { Hono } from 'hono'
import { cors } from 'hono/cors'

import auth from './routes/auth'
import users from './routes/users'
import roles from './routes/roles'

type Bindings = {
  DB: D1Database
  ADMIN_ORIGIN?: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use(
  '/api/*',
  cors({
    origin: (origin, c) => {
      const allowedOrigin = c.env.ADMIN_ORIGIN

      if (!allowedOrigin) {
        return origin
      }

      return origin === allowedOrigin
        ? origin
        : allowedOrigin
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    credentials: true
  })
)

app.get('/', (c) => {
  return c.json({
    ok: true,
    project: 'cf-auth-starter'
  })
})

app.route('/api/auth', auth)
app.route('/api/admin/users', users)
app.route('/api/admin/roles', roles)

export default app