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
  {
    id: 'notation',
    name: 'Relationship notation demo',
    dialect: 'PostgreSQL',
    sql: `-- One small schema that exercises every crow's-foot marker variant
-- so you can read off the diagram what each line means.
--   Crow's foot end  = FK ("many")
--   Single bar end   = referenced PK ("exactly one")
--   Circle in front of the crow's foot = nullable FK ("zero or many")

CREATE TABLE companies (   -- parent of departments + offices
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  hq_office_id  INTEGER   -- ↓ two-way: company -> office, OPTIONAL (see ALTER below)
);

CREATE TABLE departments (   -- mandatory FK: NOT NULL -> "one or many"
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(80) NOT NULL,
  company_id  INTEGER NOT NULL REFERENCES companies(id)   -- crow's foot + bar (no circle)
);

CREATE TABLE employees (   -- one row covers three variants at once
  id             SERIAL PRIMARY KEY,
  full_name      VARCHAR(120) NOT NULL,
  department_id  INTEGER NOT NULL REFERENCES departments(id),   -- mandatory: foot + bar
  manager_id     INTEGER REFERENCES employees(id),              -- SELF-REF + nullable: circle + foot + bar
  mentor_id     INTEGER REFERENCES employees(id)                -- second self-ref, also optional
);

CREATE TABLE offices (   -- forms the OTHER direction of the two-way with companies
  id          SERIAL PRIMARY KEY,
  city        VARCHAR(80) NOT NULL,
  company_id  INTEGER NOT NULL REFERENCES companies(id)   -- office -> company, mandatory
);

-- Second leg of the two-way: company -> office (optional; HQ may be unset).
-- Together with offices.company_id above this draws TWO separate edges
-- between companies and offices, each with its own arrow direction.
ALTER TABLE companies
  ADD CONSTRAINT fk_company_hq FOREIGN KEY (hq_office_id) REFERENCES offices(id);

-- A 4-table chain so you can FK-hop and try the Back button:
--   continents -> countries -> regions -> cities
CREATE TABLE continents (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(40) NOT NULL
);
CREATE TABLE countries (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(80) NOT NULL,
  continent_id  INTEGER NOT NULL REFERENCES continents(id)
);
CREATE TABLE regions (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(80) NOT NULL,
  country_id  INTEGER NOT NULL REFERENCES countries(id)
);
CREATE TABLE cities (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(80) NOT NULL,
  region_id  INTEGER NOT NULL REFERENCES regions(id)
);`,
  },
  {
    id: 'groups-demo',
    name: 'Mini ERP (groups demo)',
    dialect: 'PostgreSQL',
    sql: `-- 12-table schema with three obvious clusters. The \`-- @group:\`
-- annotations below auto-create the groups on the Groups tab (look
-- for the 📌 SQL badge) — no manual setup needed. \`users\` is in two
-- groups (auth + content) to show multi-membership.

-- ── auth ──────────────────────────────────────────────────────────
-- @group: auth, content
CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL UNIQUE,
  full_name   VARCHAR(120) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- @group: auth
CREATE TABLE sessions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  token       VARCHAR(64) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL
);
-- @group: auth
CREATE TABLE api_keys (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  label       VARCHAR(80) NOT NULL,
  secret_hash VARCHAR(120) NOT NULL,
  revoked_at  TIMESTAMPTZ
);

-- ── content ───────────────────────────────────────────────────────
-- @group: content
CREATE TABLE posts (
  id         SERIAL PRIMARY KEY,
  author_id  INTEGER NOT NULL REFERENCES users(id),
  title      VARCHAR(200) NOT NULL,
  body       TEXT NOT NULL,
  published  BOOLEAN NOT NULL DEFAULT false
);
-- @group: content
CREATE TABLE tags (
  id    SERIAL PRIMARY KEY,
  slug  VARCHAR(40) NOT NULL UNIQUE
);
-- @group: content
CREATE TABLE post_tags (
  post_id  INTEGER NOT NULL REFERENCES posts(id),
  tag_id   INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (post_id, tag_id)
);
-- @group: content
CREATE TABLE comments (
  id          SERIAL PRIMARY KEY,
  post_id     INTEGER NOT NULL REFERENCES posts(id),
  author_id   INTEGER NOT NULL REFERENCES users(id),
  parent_id   INTEGER REFERENCES comments(id),   -- nullable: thread root
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── billing ───────────────────────────────────────────────────────
-- @group: billing
CREATE TABLE plans (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(40) NOT NULL UNIQUE,   -- free|pro|team|enterprise
  monthly_cents INTEGER NOT NULL
);
-- @group: billing
CREATE TABLE customers (
  id        SERIAL PRIMARY KEY,
  user_id   INTEGER NOT NULL REFERENCES users(id),
  company   VARCHAR(120),
  vat_id    VARCHAR(40)
);
-- @group: billing
CREATE TABLE subscriptions (
  id           SERIAL PRIMARY KEY,
  customer_id  INTEGER NOT NULL REFERENCES customers(id),
  plan_id      INTEGER NOT NULL REFERENCES plans(id),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ                    -- nullable: still active
);
-- @group: billing
CREATE TABLE invoices (
  id            SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
  total_cents   INTEGER NOT NULL,
  paid_at       TIMESTAMPTZ                   -- nullable: unpaid
);
-- @group: billing
CREATE TABLE invoice_items (
  id          SERIAL PRIMARY KEY,
  invoice_id  INTEGER NOT NULL REFERENCES invoices(id),
  description VARCHAR(200) NOT NULL,
  cents       INTEGER NOT NULL
);`,
  },
  {
    id: 'social',
    name: 'Social network',
    dialect: 'PostgreSQL',
    sql: `-- Twitter-shaped schema: self-referential many-to-many follows,
-- posts with hashtags (M2M), likes, and notifications.

CREATE TABLE users (
  id           SERIAL PRIMARY KEY,
  handle       VARCHAR(40) NOT NULL UNIQUE,   -- @handle, lowercase
  display_name VARCHAR(80) NOT NULL,
  bio          TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Self-referential many-to-many: who follows whom.
CREATE TABLE follows (
  follower_id  INTEGER NOT NULL REFERENCES users(id),
  followee_id  INTEGER NOT NULL REFERENCES users(id),
  followed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id)
);

CREATE TABLE posts (
  id          SERIAL PRIMARY KEY,
  author_id   INTEGER NOT NULL REFERENCES users(id),
  body        VARCHAR(280) NOT NULL,
  reply_to    INTEGER REFERENCES posts(id),     -- nullable: top-level vs thread reply
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hashtags (
  id    SERIAL PRIMARY KEY,
  tag   VARCHAR(40) NOT NULL UNIQUE          -- without the '#'
);

CREATE TABLE post_hashtags (   -- many-to-many
  post_id    INTEGER NOT NULL REFERENCES posts(id),
  hashtag_id INTEGER NOT NULL REFERENCES hashtags(id),
  PRIMARY KEY (post_id, hashtag_id)
);

CREATE TABLE likes (
  user_id    INTEGER NOT NULL REFERENCES users(id),
  post_id    INTEGER NOT NULL REFERENCES posts(id),
  liked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE notifications (
  id          SERIAL PRIMARY KEY,
  recipient   INTEGER NOT NULL REFERENCES users(id),
  actor       INTEGER NOT NULL REFERENCES users(id),   -- who triggered it
  post_id     INTEGER REFERENCES posts(id),            -- nullable: not all notifs are post-bound
  kind        VARCHAR(20) NOT NULL,                    -- follow|like|reply|mention
  read_at     TIMESTAMPTZ                              -- nullable: unread
);`,
  },
  {
    id: 'project-mgmt',
    name: 'Project management (MySQL)',
    dialect: 'MySQL',
    sql: `-- MySQL dialect: backticks, AUTO_INCREMENT, composite PKs, indexes
-- declared inside the CREATE TABLE. Jira/Linear-lite.

CREATE TABLE \`workspaces\` (
  \`id\`   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(120) NOT NULL,
  \`slug\` VARCHAR(40) NOT NULL UNIQUE,
  PRIMARY KEY (\`id\`)
);

CREATE TABLE \`members\` (
  \`id\`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`workspace_id\` INT UNSIGNED NOT NULL,
  \`email\`        VARCHAR(255) NOT NULL,
  \`role\`         ENUM('owner','admin','member','viewer') NOT NULL DEFAULT 'member',
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uq_member_workspace_email\` (\`workspace_id\`, \`email\`),
  CONSTRAINT \`fk_member_workspace\` FOREIGN KEY (\`workspace_id\`) REFERENCES \`workspaces\` (\`id\`)
);

CREATE TABLE \`projects\` (
  \`id\`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`workspace_id\` INT UNSIGNED NOT NULL,
  \`name\`         VARCHAR(120) NOT NULL,
  \`key\`          VARCHAR(10)  NOT NULL,    -- short code shown in ticket ids
  \`archived\`     TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (\`id\`),
  CONSTRAINT \`fk_project_workspace\` FOREIGN KEY (\`workspace_id\`) REFERENCES \`workspaces\` (\`id\`)
);

CREATE TABLE \`tickets\` (
  \`id\`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`project_id\` INT UNSIGNED NOT NULL,
  \`title\`      VARCHAR(200) NOT NULL,
  \`body\`       TEXT,
  \`status\`     ENUM('todo','in_progress','review','done','cancelled') NOT NULL DEFAULT 'todo',
  \`priority\`   TINYINT NOT NULL DEFAULT 2,         -- 1=urgent..4=low
  \`assignee\`   INT UNSIGNED,                        -- nullable: unassigned
  \`parent_id\`  INT UNSIGNED,                        -- nullable: epic -> subtask self-ref
  PRIMARY KEY (\`id\`),
  CONSTRAINT \`fk_ticket_project\`  FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`),
  CONSTRAINT \`fk_ticket_assignee\` FOREIGN KEY (\`assignee\`)   REFERENCES \`members\`  (\`id\`),
  CONSTRAINT \`fk_ticket_parent\`   FOREIGN KEY (\`parent_id\`)  REFERENCES \`tickets\`  (\`id\`)
);

CREATE TABLE \`labels\` (
  \`id\`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`project_id\` INT UNSIGNED NOT NULL,
  \`name\`       VARCHAR(40) NOT NULL,
  \`color\`      CHAR(7) NOT NULL DEFAULT '#888888',
  PRIMARY KEY (\`id\`),
  CONSTRAINT \`fk_label_project\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`)
);

CREATE TABLE \`ticket_labels\` (   -- many-to-many
  \`ticket_id\` INT UNSIGNED NOT NULL,
  \`label_id\`  INT UNSIGNED NOT NULL,
  PRIMARY KEY (\`ticket_id\`, \`label_id\`),
  CONSTRAINT \`fk_tl_ticket\` FOREIGN KEY (\`ticket_id\`) REFERENCES \`tickets\` (\`id\`),
  CONSTRAINT \`fk_tl_label\`  FOREIGN KEY (\`label_id\`)  REFERENCES \`labels\`  (\`id\`)
);

CREATE TABLE \`comments\` (
  \`id\`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`ticket_id\`  INT UNSIGNED NOT NULL,
  \`author_id\`  INT UNSIGNED NOT NULL,
  \`body\`       TEXT NOT NULL,
  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  CONSTRAINT \`fk_comment_ticket\` FOREIGN KEY (\`ticket_id\`) REFERENCES \`tickets\` (\`id\`),
  CONSTRAINT \`fk_comment_author\` FOREIGN KEY (\`author_id\`) REFERENCES \`members\` (\`id\`)
);`,
  },
  {
    id: 'library',
    name: 'Library catalogue (SQLite)',
    dialect: 'SQLite',
    sql: `-- SQLite: AUTOINCREMENT, INTEGER PRIMARY KEY, DATE columns.
-- Books / authors / members / loans schema with M2M authorship and a
-- copies layer (the same title can have many physical copies on the
-- shelf — only those are loanable).

CREATE TABLE authors (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name  TEXT NOT NULL,
  born       INTEGER,                        -- nullable: birth year unknown
  died       INTEGER                         -- nullable: still living
);

CREATE TABLE books (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  isbn         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  published    INTEGER NOT NULL,
  language     TEXT NOT NULL DEFAULT 'en'
);

CREATE TABLE book_authors (   -- M2M: a book may have multiple authors
  book_id    INTEGER NOT NULL REFERENCES books(id),
  author_id  INTEGER NOT NULL REFERENCES authors(id),
  ordinal    INTEGER NOT NULL DEFAULT 1,     -- credit order for the cover
  PRIMARY KEY (book_id, author_id)
);

CREATE TABLE copies (   -- one row per physical copy on the shelf
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id     INTEGER NOT NULL REFERENCES books(id),
  condition   TEXT NOT NULL DEFAULT 'good',   -- new|good|worn|damaged
  shelf       TEXT
);

CREATE TABLE members (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  card_no       TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  joined        DATE NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE loans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  copy_id     INTEGER NOT NULL REFERENCES copies(id),
  member_id   INTEGER NOT NULL REFERENCES members(id),
  borrowed_on DATE NOT NULL,
  due_on      DATE NOT NULL,
  returned_on DATE                            -- nullable: still on loan
);`,
  },
  {
    id: 'banking',
    name: 'Banking ledger',
    dialect: 'PostgreSQL',
    sql: `-- Double-entry accounting. Every economic event becomes ONE
-- journal_entry with TWO+ entry_lines whose debits and credits sum to
-- zero. Money lives as INTEGER cents (never float). The shape behind
-- Stripe/Wise/Mercury.

-- @group: customer
CREATE TABLE customers (
  id          SERIAL PRIMARY KEY,
  full_name   VARCHAR(120) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  kyc_status  VARCHAR(20)  NOT NULL DEFAULT 'pending',  -- pending|verified|rejected
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- @group: customer, ledger
CREATE TABLE accounts (
  id          SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),         -- nullable: internal accounts (clearing, fees)
  kind        VARCHAR(20) NOT NULL,                     -- asset|liability|equity|revenue|expense
  name        VARCHAR(120) NOT NULL,
  currency    CHAR(3)  NOT NULL DEFAULT 'USD',          -- ISO 4217
  closed_at   TIMESTAMPTZ                               -- nullable: still open
);

-- @group: ledger
CREATE TABLE journal_entries (
  id           SERIAL PRIMARY KEY,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  description  VARCHAR(200) NOT NULL,
  external_ref VARCHAR(80)                              -- nullable: link to source event, e.g. Stripe charge id
);

-- @group: ledger
CREATE TABLE entry_lines (   -- the actual debits/credits
  id                 SERIAL PRIMARY KEY,
  journal_entry_id   INTEGER NOT NULL REFERENCES journal_entries(id),
  account_id         INTEGER NOT NULL REFERENCES accounts(id),
  amount_cents       BIGINT NOT NULL    -- signed; debits positive, credits negative; sum per journal_entry must be 0
);

-- @group: ledger
CREATE TABLE transfers (   -- higher-level "send money A -> B" wrapper
  id                  SERIAL PRIMARY KEY,
  from_account_id     INTEGER NOT NULL REFERENCES accounts(id),
  to_account_id       INTEGER NOT NULL REFERENCES accounts(id),
  amount_cents        BIGINT  NOT NULL,
  journal_entry_id    INTEGER NOT NULL REFERENCES journal_entries(id),
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'  -- pending|posted|reversed
);

-- @group: reporting
CREATE TABLE statements (   -- precomputed monthly view per account
  id            SERIAL PRIMARY KEY,
  account_id    INTEGER NOT NULL REFERENCES accounts(id),
  period        CHAR(7)  NOT NULL,                       -- YYYY-MM
  opening_cents BIGINT NOT NULL,
  closing_cents BIGINT NOT NULL
);`,
  },
]
