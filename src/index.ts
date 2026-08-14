import { Hono } from 'hono'
import auth from './routes/auth'
import users from './routes/users'
import roles from './routes/roles'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

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