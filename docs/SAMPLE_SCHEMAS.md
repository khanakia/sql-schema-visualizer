# Sample Schemas

Copy any block below and paste it into the **⊕ Paste / Import SQL** tab in [SQL Schema Visualizer](https://khanakia.com/apps/sql-schema-visualizer/). Each one exercises a different parser / layout edge case. The built-in **⊞ Samples ▾** menu in the toolbar covers a different set: e-commerce, blog, SaaS, **relationship-notation demo** (every crow's-foot marker variant), **mini-ERP (groups demo)** with `-- @group:` annotations, **social network**, **project management** (MySQL backticks + ENUM + composite PKs), **library catalogue** (SQLite), and **banking ledger** (double-entry).

---

## 1. PostgreSQL — basic FK

```sql
CREATE TABLE customers (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE orders (
  id          SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  total_cents INTEGER NOT NULL
);
```

## 2. MySQL — backticks, AUTO_INCREMENT, table-level constraints

```sql
CREATE TABLE `users` (
  `id`    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(190) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE `posts` (
  `id`        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `author_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_a` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`)
);
```

## 3. SQLite — AUTOINCREMENT + inline REFERENCES

```sql
CREATE TABLE org (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);
CREATE TABLE member (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES org(id),
  role   TEXT NOT NULL DEFAULT 'member'
);
```

## 4. Self-referential FK (clean self-loop edge)

```sql
CREATE TABLE employees (
  id         integer PRIMARY KEY,
  name       text NOT NULL,
  manager_id integer REFERENCES employees(id)
);
```

## 5. Circular FKs (a → b → a)

```sql
CREATE TABLE a ( id int PRIMARY KEY, b_id int REFERENCES b(id) );
CREATE TABLE b ( id int PRIMARY KEY, a_id int REFERENCES a(id) );
```

## 6. ALTER TABLE ADD FOREIGN KEY

```sql
CREATE TABLE dept ( id int PRIMARY KEY );
CREATE TABLE emp ( id int PRIMARY KEY, dept_id int );
ALTER TABLE emp ADD CONSTRAINT fk_dept FOREIGN KEY (dept_id) REFERENCES dept (id);
```

## 7. Schema-qualified names (prefix stripped)

```sql
CREATE TABLE app.accounts (
  id   uuid PRIMARY KEY,
  name text NOT NULL
);
CREATE TABLE app.sessions (
  id         uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES app.accounts(id)
);
```

## 8. Inline `--` and `#` comments (toggle Comments in the toolbar)

```sql
CREATE TABLE product_supplier (   -- the cost edge
  id         text PRIMARY KEY,
  unit_cost  numeric(14,4),   -- USER INPUT
  netto_cost numeric(14,4)    # CALCULATED
);
```

## 9. Composite primary key + join table

```sql
CREATE TABLE post_tags (
  post_id BIGINT NOT NULL,
  tag_id  INT NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  CONSTRAINT fk_p FOREIGN KEY (post_id) REFERENCES posts (id),
  CONSTRAINT fk_t FOREIGN KEY (tag_id) REFERENCES tags (id)
);
```

## 10. Messy but valid — block comments, quoted weird names, IF NOT EXISTS

```sql
-- dump header
/* block
   comment */
CREATE TABLE IF NOT EXISTS "Weird.Name" (
  "Id"        int PRIMARY KEY,
  "Full Name" varchar(100) not null,
  notes       text
); -- trailing
```

## 11. Dangling FK (references a table not in the dump → warning)

```sql
CREATE TABLE only_table (
  id   int PRIMARY KEY,
  x_id int REFERENCES missing_table(id)
);
```

## 12. `-- @group:` annotations (auto-create groups from SQL)

Open the **Groups** tab in the sidebar after pasting — three derived groups appear with a 📌 + `SQL` badge. Click 👁 on any of them to filter the canvas to its members. Note `users` belongs to TWO groups (auth + content) via the comma-syntax.

```sql
-- @group: auth, content
CREATE TABLE users (id int PRIMARY KEY, email varchar(255));

-- @group: auth
CREATE TABLE sessions (id int PRIMARY KEY, user_id int REFERENCES users(id));

-- @group: auth
CREATE TABLE api_keys (id int PRIMARY KEY, user_id int REFERENCES users(id));

-- @group: content
CREATE TABLE posts (id int PRIMARY KEY, author_id int REFERENCES users(id));

-- @group: content
CREATE TABLE comments (id int PRIMARY KEY, post_id int REFERENCES posts(id));

-- @group: billing
CREATE TABLE customers (id int PRIMARY KEY, user_id int REFERENCES users(id));

-- @group: billing
CREATE TABLE invoices (id int PRIMARY KEY, customer_id int REFERENCES customers(id));
```

---

These same snippets back the parser unit tests in `packages/core/src/snippets.ts` — if you find SQL that renders wrong, add it there and open an issue or PR.
