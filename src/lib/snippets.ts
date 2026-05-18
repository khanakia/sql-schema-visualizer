// Hand-picked SQL DDL snippets that exercise tricky parser cases.
// Used by the parser unit tests; also handy as manual paste-in test cases.

export const snippets = {
  postgres: `CREATE TABLE customers (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE orders (
  id          SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  total_cents INTEGER NOT NULL
);`,

  mysqlBackticks: `CREATE TABLE \`users\` (
  \`id\`    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`email\` VARCHAR(190) NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uq_email\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE \`posts\` (
  \`id\`        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`author_id\` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (\`id\`),
  CONSTRAINT \`fk_a\` FOREIGN KEY (\`author_id\`) REFERENCES \`users\` (\`id\`)
);`,

  sqlite: `CREATE TABLE org (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);
CREATE TABLE member (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES org(id),
  role   TEXT NOT NULL DEFAULT 'member'
);`,

  selfReference: `CREATE TABLE employees (
  id         integer PRIMARY KEY,
  name       text NOT NULL,
  manager_id integer REFERENCES employees(id)
);`,

  circular: `CREATE TABLE a ( id int PRIMARY KEY, b_id int REFERENCES b(id) );
CREATE TABLE b ( id int PRIMARY KEY, a_id int REFERENCES a(id) );`,

  alterAddFk: `CREATE TABLE dept ( id int PRIMARY KEY );
CREATE TABLE emp ( id int PRIMARY KEY, dept_id int );
ALTER TABLE emp ADD CONSTRAINT fk_dept FOREIGN KEY (dept_id) REFERENCES dept (id);`,

  schemaQualified: `CREATE TABLE app.accounts (
  id   uuid PRIMARY KEY,
  name text NOT NULL
);
CREATE TABLE app.sessions (
  id         uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES app.accounts(id)
);`,

  comments: `CREATE TABLE product_supplier (   -- the cost edge
  id         text PRIMARY KEY,
  unit_cost  numeric(14,4),   -- USER INPUT
  netto_cost numeric(14,4)    # CALCULATED
);`,

  compositeKey: `CREATE TABLE post_tags (
  post_id BIGINT NOT NULL,
  tag_id  INT NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  CONSTRAINT fk_p FOREIGN KEY (post_id) REFERENCES posts (id),
  CONSTRAINT fk_t FOREIGN KEY (tag_id) REFERENCES tags (id)
);`,

  messyButValid: `-- dump header
/* block
   comment */
CREATE TABLE IF NOT EXISTS "Weird.Name" (
  "Id"       int PRIMARY KEY,
  "Full Name" varchar(100) not null,
  notes      text
); -- trailing`,

  danglingFk: `CREATE TABLE only_table (
  id   int PRIMARY KEY,
  x_id int REFERENCES missing_table(id)
);`,

  empty: `   `,

  noTables: `SELECT 1; -- not DDL`,
}

export type SnippetKey = keyof typeof snippets
