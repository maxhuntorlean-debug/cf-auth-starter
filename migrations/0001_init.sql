PRAGMA foreign_keys = ON;

CREATE TABLE roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role_id INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (role_id)
    REFERENCES roles(id)
);

CREATE TABLE role_permissions (
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,

  PRIMARY KEY (role_id, permission_id),

  FOREIGN KEY (role_id)
    REFERENCES roles(id)
    ON DELETE CASCADE,

  FOREIGN KEY (permission_id)
    REFERENCES permissions(id)
    ON DELETE CASCADE
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_users_role_id
ON users(role_id);

CREATE INDEX idx_sessions_user_id
ON sessions(user_id);

CREATE INDEX idx_sessions_expires_at
ON sessions(expires_at);


-- ======================================
-- DEFAULT ROLES
-- ======================================

INSERT INTO roles (
  code,
  name
)
VALUES
  ('admin', 'Administrator'),
  ('user', 'User');


-- ======================================
-- DEFAULT PERMISSIONS
-- ======================================

INSERT INTO permissions (
  code,
  name,
  group_name
)
VALUES
  ('admin.access', 'Access admin area', 'admin'),

  ('users.read', 'Read users', 'users'),
  ('users.create', 'Create users', 'users'),
  ('users.update', 'Update users', 'users'),

  ('roles.read', 'Read roles', 'roles'),
  ('roles.update', 'Update roles', 'roles'),

  ('permissions.read', 'Read permissions', 'permissions'),
  ('permissions.update', 'Update permissions', 'permissions');


-- ======================================
-- ADMIN GETS ALL PERMISSIONS
-- ======================================

INSERT INTO role_permissions (
  role_id,
  permission_id
)
SELECT
  roles.id,
  permissions.id
FROM roles
CROSS JOIN permissions
WHERE roles.code = 'admin';