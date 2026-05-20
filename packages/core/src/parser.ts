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
  /** Short single-line description from a trailing `--` comment. */
  comment?: string
  /** Long markdown body from a `/* @doc ... *​/` block immediately above
   *  this column line (inside the CREATE TABLE parens). Multiple `@doc`
   *  blocks above the same column concatenate with `\n\n`. */
  description?: string
}

export interface Table {
  name: string
  columns: Column[]
  /** Short single-line description (legacy: `--` comment near CREATE). */
  comment?: string
  /** Long markdown body from a `/* @doc ... *​/` block OUTSIDE the
   *  CREATE TABLE parens (typically immediately above it). Multiple
   *  `@doc` blocks for the same table concatenate with `\n\n`. */
  description?: string
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

/**
 * Extract `/​* @doc ... *​/` markdown-body annotations and attribute
 * them to the next table (when the block is OUTSIDE parens) or the
 * next column definition (when the block is INSIDE parens). Multiple
 * @doc blocks for the same target concatenate with `\n\n` so several
 * blocks can stack to compose richer prose.
 *
 * Runs as a SEPARATE pass after `associateComments`, scanning the
 * original (pre-strip) input. The pass is paren-depth-aware so the
 * same `@doc` syntax can target a table or a column depending on
 * where it sits — see PLAN.md / SAMPLE_SCHEMAS.md for the convention.
 */
/** Strip the longest common leading whitespace shared by every non-empty
 *  line. Lets users indent `/​* @doc ... *​/` bodies inside the CREATE
 *  parens for readability without that indent showing up in the
 *  rendered markdown. */
function dedent(s: string): string {
  const lines = s.split('\n')
  let min = Infinity
  for (const l of lines) {
    if (l.trim() === '') continue
    const m = l.match(/^[ \t]*/)
    const lead = m ? m[0].length : 0
    if (lead < min) min = lead
  }
  if (!isFinite(min) || min === 0) return s
  return lines.map((l) => l.slice(min)).join('\n')
}

function extractDocAnnotations(
  input: string,
  byName: Map<string, Table>,
): void {
  const lines = input.split(/\r?\n/)
  let table: Table | null = null
  let parenDepth = 0
  // @doc block accumulator (multi-line).
  let inDoc = false
  let docBuffer: string[] = []
  let docStartParenDepth = 0
  // Block captured but not yet attributed (waiting for the next
  // CREATE TABLE or column line). Held inside an object so TS doesn't
  // narrow it to `null` after each `pending.v = null` assignment in
  // the loop — closure writes from `pushPending` are otherwise
  // invisible to control-flow narrowing.
  const pending: { v: { body: string; wasInParen: boolean } | null } = {
    v: null,
  }

  const docOpen = /\/\*\s*@doc\b\s?(.*)$/
  const merge = (cur: string | undefined, next: string) =>
    cur ? `${cur}\n\n${next}` : next
  // Push a freshly-captured @doc body onto `pending`. If a previous
  // pending block has the SAME scope (both outside parens, or both
  // inside) the two concatenate — that's the "multiple @doc blocks
  // above the same target accumulate" rule.
  const pushPending = (body: string, wasInParen: boolean) => {
    if (pending.v && pending.v.wasInParen === wasInParen) {
      pending.v = { body: merge(pending.v.body, body), wasInParen }
    } else {
      pending.v = { body, wasInParen }
    }
  }

  // Update paren depth by walking characters in `s`, ignoring SQL
  // strings and trailing `--` comments. Block comments shouldn't be
  // counted (they're handled by the @doc state machine above).
  const trackParens = (s: string) => {
    let inStr = false
    let strCh = ''
    for (let i = 0; i < s.length; i++) {
      const ch = s[i]
      if (inStr) {
        if (ch === strCh && s[i - 1] !== '\\') inStr = false
        continue
      }
      if (ch === '-' && s[i + 1] === '-') break // rest is line comment
      if (ch === '/' && s[i + 1] === '*') {
        // Skip past closing */ on the same line if present.
        const close = s.indexOf('*/', i + 2)
        if (close !== -1) {
          i = close + 1
          continue
        }
        break // unterminated on this line — handled by @doc state next iters
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        inStr = true
        strCh = ch
        continue
      }
      if (ch === '(') parenDepth++
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1)
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // ── @doc block state machine ───────────────────────────────────
    if (inDoc) {
      const closeIdx = line.indexOf('*/')
      if (closeIdx === -1) {
        docBuffer.push(line)
        continue
      }
      docBuffer.push(line.slice(0, closeIdx))
      const body = dedent(
        docBuffer
          .join('\n')
          .replace(/^\s*\n/, '')   // drop leading blank line
          .replace(/\n\s*$/, ''),  // drop trailing blank line
      )
      pushPending(body, docStartParenDepth > 0)
      inDoc = false
      docBuffer = []
      // Whatever comes after */ on this line is rare DDL; ignore for
      // attribution. paren/column logic skipped for the rest of line.
      continue
    } else {
      const m = line.match(docOpen)
      if (m) {
        const after = m[1] ?? ''
        const closeIdx = after.indexOf('*/')
        if (closeIdx !== -1) {
          // Single-line @doc block.
          pushPending(after.slice(0, closeIdx).trim(), parenDepth > 0)
        } else {
          inDoc = true
          docStartParenDepth = parenDepth
          docBuffer = after ? [after] : []
        }
        continue
      }
    }

    // ── CREATE TABLE? attribute outside-parens @doc to the table ──
    const create = line.toLowerCase().match(
      /create\s+(?:\w+\s+)*table\s+(?:if\s+not\s+exists\s+)?([^\s(]+)/,
    )
    if (create) {
      const tname = cleanIdent(create[1])
      table = byName.get(tname) ?? null
      const p = pending.v
      if (table && p && !p.wasInParen) {
        table.description = merge(table.description, p.body)
        pending.v = null
      }
      trackParens(line)
      if (line.includes(';')) {
        parenDepth = 0
        table = null
        pending.v = null
      }
      continue
    }

    if (!table) {
      // Not in any CREATE TABLE body. Just track parens for safety;
      // outside-CREATE @doc blocks with no follow-up table are dropped.
      trackParens(line)
      continue
    }

    // ── Column-definition line? attribute in-parens @doc to it ────
    const { code } = splitLineComment(line)
    const head = code.match(COL_HEAD)
    if (head) {
      const ident = cleanIdent(head[1])
      if (!CONSTRAINT_KEYWORDS.test(ident)) {
        const col = table.columns.find((c) => c.name === ident)
        const p = pending.v
        if (col && p && p.wasInParen) {
          col.description = merge(col.description, p.body)
          pending.v = null
        }
      }
    }

    trackParens(line)
    if (line.includes(';')) {
      parenDepth = 0
      table = null
      pending.v = null
    }
  }
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
  // Skip lines inside `/* @doc ... */` blocks — those bodies are
  // markdown (extracted separately by extractDocAnnotations) and must
  // not be re-parsed as `--` / `#` table comments here. A `# Heading`
  // line inside an @doc block would otherwise be mis-read as a MySQL
  // line-comment and attached to the previous column.
  let inDoc = false
  const docOpenRe = /\/\*\s*@doc\b/
  const add = (cur: string | undefined, next: string) =>
    cur ? `${cur} ${next}` : next
  const recordGroups = (names: string[], tname: string) => {
    for (const g of names) {
      const arr = groupAnnotations[g] ?? (groupAnnotations[g] = [])
      if (!arr.includes(tname)) arr.push(tname)
    }
  }

  for (const line of lines) {
    if (inDoc) {
      if (line.includes('*/')) inDoc = false
      continue
    }
    if (docOpenRe.test(line)) {
      // Enter @doc state only if the closing */ isn't on the same line.
      const after = line.slice(line.search(docOpenRe))
      const closeIdx = after.indexOf('*/', after.indexOf('@doc') + 4)
      if (closeIdx === -1) inDoc = true
      continue
    }
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
  extractDocAnnotations(input, tableByName)

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
