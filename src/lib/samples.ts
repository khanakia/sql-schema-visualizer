export interface Sample {
  id: string
  name: string
  dialect: string
  sql: string
}

export const samples: Sample[] = [
  {
    id: 'ecommerce',
    name: 'E-commerce',
    dialect: 'PostgreSQL',
    sql: `CREATE TABLE customers (   -- registered shoppers; one row per account
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,   -- login + receipts, case-insensitive in app
  full_name     VARCHAR(120) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()   -- signup timestamp (UTC)
);

CREATE TABLE addresses (   -- shipping/billing addresses, many per customer
  id            SERIAL PRIMARY KEY,
  customer_id   INTEGER NOT NULL REFERENCES customers(id),
  line1         VARCHAR(200) NOT NULL,
  city          VARCHAR(80) NOT NULL,
  country       CHAR(2) NOT NULL   -- ISO 3166-1 alpha-2
);

CREATE TABLE products (
  id            SERIAL PRIMARY KEY,
  sku           VARCHAR(40) NOT NULL UNIQUE,   -- stock-keeping unit, vendor-supplied
  name          VARCHAR(200) NOT NULL,
  price_cents   INTEGER NOT NULL,   -- store money as integer cents, never float
  stock         INTEGER NOT NULL DEFAULT 0   -- on-hand quantity; 0 = out of stock
);

CREATE TABLE orders (
  id            SERIAL PRIMARY KEY,
  customer_id   INTEGER NOT NULL REFERENCES customers(id),
  address_id    INTEGER NOT NULL REFERENCES addresses(id),   -- ship-to snapshot
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',   -- pending|paid|shipped|cancelled
  total_cents   INTEGER NOT NULL,   -- denormalised sum of order_items at checkout
  placed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (   -- line items; the order ↔ product join
  id            SERIAL PRIMARY KEY,
  order_id      INTEGER NOT NULL REFERENCES orders(id),
  product_id    INTEGER NOT NULL REFERENCES products(id),
  quantity      INTEGER NOT NULL DEFAULT 1,
  unit_cents    INTEGER NOT NULL   -- price AT TIME OF SALE, not products.price_cents
);`,
  },
  {
    id: 'blog',
    name: 'Blog (MySQL)',
    dialect: 'MySQL',
    sql: `CREATE TABLE \`users\` (   # blog authors and commenters
  \`id\`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`username\`   VARCHAR(50) NOT NULL,   # public handle, shown on posts
  \`email\`      VARCHAR(190) NOT NULL,   # 190 = utf8mb4 index-safe length
  \`bio\`        TEXT,   # optional, markdown allowed
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uq_email\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`posts\` (
  \`id\`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`author_id\`  BIGINT UNSIGNED NOT NULL,   # FK -> users.id
  \`title\`      VARCHAR(200) NOT NULL,
  \`body\`       LONGTEXT NOT NULL,
  \`published\`  TINYINT(1) NOT NULL DEFAULT 0,   # 0 = draft, 1 = live
  \`created_at\` DATETIME NOT NULL,
  PRIMARY KEY (\`id\`),
  CONSTRAINT \`fk_post_author\` FOREIGN KEY (\`author_id\`) REFERENCES \`users\` (\`id\`)
) ENGINE=InnoDB;

CREATE TABLE \`comments\` (
  \`id\`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`post_id\`    BIGINT UNSIGNED NOT NULL,
  \`user_id\`    BIGINT UNSIGNED NOT NULL,
  \`body\`       TEXT NOT NULL,
  PRIMARY KEY (\`id\`),
  CONSTRAINT \`fk_c_post\` FOREIGN KEY (\`post_id\`) REFERENCES \`posts\` (\`id\`),
  CONSTRAINT \`fk_c_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`)
) ENGINE=InnoDB;

CREATE TABLE \`tags\` (
  \`id\`    INT NOT NULL AUTO_INCREMENT,
  \`name\`  VARCHAR(50) NOT NULL,
  PRIMARY KEY (\`id\`)
);

CREATE TABLE \`post_tags\` (
  \`post_id\` BIGINT UNSIGNED NOT NULL,
  \`tag_id\`  INT NOT NULL,
  PRIMARY KEY (\`post_id\`, \`tag_id\`),
  CONSTRAINT \`fk_pt_post\` FOREIGN KEY (\`post_id\`) REFERENCES \`posts\` (\`id\`),
  CONSTRAINT \`fk_pt_tag\` FOREIGN KEY (\`tag_id\`) REFERENCES \`tags\` (\`id\`)
);`,
  },
  {
    id: 'saas',
    name: 'SaaS (SQLite)',
    dialect: 'SQLite',
    sql: `CREATE TABLE organizations (   -- top-level tenant; everything scopes to an org
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'free',   -- free|pro|enterprise — gates features
  created_at  TEXT NOT NULL   -- ISO-8601 string (SQLite has no native datetime)
);

CREATE TABLE members (   -- users within an org (multi-tenant membership)
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id      INTEGER NOT NULL REFERENCES organizations(id),
  email       TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL DEFAULT 'member'   -- owner|admin|member
);

CREATE TABLE projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id      INTEGER NOT NULL REFERENCES organizations(id),
  name        TEXT NOT NULL,
  archived    INTEGER NOT NULL DEFAULT 0   -- soft-hide; 1 = hidden from lists
);

CREATE TABLE tickets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects(id),
  assignee_id INTEGER REFERENCES members(id),   -- nullable = unassigned
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',   -- open|in_progress|done
  priority    INTEGER NOT NULL DEFAULT 2   -- 1 = high, 2 = normal, 3 = low
);`,
  },
]
