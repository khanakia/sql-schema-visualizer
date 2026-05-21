---
name: sql-prep
description: Annotate a SQL schema file for the SQL Schema Visualizer — adds `-- @group:` tags for table clusters and `/* @doc */` markdown descriptions for tables and columns, then sanity-checks the SQL still parses. Use when the user says "prep this SQL", "annotate this DDL", "add @group / @doc to this schema", or "make this schema diagram-ready".
license: MIT
metadata:
  author: khanakia
  version: "1.0.0"
  homepage: https://khanakia.com/apps/sql-schema-visualizer/
  repository: https://github.com/khanakia/sql-schema-visualizer
---

# sql-prep — annotate a SQL file for SQL Schema Visualizer

You're preparing a `.sql` file so the SQL Schema Visualizer renders it richly.
The visualizer reads two custom annotations the parser understands; both are
positional and pure SQL comments — nothing breaks for normal DB tools.

## What you'll add

### 1. `-- @group: name1, name2` — table grouping tags

One-liner SQL comment(s) immediately above a `CREATE TABLE`. A table can
belong to multiple groups via comma syntax, and multiple `@group` lines stack:

```sql
-- @group: auth, audit
CREATE TABLE users ( … );
```

Surfaces in the sidebar's **Groups** tab with a 📌 SQL badge. Read-only — to
edit, edit the SQL.

### 2. `/* @doc … */` — multi-paragraph markdown descriptions

Wrap markdown in a block comment marked with `@doc` right after the `/*`.
Place it OUTSIDE the parens (above `CREATE TABLE`) for a **table** description,
or INSIDE the parens (above a column line) for a **column** description:

```sql
/* @doc
# users

Authoritative account table. **One row per user.**

- `email` is lower-cased at the app layer
- Soft-deletes go to `users_deleted`
*/
CREATE TABLE users (
  id    SERIAL PRIMARY KEY,
  /* @doc
  ## email

  The canonical login key. *Never re-issued.*
  */
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL    -- short -- comments still work too
);
```

Renders via the 📖 / 📝 badges on the diagram (hover preview, click for the
slide-in drawer). Supports headings (`#`–`######`), bold/italic, inline +
fenced code, lists, links. Multiple `@doc` blocks for the same target
concatenate with `\n\n` between.

## Process

When the user invokes this skill, follow these steps:

### Step 1 — locate the SQL file

If the user named a file, use that. If they pasted SQL in chat, ask where to
write it. If multiple `.sql` files exist and the user didn't pick one, list
them with `Read`/`Glob` and ask which to annotate.

### Step 2 — analyze the schema

Read the file. Build a mental model:

- Tables, their PKs and FKs (so you understand the relationship graph).
- Obvious clusters: tables that reference each other directly or share a
  prefix (`auth_*`, `billing_*`) are candidate groups. Tables that hang off
  one "hub" entity often deserve being grouped with it.
- Tables that look domain-load-bearing (sit in many FK edges, have many
  columns, or look like aggregates) deserve longer `@doc` blocks.
- Columns where the name alone doesn't tell the whole story — anything
  involving money, time zones, nullable foreign keys, soft-delete flags,
  legal/compliance concerns — deserves a column-level `@doc`.

### Step 3 — propose grouping + descriptions

Before writing anything, **propose** the plan to the user as a compact list:

```
Groups I'd add:
- auth     -> users, sessions, api_keys
- billing  -> customers, plans, subscriptions, invoices, invoice_items
- content  -> posts, post_tags, tags, comments       (users also tagged here)

Table @doc to write: users, invoices, subscriptions
Column @doc to write:
  users.email      — login-key conventions
  invoices.state   — state machine
  subscriptions.cancelled_at — nullable means active
```

Wait for the user to trim / approve. Don't write content for tables you
weren't asked about — restraint here.

### Step 4 — generate annotations

Write the `@group:` lines first (one line per group above each member table —
preserve existing top-of-file comments). Then write the `@doc` blocks. Style
rules:

- Table-level `@doc` blocks: start with `# tablename` (lowercase). Then a
  one-paragraph "what" + a one-paragraph "why / when / by whom". A short
  bullet list of invariants the reader should know. Skip filler — every
  sentence earns its place.
- Column-level `@doc` blocks: start with `## columnname`. Then ONE
  paragraph explaining the column's contract (units, allowed values,
  who writes it, who reads it, what breaks if it's wrong). 1–2 bullets
  if helpful. Don't repeat the type — it's right next to the badge.
- Don't paraphrase the SQL itself ("this is the primary key of the users
  table"). Add information that's NOT inferable from the DDL.
- Code references: backtick `column_name`s; use fenced code blocks for
  short SQL examples or pseudocode.
- Links: only if the user provides them. Don't invent URLs.

### Step 5 — write back + sanity-check

Apply edits with `Edit` (preserving the original `CREATE TABLE` line
verbatim — annotations go ABOVE it, never inside the CREATE statement
itself except for column-level `@doc` blocks which go above the column line).

Then verify the parse:

```bash
cd /Volumes/D/www/projects/khanakia/khanakia_com/sql-schema-visualizer
pnpm --filter @khanakia/sql-schema-core test   # parser tests still green
```

Optionally drop the SQL into a quick parse to confirm the new annotations
land — the easiest dev-time check is `task dev` then paste it into the
"⊕ Paste / Import SQL" tab.

## Hard rules

- **Never invent foreign keys, columns, or constraints.** Annotations only.
- **Never reorder or rename columns/tables.** Original DDL stays byte-stable
  except for the inserted `--`/`/* … */` lines.
- **Don't add `@doc` to every column.** Restraint — only when the name
  alone doesn't tell the story. Cardinality of useful annotations is
  usually 10–20% of columns, not 100%.
- **Don't add `@group` to every table.** A group of one is useless;
  unless a table genuinely stands alone with no peers, fold it into a
  cluster or skip the tag.
- **Don't invent URLs in links.** If the user wants links, they'll provide.

## Quick reference (paste into the file)

```sql
-- @group: section-name              (optional: -- @group: a, b, c)
/* @doc
# tablename
One-paragraph what + why.
*/
CREATE TABLE tablename (
  id INT PRIMARY KEY,
  /* @doc
  ## columnname
  One-paragraph contract: units, who writes, who reads, what breaks.
  */
  columnname TEXT NOT NULL
);
```

## Project context

This skill ships with the [SQL Schema Visualizer](https://khanakia.com/apps/sql-schema-visualizer/). The annotation syntax is defined in `packages/core/src/parser.ts` (`extractDocAnnotations` + `matchGroupAnnotation`). Built-in examples: the `doc-demo`, `groups-demo`, and `social` samples in `packages/core/src/samples.ts` show real usage.
