# cf-auth-starter

Минимальная универсальная API-болванка для Cloudflare Workers.

Проект содержит готовое ядро:

- TypeScript
- Hono
- Cloudflare Workers
- Cloudflare D1
- авторизация
- серверные сессии
- пользователи
- роли
- права доступа
- RBAC
- bootstrap первого администратора

Болванка предназначена для быстрого старта новых проектов:

```text
cf-auth-starter
      ↓
shop-api
crm-api
warehouse-api
service-api
...
```

Бизнес-логика конкретного проекта добавляется поверх готового ядра.

---

# Стек

```text
TypeScript
Hono
Cloudflare Workers
Cloudflare D1
Wrangler
Web Crypto API
```

JWT не используется.

Авторизация работает через серверные сессии в D1 и `HttpOnly` cookie.

---

# Архитектура

```text
Client
  │
  │ HTTPS
  ▼
Cloudflare Worker
  │
  ▼
Hono
  │
  ├── Auth Middleware
  ├── Permission Middleware
  │
  ▼
Routes
  │
  ▼
Cloudflare D1
```

---

# Структура проекта

```text
cf-auth-starter/
│
├── migrations/
│   └── 0001_init.sql
│
├── src/
│   ├── lib/
│   │   ├── password.ts
│   │   └── session.ts
│   │
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── permission.ts
│   │
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── users.ts
│   │   └── roles.ts
│   │
│   └── index.ts
│
├── test.http
├── package.json
├── package-lock.json
├── tsconfig.json
├── wrangler.jsonc
├── .gitignore
└── README.md
```

---

# База данных

Используется Cloudflare D1.

Создаются таблицы:

```text
users
roles
permissions
role_permissions
sessions
```

Пользователь:

```text
users
├── id
├── name
├── username
├── password_hash
├── role_id
├── active
└── created_at
```

Связи:

```text
users
  │
  │ role_id
  ▼
roles
  │
  ▼
role_permissions
  │
  ▼
permissions
```

Сессии:

```text
users
  │
  ▼
sessions
```

---

# Роли

После первой миграции автоматически создаются:

```text
admin
user
```

`admin` получает все базовые права.

`user` создаётся без административных прав.

---

# Базовые permissions

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

В дальнейшем можно добавлять права конкретного проекта.

Например:

```text
products.read
products.create
products.update

orders.read
orders.create
orders.update
orders.cancel
```

---

# Проверка прав

Маршрут защищается через:

```ts
requirePermission('users.read')
```

Пример:

```ts
users.get(
  '/',
  authMiddleware,
  requirePermission('users.read'),
  async (c) => {
    // ...
  }
)
```

Логика:

```text
Request
  ↓
authMiddleware
  ↓
User
  ↓
requirePermission(...)
  ↓
Role
  ↓
Permissions
  ↓
Route
```

---

# Авторизация

Используются серверные сессии.

После успешного login:

```text
username + password
        ↓
проверка password hash
        ↓
случайный session token
        ↓
SHA-256(token)
        ↓
D1 sessions
```

Сам session token передаётся клиенту через cookie:

```text
HttpOnly
Secure
SameSite=Lax
```

Срок сессии:

```text
1 год
```

В D1 хранится только хеш session token.

---

# Пароли

Открытые пароли в базе не хранятся.

Используется:

```text
PBKDF2
SHA-256
random salt
```

В `users.password_hash` сохраняется:

```text
salt:hash
```

---

# Установка

```bash
npm install
```

---

# Авторизация Wrangler

```bash
npx wrangler login
```

Проверить аккаунт:

```bash
npx wrangler whoami
```

---

# Создание D1

Для нового проекта:

```bash
npx wrangler d1 create my-project-db
```

Для binding используем:

```text
DB
```

Пример:

```text
What binding name would you like to use?
DB
```

Если локальная разработка должна работать сразу с удалённой D1:

```text
For local dev, do you want to connect to the remote resource?
y
```

---

# wrangler.jsonc

Пример:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "my-project-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-08-14",

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

В коде база всегда доступна как:

```ts
c.env.DB
```

Binding `DB` между проектами менять не нужно.

---

# Применение миграции

```bash
npx wrangler d1 migrations apply my-project-db --remote
```

Миграция автоматически создаст таблицы, роли и базовые permissions.

---

# Deploy

```bash
npm run deploy
```

После deploy Worker будет доступен примерно по адресу:

```text
https://my-project-api.<account>.workers.dev
```

---

# Первый администратор

На новой пустой базе ещё нет пользователей.

Первый администратор создаётся один раз через bootstrap:

```http
POST /api/auth/bootstrap
Content-Type: application/json

{
  "name": "Administrator",
  "username": "admin",
  "password": "CHANGE_ME"
}
```

Пример ответа:

```json
{
  "ok": true,
  "user": {
    "id": 1,
    "name": "Administrator",
    "username": "admin",
    "role": "admin"
  }
}
```

После появления первого пользователя bootstrap перестаёт работать.

Повторный вызов:

```json
{
  "ok": false,
  "error": "Bootstrap already completed"
}
```

---

# Auth API

## Bootstrap

```text
POST /api/auth/bootstrap
```

Создаёт первого администратора.

Работает только на пустой базе.

---

## Register

```text
POST /api/auth/register
```

Пример:

```json
{
  "name": "Test User",
  "username": "testuser",
  "password": "Test12345"
}
```

Новый пользователь получает роль:

```text
user
```

---

## Login

```text
POST /api/auth/login
```

Пример:

```json
{
  "username": "admin",
  "password": "Test12345"
}
```

После успешного входа сервер создаёт сессию и возвращает cookie.

---

## Current user

```text
GET /api/auth/me
```

Пример ответа:

```json
{
  "ok": true,
  "user": {
    "id": 1,
    "name": "Administrator",
    "username": "admin",
    "role": "admin"
  }
}
```

---

## Logout

```text
POST /api/auth/logout
```

При logout:

```text
session удаляется из D1
+
cookie удаляется у клиента
```

Старая сессия после этого больше не работает.

---

# Users API

Все маршруты пользователей защищены permissions.

## Список пользователей

```text
GET /api/admin/users
```

Permission:

```text
users.read
```

---

## Получить пользователя

```text
GET /api/admin/users/:id
```

Permission:

```text
users.read
```

---

## Создать пользователя

```text
POST /api/admin/users
```

Permission:

```text
users.create
```

Пример:

```json
{
  "name": "John Smith",
  "username": "john",
  "password": "Test12345",
  "roleId": 2
}
```

---

## Изменить пользователя

```text
PUT /api/admin/users/:id
```

Permission:

```text
users.update
```

Пример:

```json
{
  "name": "John Smith",
  "roleId": 2,
  "active": true
}
```

Заблокировать:

```json
{
  "name": "John Smith",
  "roleId": 2,
  "active": false
}
```

Заблокированный пользователь не может пользоваться защищённым API.

---

## Сменить пароль

```text
PUT /api/admin/users/:id/password
```

Permission:

```text
users.update
```

Пример:

```json
{
  "password": "NewPassword123"
}
```

После смены пароля:

```text
DELETE FROM sessions
WHERE user_id = ...
```

То есть пользователь автоматически выходит со всех устройств.

---

# Roles API

## Получить роли

```text
GET /api/admin/roles
```

Permission:

```text
roles.read
```

---

## Получить права роли

```text
GET /api/admin/roles/:id/permissions
```

Permission:

```text
roles.read
```

---

## Изменить права роли

```text
PUT /api/admin/roles/:id/permissions
```

Permission:

```text
roles.update
```

Пример:

```json
{
  "permissionIds": [2, 3, 4]
}
```

Этот запрос полностью заменяет набор permissions указанной роли.

---

# Permissions API

## Получить permissions

```text
GET /api/admin/roles/permissions
```

Permission:

```text
permissions.read
```

---

## Создать permission

```text
POST /api/admin/roles/permissions
```

Permission:

```text
permissions.update
```

Пример:

```json
{
  "code": "products.read",
  "name": "Read products",
  "groupName": "products"
}
```

---

## Изменить permission

```text
PUT /api/admin/roles/permissions/:id
```

Permission:

```text
permissions.update
```

Пример:

```json
{
  "code": "products.read",
  "name": "Read products",
  "groupName": "products"
}
```

---

# HTTP статусы

```text
200 OK
201 Created
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
500 Internal Server Error
```

Разница:

```text
401
→ пользователь не авторизован

403
→ пользователь авторизован,
  но нет нужного permission
```

---

# Разработка нового проекта

После копирования starter-а бизнес-модули добавляются отдельно.

Например интернет-магазин:

```text
src/
├── lib/
├── middleware/
├── routes/
│   ├── auth.ts
│   ├── users.ts
│   ├── roles.ts
│   ├── products.ts
│   ├── categories.ts
│   └── orders.ts
└── index.ts
```

Добавляем новые permissions:

```text
products.read
products.create
products.update

orders.read
orders.create
orders.update
```

И защищаем маршруты:

```ts
requirePermission('products.update')
```

Auth-систему при этом переписывать не требуется.

---

# Создание нового проекта из starter

Типичный процесс:

```text
cf-auth-starter
      ↓
новый Git repository
      ↓
поменять имя Worker
      ↓
создать новую D1
      ↓
binding DB
      ↓
применить migration
      ↓
deploy
      ↓
bootstrap admin
      ↓
добавлять бизнес-модули
```

Команды:

```bash
npm install

npx wrangler login

npx wrangler d1 create my-project-db

npx wrangler d1 migrations apply my-project-db --remote

npm run deploy
```

После deploy вызвать:

```text
POST /api/auth/bootstrap
```

---

# Git

Перед commit:

```bash
git status
```

В Git не должны попадать:

```text
node_modules/
.wrangler/
.dev.vars
.env
.env.*
repomix-output.xml
```

Первый commit:

```bash
git init
git add .
git commit -m "Initial Cloudflare auth starter"
git branch -M main
```

Подключить GitHub:

```bash
git remote add origin https://github.com/USERNAME/cf-auth-starter.git
git push -u origin main
```

Рекомендуется включить:

```text
GitHub
→ Settings
→ General
→ Template repository
```

Тогда новый проект можно создавать через:

```text
Use this template
```

---

# Безопасность

Основные принципы starter-а:

```text
пароли не хранятся открытым текстом
session token не хранится открытым текстом в D1
HttpOnly cookie
Secure cookie
SameSite=Lax
параметризованные SQL запросы
RBAC permissions
отключение пользователей
отзыв сессий
смена пароля сбрасывает сессии
bootstrap работает только один раз
```

---

# test.http

Файл `test.http` используется для проверки API из VS Code.

Рекомендуемый порядок:

```text
bootstrap
↓
login
↓
me
↓
users
↓
roles
↓
permissions
↓
logout
```

Не хранить реальные session tokens и production-пароли в Git.

---

# Цель проекта

`cf-auth-starter` — это не готовое бизнес-приложение.

Это минимальное ядро:

```text
Auth
+
Users
+
Roles
+
Permissions
+
Sessions
+
D1
```

На его основе можно быстро строить конкретные приложения без повторного написания авторизации и системы прав.