// Tolerant, dialect-agnostic SQL DDL parser.
// Handles PostgreSQL, MySQL, SQLite and generic ANSI CREATE TABLE / ALTER TABLE.
// It is deliberately forgiving: unknown clauses are skipped rather than throwing,
// so a partially-understood dump still produces a useful diagram.

export interface Column {
  name: string
  type: string
  nullable: boolean
  pk: boolean
  unique: boolean
  fk?: { table: string; column: string }
  default?: string
  comment?: string
}

export interface Table {
  name: string
  columns: Column[]
  comment?: string
  /**
   * Composite (multi-column) UNIQUE constraints declared on the table,
   * preserving each constraint's column tuple as a group. Single-column
   * inline `UNIQUE` lives on the column itself via `Column.unique` —
   * this field is ONLY the multi-column case so consumers can render
   * "these columns are unique together". Omitted when none present.
   *   `UNIQUE (a, b, c)`            -> [['a','b','c']]
   *   `UNIQUE (a, b), UNIQUE (c)`   -> [['a','b']]  (single (c) -> col.unique)
   */
  compositeUniques?: string[][]
}

export interface ForeignKey {
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
}

export interface Schema {
  tables: Table[]
  foreignKeys: ForeignKey[]
  warnings: string[]
  /**
   * Read-only groups derived from `-- @group: <name>` (or
   * `-- @group: a, b`) line comments placed IMMEDIATELY ABOVE a
   * `CREATE TABLE` statement (or on the same line as it). A table may
   * appear in multiple groups. The map preserves the order in which
   * each group's first annotation was encountered. Empty `{}` when
   * no annotations were used. These coexist with the user-managed
   * groups in the React store; they are NOT editable via UI.
   */
  groupAnnotations: Record<string, string[]>
}

// --- helpers -------------------------------------------------------------

/** Strip line + block comments without destroying string literals. */
function stripComments(sql: string): string {
  let out = ''
  let i = 0
  let quote: string | null = null
  while (i < sql.length) {
    const c = sql[i]
    const next = sql[i + 1]
    if (quote) {
      out += c
      if (c === quote) quote = null
      i++
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      out += c
      i++
      continue
    }
    if (c === '-' && next === '-') {
      while (i < sql.length && sql[i] !== '\n') i++
      continue
    }
    if (c === '#') {
      // MySQL line comment
      while (i < sql.length && sql[i] !== '\n') i++
      continue
    }
    if (c === '/' && next === '*') {
      i += 2
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++
      i += 2
      continue
    }
    out += c
    i++
  }
  return out
}

/** Split on top-level semicolons, respecting quotes and parentheses. */
function splitStatements(sql: string): string[] {
  const stmts: string[] = []
  let depth = 0
  let quote: string | null = null
  let cur = ''
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i]
    if (quote) {
      cur += c
      if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      cur += c
      continue
    }
    if (c === '(') depth++
    if (c === ')') depth--
    if (c === ';' && depth === 0) {
      if (cur.trim()) stmts.push(cur.trim())
      cur = ''
      continue
    }
    cur += c
  }
  if (cur.trim()) stmts.push(cur.trim())
  return stmts
}

/** Remove quoting, brackets and schema prefix from an identifier. */
function cleanIdent(raw: string): string {
  let id = raw.trim().replace(/[`"\[\]]/g, '')
  // strip schema / db qualifier: take last dotted segment
  const parts = id.split('.')
  id = parts[parts.length - 1]
  return id.trim()
}

/** Split the body of a CREATE TABLE (...) on top-level commas. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote: string | null = null
  let cur = ''
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (quote) {
      cur += c
      if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      cur += c
      continue
    }
    if (c === '(') depth++
    if (c === ')') depth--
    if (c === ',' && depth === 0) {
      parts.push(cur.trim())
      cur = ''
      continue
    }
    cur += c
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

const CONSTRAINT_KEYWORDS =
  /^(constraint|primary|foreign|unique|key|index|check|fulltext|spatial)\b/i

// matches: FOREIGN KEY (a, b) REFERENCES tbl (c, d)
const FK_RE =
  /foreign\s+key\s*\(([^)]+)\)\s*references\s+([^\s(]+)\s*(?:\(([^)]+)\))?/i

// inline column reference: ... REFERENCES tbl (col)
const INLINE_REF_RE = /references\s+([^\s(]+)\s*(?:\(\s*([^)\s]+)\s*\))?/i

/** Split a single physical line into code and trailing `--` / `#` comment. */
function splitLineComment(line: string): { code: string; comment: string } {
  let quote: string | null = null
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quote) {
      if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      continue
    }
    if (c === '-' && line[i + 1] === '-')
      return { code: line.slice(0, i), comment: line.slice(i + 2).trim() }
    if (c === '#')
      return { code: line.slice(0, i), comment: line.slice(i + 1).trim() }
  }
  return { code: line, comment: '' }
}

const COL_HEAD = /^\s*("[^"]+"|`[^`]+`|\[[^\]]+\]|[a-zA-Z_][\w$]*)/

/**
 * Attach comments to tables/columns by walking physical lines.
 * A comment on a column line binds to that column; a comment-only line
 * continues the previous column (or the table when no column seen yet).
 */
/** Match a "@group: name1, name2, …" annotation inside a comment body.
 *  Returns the parsed group names (trimmed, non-empty), or null if the
 *  comment isn't a group annotation. Comments that contain anything
 *  besides the annotation are left as regular table/column comments. */
function matchGroupAnnotation(comment: string): string[] | null {
  const m = comment.match(/^@group\s*:\s*(.+?)\s*$/i)
  if (!m) return null
  const names = m[1]
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 60)
  return names.length > 0 ? names : null
}

function associateComments(
  input: string,
  byName: Map<string, Table>,
  groupAnnotations: Record<string, string[]>,
): void {
  const lines = input.split(/\r?\n/)
  let table: Table | null = null
  let col: Column | null = null
  // Group names accumulated from comment-only lines that precede the
  // next CREATE TABLE. Reset after each CREATE or at a statement end.
  let pendingGroups: string[] = []
  const add = (cur: string | undefined, next: string) =>
    cur ? `${cur} ${next}` : next
  const recordGroups = (names: string[], tname: string) => {
    for (const g of names) {
      const arr = groupAnnotations[g] ?? (groupAnnotations[g] = [])
      if (!arr.includes(tname)) arr.push(tname)
    }
  }

  for (const line of lines) {
    const { code, comment } = splitLineComment(line)
    const lc = code.toLowerCase()

    // `@group:` annotation? Pick it up regardless of whether we're
    // currently inside a CREATE block — the previous statement may
    // have ended on the same line with `;`, leaving `table` stale.
    // Recognised annotations are consumed (don't fall through to the
    // comment-attach branch so they never become table/column comments).
    if (comment && !code.trim()) {
      const groups = matchGroupAnnotation(comment)
      if (groups) {
        pendingGroups.push(...groups)
        continue
      }
      // Non-annotation comment-only line BEFORE a CREATE TABLE has no
      // home — drop pending groups guarded by a real CREATE follow-up.
      if (!table) continue
    }

    const create = lc.match(/create\s+(?:\w+\s+)*table\s+(?:if\s+not\s+exists\s+)?([^\s(]+)/)
    if (create) {
      const tname = cleanIdent(create[1])
      table = byName.get(tname) ?? null
      col = null
      if (table) {
        // Same-line @group: annotation (e.g. `CREATE TABLE x ( -- @group: foo`).
        if (comment) {
          const groups = matchGroupAnnotation(comment)
          if (groups) pendingGroups.push(...groups)
          else table.comment = add(table.comment, comment)
        }
        if (pendingGroups.length) recordGroups(pendingGroups, tname)
      }
      pendingGroups = []
      // Single-line CREATE … ; — reset immediately so a follow-up
      // `-- @group:` line on the next physical line attributes to the
      // NEXT table, not this one.
      if (code.includes(';')) {
        table = null
        col = null
      }
      continue
    }
    if (!table) {
      // If a CREATE didn't follow, drop accumulated group annotations on
      // a non-comment line — they were meant for a table we never saw.
      if (code.trim()) pendingGroups = []
      continue
    }

    const head = code.match(COL_HEAD)
    const ident = head ? cleanIdent(head[1]) : ''
    const found =
      ident && !CONSTRAINT_KEYWORDS.test(ident)
        ? table.columns.find((c) => c.name === ident)
        : undefined

    if (found) {
      col = found
      if (comment) col.comment = add(col.comment, comment)
    } else if (comment) {
      // comment-only (or constraint) line: continue last column else table
      if (col) col.comment = add(col.comment, comment)
      else table.comment = add(table.comment, comment)
    }

    if (code.includes(';')) {
      table = null
      col = null
      pendingGroups = []
    }
  }
}

// --- main parse ----------------------------------------------------------

export function parseSchema(input: string): Schema {
  const warnings: string[] = []
  const tables: Table[] = []
  const foreignKeys: ForeignKey[] = []
  const tableByName = new Map<string, Table>()
  const groupAnnotations: Record<string, string[]> = {}

  if (!input.trim()) return { tables, foreignKeys, warnings, groupAnnotations }

  const sql = stripComments(input)
  const statements = splitStatements(sql)

  for (const stmt of statements) {
    const createMatch = stmt.match(
      /create\s+(?:global\s+|local\s+|temporary\s+|temp\s+|unlogged\s+)*table\s+(?:if\s+not\s+exists\s+)?([^\s(]+)\s*\(([\s\S]*)\)[^)]*$/i,
    )
    if (createMatch) {
      const tableName = cleanIdent(createMatch[1])
      const body = createMatch[2]
      const table: Table = { name: tableName, columns: [] }

      for (const part of splitTopLevel(body)) {
        const trimmed = part.trim()
        if (!trimmed) continue

        if (CONSTRAINT_KEYWORDS.test(trimmed)) {
          // table-level constraint
          const fk = trimmed.match(FK_RE)
          if (fk) {
            const cols = fk[1].split(',').map(cleanIdent)
            const refTable = cleanIdent(fk[2])
            const refCols = fk[3] ? fk[3].split(',').map(cleanIdent) : []
            cols.forEach((col, idx) => {
              foreignKeys.push({
                fromTable: tableName,
                fromColumn: col,
                toTable: refTable,
                toColumn: refCols[idx] ?? refCols[0] ?? 'id',
              })
            })
            continue
          }
          const pk = trimmed.match(/primary\s+key\s*\(([^)]+)\)/i)
          if (pk) {
            const pkCols = pk[1].split(',').map(cleanIdent)
            table.columns.forEach((c) => {
              if (pkCols.includes(c.name)) c.pk = true
            })
            continue
          }
          const uq = trimmed.match(/unique\s*(?:key\s+\S+\s*)?\(([^)]+)\)/i)
          if (uq) {
            const uqCols = uq[1].split(',').map(cleanIdent)
            table.columns.forEach((c) => {
              if (uqCols.includes(c.name)) c.unique = true
            })
            // Preserve the COMPOSITE structure so the UI can say
            // "these columns are unique together" — flat per-column
            // booleans lose that grouping. Skip 1-tuples; those are
            // already covered by `Column.unique`.
            if (uqCols.length >= 2) {
              ;(table.compositeUniques ??= []).push(uqCols)
            }
            continue
          }
          // CHECK / INDEX / KEY etc -> ignore
          continue
        }

        // column definition: <name> <type ...> <modifiers>
        const nameMatch = trimmed.match(/^("[^"]+"|`[^`]+`|\[[^\]]+\]|\S+)\s+([\s\S]+)$/)
        if (!nameMatch) continue
        const colName = cleanIdent(nameMatch[1])
        const rest = nameMatch[2]

        // type = leading token, including parenthesised length and array []
        const typeMatch = rest.match(
          /^([a-zA-Z_][\w]*(?:\s+(?:varying|precision|integer|int))?\s*(?:\([^)]*\))?(?:\s+unsigned)?(?:\s*\[\s*\])?)/i,
        )
        const type = typeMatch ? typeMatch[1].replace(/\s+/g, ' ').trim() : '?'

        const lower = rest.toLowerCase()
        const col: Column = {
          name: colName,
          type,
          nullable: !/not\s+null/.test(lower),
          pk: /primary\s+key/.test(lower),
          unique: /\bunique\b/.test(lower),
        }
        if (col.pk) col.nullable = false

        const def = rest.match(/default\s+('(?:[^']|'')*'|\S+)/i)
        if (def) col.default = def[1]

        const ref = rest.match(INLINE_REF_RE)
        if (ref) {
          const refTable = cleanIdent(ref[1])
          const refCol = ref[2] ? cleanIdent(ref[2]) : 'id'
          col.fk = { table: refTable, column: refCol }
          foreignKeys.push({
            fromTable: tableName,
            fromColumn: colName,
            toTable: refTable,
            toColumn: refCol,
          })
        }

        table.columns.push(col)
      }

      if (tableByName.has(tableName)) {
        warnings.push(`Duplicate table "${tableName}" — keeping the latest.`)
        const idx = tables.findIndex((t) => t.name === tableName)
        if (idx >= 0) tables.splice(idx, 1)
      }
      tables.push(table)
      tableByName.set(tableName, table)
      continue
    }

    // ALTER TABLE x ADD [CONSTRAINT ..] FOREIGN KEY (..) REFERENCES y (..)
    const alterMatch = stmt.match(/alter\s+table\s+(?:only\s+)?([^\s]+)\s+add\b/i)
    if (alterMatch) {
      const fk = stmt.match(FK_RE)
      if (fk) {
        const fromTable = cleanIdent(alterMatch[1])
        const cols = fk[1].split(',').map(cleanIdent)
        const refTable = cleanIdent(fk[2])
        const refCols = fk[3] ? fk[3].split(',').map(cleanIdent) : []
        cols.forEach((col, idx) => {
          foreignKeys.push({
            fromTable,
            fromColumn: col,
            toTable: refTable,
            toColumn: refCols[idx] ?? refCols[0] ?? 'id',
          })
        })
      }
      continue
    }
  }

  // mark FK flags on columns now that all tables are known
  for (const fk of foreignKeys) {
    const t = tableByName.get(fk.fromTable)
    const c = t?.columns.find((x) => x.name === fk.fromColumn)
    if (c && !c.fk) c.fk = { table: fk.toTable, column: fk.toColumn }
  }

  associateComments(input, tableByName, groupAnnotations)

  if (tables.length === 0)
    warnings.push('No CREATE TABLE statements found in the input.')

  // drop FKs that point at tables we never saw (keep them but warn)
  for (const fk of foreignKeys) {
    if (!tableByName.has(fk.toTable))
      warnings.push(
        `FK ${fk.fromTable}.${fk.fromColumn} references unknown table "${fk.toTable}".`,
      )
  }

  return { tables, foreignKeys, warnings, groupAnnotations }
}
