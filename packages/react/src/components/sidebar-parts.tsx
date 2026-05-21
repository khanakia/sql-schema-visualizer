// Atomic, store-driven sidebar primitives. Compose your own panel from
// these (or use the bundled <SchemaSidebar>). Each reads/writes the
// shared store and is headless of outer layout.

import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { ExportBackupButton, ImportBackupButton } from './Backup'
import { renderMarkdown } from '../markdown'

/** Search input — filters the store query; Enter jumps to the first hit. */
export function SchemaSearch({
  className = '',
  placeholder = 'Search tables & fields…  (Enter to jump)',
}: {
  className?: string
  placeholder?: string
}) {
  const search = useStore((s) => s.search)
  const setSearch = useStore((s) => s.setSearch)
  const schema = useStore((s) => s.schema)
  const focusTable = useStore((s) => s.focusTable)

  const jumpFirst = () => {
    const q = search.trim().toLowerCase()
    for (const t of schema.tables) {
      if (t.name.toLowerCase().includes(q)) return focusTable(t.name)
      const col = q
        ? t.columns.find((c) =>
            c.name.toLowerCase().includes(q) ||
            (c.comment ?? '').toLowerCase().includes(q) ||
            (c.description ?? '').toLowerCase().includes(q),
          )
        : undefined
      if (col) return focusTable(t.name, col.name)
    }
  }

  return (
    <input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && jumpFirst()}
      placeholder={placeholder}
      className={`w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-strong)] outline-none placeholder:text-[var(--text-soft)] focus:border-purple-500 ${className}`}
    />
  )
}

/** Parser warnings, hidden when there are none. */
export function SchemaWarnings({ className = '' }: { className?: string }) {
  const warnings = useStore((s) => s.schema.warnings)
  if (warnings.length === 0) return null
  return (
    <div
      className={`m-3 rounded-md border border-amber-700/40 bg-amber-950/30 p-2 text-[11px] text-amber-300 ${className}`}
    >
      {warnings.map((w, i) => (
        <div key={i}>⚠ {w}</div>
      ))}
    </div>
  )
}

/** Searchable table list; clicking a table/column navigates the canvas. */
export function TableList({ className = '' }: { className?: string }) {
  const search = useStore((s) => s.search)
  const schema = useStore((s) => s.schema)
  const focusTable = useStore((s) => s.focusTable)

  const q = search.trim().toLowerCase()
  const tables = schema.tables
    .map((t) => ({
      t,
      nameHit: t.name.toLowerCase().includes(q),
      // Match columns by name, short comment, OR @doc description body —
      // lets the search box also dig into long-form prose.
      colHits: q
        ? t.columns.filter(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              (c.comment ?? '').toLowerCase().includes(q) ||
              (c.description ?? '').toLowerCase().includes(q),
          )
        : [],
    }))
    .filter(({ nameHit, colHits }) => !q || nameHit || colHits.length > 0)

  return (
    <div className={`overflow-y-auto ${className}`}>
      <SchemaWarnings />
      {tables.length === 0 && (
        <p className="p-4 text-xs text-[var(--text-soft)]">No matches.</p>
      )}
      {tables.map(({ t, colHits }) => (
        <div key={t.name}>
          <button
            onClick={() => focusTable(t.name)}
            className="block w-full px-4 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            <span className="font-medium">{t.name}</span>
            <span className="ml-2 text-[11px] text-[var(--text-soft)]">
              {t.columns.length} cols
            </span>
          </button>
          {colHits.map((c) => (
            <button
              key={c.name}
              onClick={() => focusTable(t.name, c.name)}
              className="flex w-full items-center gap-2 px-4 py-1 pl-8 text-left text-xs text-[var(--text)] hover:bg-[var(--surface-2)] hover:text-purple-300"
            >
              <span className="text-[var(--text-soft)]">↳</span>
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-[10px] uppercase text-[var(--text-soft)]">
                {c.type}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

/** .sql file import + Clear + paste textarea (live-parses on change). */
export function SqlImport({ className = '' }: { className?: string }) {
  const sql = useStore((s) => s.sql)
  const setSql = useStore((s) => s.setSql)
  return (
    <div className={`flex flex-1 flex-col ${className}`}>
      <div className="flex gap-2 border-b border-[var(--border-soft)] p-3">
        <label className="flex-1 cursor-pointer rounded-md bg-purple-600 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-purple-500">
          ⬆ Import .sql file
          <input
            type="file"
            accept=".sql,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) f.text().then(setSql)
            }}
          />
        </label>
        <button
          onClick={() => setSql('')}
          title="Clear"
          className="rounded-md border border-[var(--border)] px-3 py-2 text-xs text-[var(--text)] hover:text-[var(--text-strong)]"
        >
          Clear
        </button>
      </div>
      <textarea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        spellCheck={false}
        placeholder="…or paste CREATE TABLE statements here — the diagram updates as you type."
        className="flex-1 resize-none bg-[var(--bg)] p-3 font-mono text-[11px] leading-relaxed text-[var(--text)] outline-none"
      />
      {/* Full-state backup — wider than .sql import: also captures
          groups + active group + comment mode + theme as JSON. */}
      <div className="flex items-center gap-2 border-t border-[var(--border-soft)] p-3">
        <span className="text-[10px] uppercase tracking-wide text-[var(--text-soft)]">
          Backup
        </span>
        <ExportBackupButton className="flex-1" />
        <ImportBackupButton className="flex-1" />
      </div>
    </div>
  )
}

/**
 * Groups panel — name a subset of tables and toggle a focused view.
 * Reads `groups` + `activeGroup` from the store; the actual canvas
 * filtering happens in Canvas.tsx via `visibleSet` (see
 * .ai/plans/table-groups/PLAN.md). All UI state (which group is
 * expanded, which is in "add tables" mode, the picker checked set) is
 * local — store stays pure.
 */
export function GroupsPanel({ className = '' }: { className?: string }) {
  const groups = useStore((s) => s.groups)
  const activeGroup = useStore((s) => s.activeGroup)
  const tables = useStore((s) => s.schema.tables)
  const derivedGroups = useStore(
    (s) => s.schema.groupAnnotations ?? {},
  )
  const createGroup = useStore((s) => s.createGroup)
  const deleteGroup = useStore((s) => s.deleteGroup)
  const renameGroup = useStore((s) => s.renameGroup)
  const addToGroup = useStore((s) => s.addToGroup)
  const removeFromGroup = useStore((s) => s.removeFromGroup)
  const setActiveGroup = useStore((s) => s.setActiveGroup)
  const cleanGroup = useStore((s) => s.cleanGroup)

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  // expanded = the single group whose member list is showing. Single-
  // open accordion to keep the panel compact in small sidebars.
  const [expanded, setExpanded] = useState<string | null>(null)
  // adding = the group currently showing the "+ Add tables…" picker.
  const [adding, setAdding] = useState<string | null>(null)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set())

  const groupEntries = Object.entries(groups)
  const knownTables = useMemo(
    () => new Set(tables.map((t) => t.name)),
    [tables],
  )

  function submitNew() {
    const n = newName.trim()
    if (!n) return
    createGroup(n)
    setNewName('')
    setCreating(false)
    setExpanded(n)
  }

  function openAdder(name: string) {
    setAdding(name)
    setPickerSearch('')
    setPickerSelected(new Set())
  }

  function applyAdder() {
    if (!adding) return
    addToGroup(adding, [...pickerSelected])
    setAdding(null)
    setPickerSelected(new Set())
  }

  function renamePrompt(name: string) {
    // prompt() keeps the implementation small; a custom modal can come later.
    const next = window.prompt(`Rename group "${name}" to:`, name)
    if (next === null) return
    const trimmed = next.trim()
    if (!trimmed || trimmed === name) return
    renameGroup(name, trimmed)
    if (expanded === name) setExpanded(trimmed)
    if (adding === name) setAdding(trimmed)
  }

  function confirmDelete(name: string) {
    if (!window.confirm(`Delete group "${name}"? Tables stay; only the group is removed.`))
      return
    deleteGroup(name)
    if (expanded === name) setExpanded(null)
    if (adding === name) setAdding(null)
  }

  return (
    <div className={`border-b border-[var(--border-soft)] ${className}`}>
      <div className="flex items-center justify-between px-4 py-2 text-[11px] uppercase tracking-wide text-[var(--text-soft)]">
        <span>Groups ({groupEntries.length})</span>
        <button
          type="button"
          onClick={() => {
            setCreating((c) => !c)
            setNewName('')
          }}
          className="rounded px-1.5 py-0.5 text-[var(--text-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          title="New group"
        >
          + New
        </button>
      </div>

      {creating && (
        <div className="flex gap-1 px-4 pb-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew()
              else if (e.key === 'Escape') {
                setCreating(false)
                setNewName('')
              }
            }}
            placeholder="e.g. billing"
            maxLength={60}
            className="flex-1 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-purple-500"
          />
          <button
            type="button"
            onClick={submitNew}
            disabled={!newName.trim()}
            className="rounded bg-purple-600 px-2 py-1 text-xs font-medium text-white hover:bg-purple-500 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}

      {groupEntries.length === 0 && !creating && (
        <p className="px-4 pb-3 text-[11px] text-[var(--text-soft)]">
          No groups yet. Create one to focus on a subset of tables.
        </p>
      )}

      {groupEntries.map(([name, members]) => {
        const total = members.length
        const visible = members.filter((m) => knownTables.has(m)).length
        const stale = total - visible
        const isActive = activeGroup === name
        const isExpanded = expanded === name
        return (
          <div key={name} className="border-t border-[var(--border-soft)]">
            <div
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs ${
                isActive
                  ? 'bg-purple-500/15 text-[var(--text-strong)]'
                  : 'text-[var(--text)]'
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveGroup(isActive ? null : name)}
                className="text-[13px] leading-none"
                title={isActive ? 'Clear filter (show all)' : 'View only this group'}
              >
                {isActive ? '👁' : '◯'}
              </button>
              <button
                type="button"
                onClick={() =>
                  setExpanded((cur) => (cur === name ? null : name))
                }
                className="flex-1 truncate text-left font-medium"
                title="Expand / collapse members"
              >
                <span className="mr-1 text-[var(--text-soft)]">
                  {isExpanded ? '▾' : '▸'}
                </span>
                {name}
                <span className="ml-1.5 text-[10px] text-[var(--text-soft)]">
                  {stale > 0 ? `${visible}/${total}` : total}
                </span>
              </button>
              <button
                type="button"
                onClick={() => renamePrompt(name)}
                className="rounded px-1 text-[var(--text-soft)] hover:text-[var(--text)]"
                title="Rename"
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(name)}
                className="rounded px-1 text-[var(--text-soft)] hover:text-rose-400"
                title="Delete group"
              >
                🗑
              </button>
            </div>

            {isExpanded && (
              <div className="pb-2">
                {stale > 0 && (
                  <div className="mx-4 mb-1 flex items-center gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                    <span>
                      {stale} member{stale === 1 ? '' : 's'} not in current
                      schema
                    </span>
                    <button
                      type="button"
                      onClick={() => cleanGroup(name)}
                      className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium text-amber-100 hover:bg-amber-500/20"
                      title="Remove members that no longer match a table in the SQL"
                    >
                      🧹 Clean up
                    </button>
                  </div>
                )}
                {members.length === 0 && (
                  <p className="px-6 py-1 text-[11px] text-[var(--text-soft)]">
                    No members. Use "+ Add tables…" below.
                  </p>
                )}
                {members.map((m) => {
                  const exists = knownTables.has(m)
                  return (
                    <div
                      key={m}
                      className="flex items-center gap-1 px-6 py-1 text-xs"
                    >
                      <span
                        className={`flex-1 truncate ${exists ? '' : 'italic text-[var(--text-soft)] line-through'}`}
                        title={exists ? '' : 'Not in the current schema'}
                      >
                        {m}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFromGroup(name, m)}
                        className="rounded px-1 text-[var(--text-soft)] hover:text-rose-400"
                        title="Remove from group"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}

                {adding === name ? (
                  <div className="mx-4 mt-1 rounded border border-[var(--border)] bg-[var(--surface-2)] p-2">
                    <input
                      autoFocus
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      placeholder="Filter tables…"
                      className="mb-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-xs text-[var(--text)] outline-none focus:border-purple-500"
                    />
                    <div className="max-h-40 overflow-y-auto">
                      {tables
                        .filter(
                          (t) =>
                            !members.includes(t.name) &&
                            (!pickerSearch ||
                              t.name
                                .toLowerCase()
                                .includes(pickerSearch.toLowerCase())),
                        )
                        .map((t) => {
                          const checked = pickerSelected.has(t.name)
                          return (
                            <label
                              key={t.name}
                              className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-[var(--surface)]"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setPickerSelected((cur) => {
                                    const next = new Set(cur)
                                    if (e.target.checked) next.add(t.name)
                                    else next.delete(t.name)
                                    return next
                                  })
                                }}
                              />
                              <span className="truncate">{t.name}</span>
                            </label>
                          )
                        })}
                    </div>
                    <div className="mt-1 flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setAdding(null)}
                        className="rounded px-2 py-0.5 text-[11px] text-[var(--text-soft)] hover:text-[var(--text)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={applyAdder}
                        disabled={pickerSelected.size === 0}
                        className="rounded bg-purple-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-purple-500 disabled:opacity-40"
                      >
                        Add {pickerSelected.size || ''}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openAdder(name)}
                    className="ml-4 mt-1 rounded px-2 py-0.5 text-[11px] text-[var(--text-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                  >
                    + Add tables…
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Derived groups from `-- @group:` SQL annotations. Read-only:
          membership comes from SQL, not the UI. Only affordance is the
          👁 toggle to use them as a filter. Edit them by editing SQL. */}
      {Object.entries(derivedGroups).length > 0 && (
        <div className="border-t border-[var(--border-soft)] pt-1">
          <div className="px-4 py-1 text-[10px] uppercase tracking-wide text-[var(--text-soft)]">
            From SQL annotations
          </div>
          {Object.entries(derivedGroups).map(([name, members]) => {
            const total = members.length
            const visible = members.filter((m) => knownTables.has(m)).length
            // A user-managed group with the same name shadows the derived
            // one in look-up; flag that in the row title so it isn't
            // confusing.
            const shadowed = name in groups
            const isActive = activeGroup === name
            return (
              <div
                key={`derived-${name}`}
                className={`flex items-center gap-1.5 px-4 py-1 text-xs ${
                  isActive
                    ? 'bg-purple-500/15 text-[var(--text-strong)]'
                    : 'text-[var(--text)]'
                }`}
                title={
                  shadowed
                    ? `A user-managed group "${name}" shadows this SQL annotation. The user group wins.`
                    : 'Derived from `-- @group:` SQL annotation. Edit the SQL to change membership.'
                }
              >
                <button
                  type="button"
                  onClick={() => setActiveGroup(isActive ? null : name)}
                  className="text-[13px] leading-none"
                  title={isActive ? 'Clear filter' : 'View only this group'}
                  disabled={shadowed}
                >
                  {isActive ? '👁' : '◯'}
                </button>
                <span className="flex-1 truncate font-medium">
                  <span className="mr-1 text-[var(--text-soft)]">📌</span>
                  {name}
                  <span className="ml-1.5 text-[10px] text-[var(--text-soft)]">
                    {visible !== total ? `${visible}/${total}` : total}
                  </span>
                </span>
                <span
                  className="text-[10px] text-[var(--text-soft)]"
                  title="Derived from SQL — read-only"
                >
                  SQL
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** « button that hides the sidebar (store.sidebarOpen). */
/**
 * Notes panel — shows the markdown body of `/​* @doc *​/` annotations
 * for the currently-focused table (or a manual pick via dropdown).
 * Read-only: edit by changing the SQL. Lists table-level description
 * first, then per-column descriptions in declaration order.
 */
export function NotesPanel({ className = '' }: { className?: string }) {
  const tables = useStore((s) => s.schema.tables)
  const focus = useStore((s) => s.focus)
  const focusTable = useStore((s) => s.focusTable)
  const openDocDrawer = useStore((s) => s.openDocDrawer)
  // Two modes: a single-table reader (default; auto-tracks the
  // focused table) and a global index of every column with an @doc
  // annotation across the whole schema (useful when you want to
  // scan / search field notes without jumping between tables).
  const [mode, setMode] = useState<'table' | 'all-fields'>('table')
  const [filter, setFilter] = useState('')
  const [manualPick, setManualPick] = useState<string | null>(null)
  const activeName = manualPick ?? focus?.table ?? tables[0]?.name ?? ''
  const t = tables.find((x) => x.name === activeName)

  if (manualPick && !tables.some((x) => x.name === manualPick)) {
    queueMicrotask(() => setManualPick(null))
  }

  // Flatten every column with a description across the schema for the
  // "all field notes" view. Cheap; descriptions are sparse in practice.
  const allFieldNotes = useMemo(() => {
    const out: Array<{ table: string; column: string; type: string; body: string }> = []
    for (const tab of tables) {
      for (const c of tab.columns) {
        if (c.description) {
          out.push({ table: tab.name, column: c.name, type: c.type, body: c.description })
        }
      }
    }
    return out
  }, [tables])

  const q = filter.trim().toLowerCase()
  const filteredFieldNotes = useMemo(
    () =>
      !q
        ? allFieldNotes
        : allFieldNotes.filter(
            (n) =>
              n.table.toLowerCase().includes(q) ||
              n.column.toLowerCase().includes(q) ||
              n.body.toLowerCase().includes(q),
          ),
    [allFieldNotes, q],
  )

  const docColumns = useMemo(
    () => (t ? t.columns.filter((c) => c.description) : []),
    [t],
  )
  const hasAnyDoc = !!t?.description || docColumns.length > 0

  return (
    <div className={`flex flex-col overflow-hidden ${className}`}>
      {/* Mode toggle: per-table view vs all-fields index. */}
      <div className="flex gap-1 border-b border-[var(--border-soft)] px-4 py-2 text-[11px]">
        <button
          type="button"
          onClick={() => setMode('table')}
          className={`flex-1 rounded px-2 py-1 ${
            mode === 'table'
              ? 'bg-purple-500/15 text-purple-200'
              : 'text-[var(--text-soft)] hover:text-[var(--text)]'
          }`}
        >
          By table
        </button>
        <button
          type="button"
          onClick={() => setMode('all-fields')}
          className={`flex-1 rounded px-2 py-1 ${
            mode === 'all-fields'
              ? 'bg-purple-500/15 text-purple-200'
              : 'text-[var(--text-soft)] hover:text-[var(--text)]'
          }`}
          title="Every column-level @doc across the schema"
        >
          📝 All field notes ({allFieldNotes.length})
        </button>
      </div>

      {mode === 'table' ? (
        <>
          <div className="border-b border-[var(--border-soft)] px-4 py-2">
            <select
              value={activeName}
              onChange={(e) => {
                setManualPick(e.target.value)
                focusTable(e.target.value)
              }}
              className="w-full rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-purple-500"
            >
              {tables.map((tab) => (
                <option key={tab.name} value={tab.name}>
                  {tab.name}
                  {tab.description || tab.columns.some((c) => c.description) ? ' 📖' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 text-xs">
            {!t && <p className="text-[var(--text-soft)]">No table selected.</p>}
            {t && !hasAnyDoc && (
              <p className="text-[var(--text-soft)]">
                No <code>/* @doc */</code> annotations on <strong>{t.name}</strong>
                . Add a <code>/* @doc … */</code> block above the CREATE TABLE
                (table-level) or above a column line (column-level) to write
                markdown here.
              </p>
            )}
            {t?.description && (
              <section className="mb-4">
                <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-[var(--text-soft)]">
                  <span>Table — {t.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      openDocDrawer({ kind: 'table', table: t.name, body: t.description! })
                    }
                    title="Open in drawer"
                    className="rounded px-1.5 py-0.5 normal-case hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                  >
                    ⤢
                  </button>
                </div>
                <div className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
                  {renderMarkdown(t.description)}
                </div>
              </section>
            )}
            {docColumns.length > 0 && (
              <section>
                <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--text-soft)]">
                  Columns
                </div>
                <div className="space-y-2">
                  {docColumns.map((c) => (
                    <div
                      key={c.name}
                      className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <div className="font-semibold text-[var(--text-strong)]">
                          {c.name}
                          <span className="ml-1 text-[10px] uppercase text-[var(--text-soft)]">
                            {c.type}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            openDocDrawer({
                              kind: 'column',
                              table: t!.name,
                              column: c.name,
                              body: c.description!,
                            })
                          }
                          title="Open in drawer"
                          className="rounded px-1.5 py-0.5 text-[10px] text-[var(--text-soft)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
                        >
                          ⤢
                        </button>
                      </div>
                      {renderMarkdown(c.description!)}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="border-b border-[var(--border-soft)] px-4 py-2">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter field notes…"
              className="w-full rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 text-xs">
            {filteredFieldNotes.length === 0 && (
              <p className="text-[var(--text-soft)]">
                {allFieldNotes.length === 0
                  ? 'No column-level /* @doc */ annotations in this schema yet.'
                  : 'No matches.'}
              </p>
            )}
            <div className="space-y-2">
              {filteredFieldNotes.map((n) => (
                <div
                  key={`${n.table}.${n.column}`}
                  className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2"
                >
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-[var(--text-soft)]">
                    <button
                      type="button"
                      onClick={() => focusTable(n.table, n.column)}
                      title="Center this column on the canvas"
                      className="normal-case text-purple-300 hover:text-purple-200"
                    >
                      {n.table}.{n.column}{' '}
                      <span className="text-[var(--text-soft)]">{n.type}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openDocDrawer({
                          kind: 'column',
                          table: n.table,
                          column: n.column,
                          body: n.body,
                        })
                      }
                      title="Open in drawer"
                      className="rounded px-1.5 py-0.5 normal-case hover:bg-[var(--surface)] hover:text-[var(--text)]"
                    >
                      ⤢
                    </button>
                  </div>
                  {renderMarkdown(n.body)}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function CollapseSidebarButton({
  className = '',
}: {
  className?: string
}) {
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  return (
    <button
      onClick={toggleSidebar}
      title="Hide sidebar (more canvas)"
      className={`rounded px-1.5 text-[var(--text-soft)] hover:text-[var(--text-strong)] ${className}`}
    >
      «
    </button>
  )
}
