# cf-auth-starter

Универсальная API-болванка для Cloudflare Workers с авторизацией, серверными сессиями и RBAC.

## Стек

- TypeScript
- Hono
- Cloudflare Workers
- Cloudflare D1
- Wrangler
- Web Crypto API

JWT не используется. Авторизация работает через серверные сессии в D1 и `HttpOnly` cookie.

## Возможности

- bootstrap первого администратора
- login / logout / current user
- серверные сессии
- пользователи и смена пароля
- создание и редактирование ролей
- создание и редактирование permissions
- назначение permissions ролям
- auth/permission middleware
- credentialed CORS для отдельного frontend/admin приложения

## База данных

Миграция создаёт:

```text
users
roles
permissions
role_permissions
sessions
```

Стартовые роли:

```text
admin
user
```

`admin` получает все стартовые permissions. `user` создаётся без административных прав.

Стартовые permissions:

```text
admin.access
users.read
users.create
users.update
roles.read
roles.update
permissions.read
permissions.update
```

Коды permissions и групп — технические идентификаторы. Используйте латиницу без пробелов, например `sales.create` и группу `sales`.

Маршруты защищаются на backend через:

```ts
requirePermission('users.read')
```

## Cookie и CORS

Сессия передаётся через cookie:

```text
HttpOnly
Secure
SameSite=None
Path=/
```

Это позволяет использовать отдельные origin для frontend и API. На frontend запросы должны выполняться с:

```js
credentials: "include"
```

Разрешённый origin задаётся через `ADMIN_ORIGIN`.

## Настройка wrangler.jsonc

Перед использованием starter замените шаблонные значения:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "my-project-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-08-14",
  "vars": {
    "ADMIN_ORIGIN": "https://my-project-admin.example.com"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "my-project-db",
      "database_id": "DATABASE_ID",
      "remote": true
    }
  ]
}
```

Binding `DB` менять не нужно.

## Новый проект

```bash
npm install
npx wrangler login
npx wrangler d1 create my-project-db
```

Перенесите `database_name` и `database_id` в `wrangler.jsonc`, задайте `ADMIN_ORIGIN`, затем:

```bash
npx wrangler d1 migrations apply my-project-db --remote
npm run deploy
```

Для разработки:

```bash
npm run dev
```

Если Wrangler спрашивает, подключаться ли для local dev к remote resource, выбирайте `y`, если хотите работать с удалённой D1.

## Первый администратор

На новой пустой базе один раз вызовите:

```http
POST /api/auth/bootstrap
Content-Type: application/json

{
  "name": "Administrator",
  "username": "admin",
  "password": "CHANGE_ME"
}
```

После создания первого пользователя bootstrap блокируется.

## Auth API

```text
POST /api/auth/bootstrap
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

`GET /api/auth/me` возвращает пользователя вместе с его permissions:

```json
{
  "ok": true,
  "user": {
    "id": 1,
    "name": "Administrator",
    "username": "admin",
    "role": "admin",
    "permissions": [
      "admin.access",
      "permissions.read",
      "permissions.update",
      "roles.read",
      "roles.update",
      "users.create",
      "users.read",
      "users.update"
    ]
  }
}
```

Если публичная регистрация проекту не нужна, `/api/auth/register` можно удалить и создавать пользователей только через Admin API.

## Users API

```text
GET  /api/admin/users                 users.read
GET  /api/admin/users/:id             users.read
POST /api/admin/users                 users.create
PUT  /api/admin/users/:id             users.update
PUT  /api/admin/users/:id/password    users.update
```

После смены пароля активные сессии пользователя удаляются.

## Roles API

```text
GET  /api/admin/roles                   roles.read
POST /api/admin/roles                   roles.update
PUT  /api/admin/roles/:id               roles.update
GET  /api/admin/roles/:id/permissions   roles.read
PUT  /api/admin/roles/:id/permissions   roles.update
```

Создание роли:

```json
{
  "name": "Кассир",
  "code": "cashier",
  "active": true
}
```

Системную роль `admin` нельзя отключить или переименовать её code. `admin.access` нельзя снять с роли `admin`.

Назначение permissions полностью заменяет текущий набор роли:

```json
{
  "permissionIds": [2, 3, 4]
}
```

## Permissions API

```text
GET  /api/admin/roles/permissions       permissions.read
POST /api/admin/roles/permissions       permissions.update
PUT  /api/admin/roles/permissions/:id   permissions.update
```

Пример:

```json
{
  "code": "sales.create",
  "name": "Создание продажи",
  "groupName": "sales"
}
```

Код `admin.access` защищён от переименования.

## Добавление бизнес-модулей

Auth/RBAC ядро переписывать не требуется. Добавляйте новые routes и permissions, например:

```text
products.read
products.create
products.update
sales.read
sales.create
sales.cancel
```

и защищайте соответствующие endpoints через `requirePermission(...)`.

## Типовой процесс копирования starter

```text
cf-auth-starter
      ↓
новый Git repository
      ↓
поменять Worker name
      ↓
создать D1
      ↓
заполнить database_name/database_id
      ↓
задать ADMIN_ORIGIN
      ↓
применить migration
      ↓
deploy API
      ↓
bootstrap admin
      ↓
подключить frontend
      ↓
добавлять бизнес-модули
```

## Git

В репозиторий не должны попадать:

```text
node_modules/
.wrangler/
.dev.vars
.env
.env.*
repomix-output.xml
```
