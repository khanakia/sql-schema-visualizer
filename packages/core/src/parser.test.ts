import { describe, it, expect } from 'vitest'
import { parseSchema } from './parser'
import { snippets } from './snippets'

const table = (sql: string, name: string) =>
  parseSchema(sql).tables.find((t) => t.name === name)!

describe('parseSchema — dialects', () => {
  it('parses PostgreSQL: tables, PK, unique, NOT NULL, default, FK', () => {
    const s = parseSchema(snippets.postgres)
    expect(s.tables.map((t) => t.name)).toEqual(['customers', 'orders'])
    const customers = table(snippets.postgres, 'customers')
    const id = customers.columns.find((c) => c.name === 'id')!
    expect(id.pk).toBe(true)
    expect(id.nullable).toBe(false)
    const email = customers.columns.find((c) => c.name === 'email')!
    expect(email.unique).toBe(true)
    expect(email.nullable).toBe(false)
    const createdAt = customers.columns.find((c) => c.name === 'created_at')!
    expect(createdAt.default).toBeTruthy()
    expect(s.foreignKeys).toContainEqual({
      fromTable: 'orders',
      fromColumn: 'customer_id',
      toTable: 'customers',
      toColumn: 'id',
    })
  })

  it('parses MySQL backtick identifiers, table-level PK/UNIQUE/FK', () => {
    const s = parseSchema(snippets.mysqlBackticks)
    const users = table(snippets.mysqlBackticks, 'users')
    expect(users.columns.find((c) => c.name === 'id')!.pk).toBe(true)
    expect(users.columns.find((c) => c.name === 'email')!.unique).toBe(true)
    expect(s.foreignKeys).toContainEqual({
      fromTable: 'posts',
      fromColumn: 'author_id',
      toTable: 'users',
      toColumn: 'id',
    })
  })

  it('parses SQLite AUTOINCREMENT + inline REFERENCES', () => {
    const s = parseSchema(snippets.sqlite)
    expect(s.tables).toHaveLength(2)
    expect(s.foreignKeys).toContainEqual({
      fromTable: 'member',
      fromColumn: 'org_id',
      toTable: 'org',
      toColumn: 'id',
    })
  })
})

describe('parseSchema — relationships', () => {
  it('handles self-referential FK without duplicating the table', () => {
    const s = parseSchema(snippets.selfReference)
    expect(s.tables).toHaveLength(1)
    expect(s.foreignKeys).toEqual([
      {
        fromTable: 'employees',
        fromColumn: 'manager_id',
        toTable: 'employees',
        toColumn: 'id',
      },
    ])
  })

  it('handles circular FKs (a -> b -> a) cleanly', () => {
    const s = parseSchema(snippets.circular)
    expect(s.tables.map((t) => t.name).sort()).toEqual(['a', 'b'])
    expect(s.foreignKeys).toHaveLength(2)
    expect(s.foreignKeys).toContainEqual({
      fromTable: 'a',
      fromColumn: 'b_id',
      toTable: 'b',
      toColumn: 'id',
    })
    expect(s.foreignKeys).toContainEqual({
      fromTable: 'b',
      fromColumn: 'a_id',
      toTable: 'a',
      toColumn: 'id',
    })
  })

  it('picks up ALTER TABLE ADD FOREIGN KEY', () => {
    const s = parseSchema(snippets.alterAddFk)
    expect(s.foreignKeys).toContainEqual({
      fromTable: 'emp',
      fromColumn: 'dept_id',
      toTable: 'dept',
      toColumn: 'id',
    })
  })

  it('strips schema/db qualifier from identifiers', () => {
    const s = parseSchema(snippets.schemaQualified)
    expect(s.tables.map((t) => t.name).sort()).toEqual([
      'accounts',
      'sessions',
    ])
    expect(s.foreignKeys[0]).toMatchObject({
      fromTable: 'sessions',
      toTable: 'accounts',
    })
  })

  it('parses composite primary keys', () => {
    const pt = table(snippets.compositeKey, 'post_tags')
    expect(pt.columns.filter((c) => c.pk).map((c) => c.name)).toEqual([
      'post_id',
      'tag_id',
    ])
  })
})

describe('parseSchema — comments', () => {
  it('captures table- and column-level -- and # comments', () => {
    const t = table(snippets.comments, 'product_supplier')
    expect(t.comment).toMatch(/cost edge/)
    expect(
      t.columns.find((c) => c.name === 'unit_cost')!.comment,
    ).toMatch(/USER INPUT/)
    expect(
      t.columns.find((c) => c.name === 'netto_cost')!.comment,
    ).toMatch(/CALCULATED/)
  })
})

describe('parseSchema — resilience', () => {
  it('handles quoted weird names, block comments, IF NOT EXISTS', () => {
    const s = parseSchema(snippets.messyButValid)
    expect(s.tables).toHaveLength(1)
    const t = s.tables[0]
    expect(t.name).toBe('Weird.Name'.split('.').pop())
    expect(t.columns.map((c) => c.name)).toContain('Full Name')
  })

  it('warns about FK to an unknown table but still parses', () => {
    const s = parseSchema(snippets.danglingFk)
    expect(s.tables).toHaveLength(1)
    expect(s.warnings.join(' ')).toMatch(/unknown table/i)
  })

  it('empty input yields no tables and no throw', () => {
    const s = parseSchema(snippets.empty)
    expect(s.tables).toHaveLength(0)
  })

  it('non-DDL input warns "no CREATE TABLE"', () => {
    const s = parseSchema(snippets.noTables)
    expect(s.tables).toHaveLength(0)
    expect(s.warnings.join(' ')).toMatch(/no create table/i)
  })

  it('is idempotent — parsing twice gives the same result', () => {
    const a = parseSchema(snippets.postgres)
    const b = parseSchema(snippets.postgres)
    expect(b).toEqual(a)
  })
})

describe('composite UNIQUE constraints', () => {
  it('captures a multi-column UNIQUE as a structured group', () => {
    const s = parseSchema(`
CREATE TABLE memberships (
  id        INT PRIMARY KEY,
  team_id   INT NOT NULL,
  shop_id   INT NOT NULL,
  code      TEXT NOT NULL,
  UNIQUE (team_id, shop_id, code)
);
`)
    const t = s.tables[0]
    expect(t.compositeUniques).toEqual([['team_id', 'shop_id', 'code']])
    // Each participating column is also flagged for inline glyph render.
    const cols = Object.fromEntries(t.columns.map((c) => [c.name, c.unique]))
    expect(cols.team_id).toBe(true)
    expect(cols.shop_id).toBe(true)
    expect(cols.code).toBe(true)
    expect(cols.id).toBe(false)
  })

  it('inline single-column UNIQUE does NOT add a composite entry', () => {
    const s = parseSchema(`
CREATE TABLE t (id INT PRIMARY KEY, email TEXT UNIQUE NOT NULL);
`)
    expect(s.tables[0].compositeUniques).toBeUndefined()
    expect(s.tables[0].columns.find((c) => c.name === 'email')?.unique).toBe(true)
  })

  it('multiple composite UNIQUE blocks on the same table', () => {
    const s = parseSchema(`
CREATE TABLE t (
  a INT, b INT, c INT, d INT,
  UNIQUE (a, b),
  UNIQUE (c, d)
);
`)
    expect(s.tables[0].compositeUniques).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('MySQL `UNIQUE KEY name (cols)` syntax', () => {
    const s = parseSchema(`
CREATE TABLE members (
  id INT PRIMARY KEY,
  workspace_id INT,
  email VARCHAR(255),
  UNIQUE KEY uq_member_ws_email (workspace_id, email)
);
`)
    expect(s.tables[0].compositeUniques).toEqual([['workspace_id', 'email']])
  })
})

describe('-- @group: annotations', () => {
  it('captures a single-group annotation on the line above CREATE', () => {
    const s = parseSchema(`
-- @group: billing
CREATE TABLE invoices (id INT PRIMARY KEY);
`)
    expect(s.groupAnnotations).toEqual({ billing: ['invoices'] })
  })

  it('supports multi-membership via comma-separated names', () => {
    const s = parseSchema(`
-- @group: billing, reporting, finance
CREATE TABLE invoices (id INT PRIMARY KEY);
`)
    expect(s.groupAnnotations).toEqual({
      billing: ['invoices'],
      reporting: ['invoices'],
      finance: ['invoices'],
    })
  })

  it('accumulates multiple comment lines for the next table', () => {
    const s = parseSchema(`
-- @group: a
-- @group: b
CREATE TABLE x (id INT PRIMARY KEY);
`)
    expect(s.groupAnnotations).toEqual({ a: ['x'], b: ['x'] })
  })

  it('groups multiple tables under the same name in declaration order', () => {
    const s = parseSchema(`
-- @group: auth
CREATE TABLE users (id INT PRIMARY KEY);
-- @group: auth
CREATE TABLE sessions (id INT PRIMARY KEY, user_id INT);
-- @group: auth
CREATE TABLE api_keys (id INT PRIMARY KEY, user_id INT);
`)
    expect(s.groupAnnotations.auth).toEqual(['users', 'sessions', 'api_keys'])
  })

  it('does not treat normal comments as annotations', () => {
    const s = parseSchema(`
CREATE TABLE plain (id INT PRIMARY KEY);   -- Just a regular description.
`)
    expect(s.groupAnnotations).toEqual({})
    // Same-line trailing comment IS captured as the table comment
    // (proves a normal comment doesn't get swallowed by annotation logic).
    expect(s.tables[0].comment).toBe('Just a regular description.')
  })

  it('drops annotations not followed by a CREATE TABLE', () => {
    const s = parseSchema(`
-- @group: orphan
SELECT 1;
CREATE TABLE x (id INT PRIMARY KEY);
`)
    expect(s.groupAnnotations).toEqual({})
  })

  it('returns empty object when no annotations present', () => {
    const s = parseSchema('CREATE TABLE t (id INT PRIMARY KEY);')
    expect(s.groupAnnotations).toEqual({})
  })

  it('ignores group names that are empty or > 60 chars', () => {
    const long = 'x'.repeat(61)
    const s = parseSchema(`
-- @group: ,  , ${long}, ok
CREATE TABLE t (id INT PRIMARY KEY);
`)
    expect(s.groupAnnotations).toEqual({ ok: ['t'] })
  })
})
