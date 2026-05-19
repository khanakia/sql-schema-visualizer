// Atomic, store-driven sidebar primitives. Compose your own panel from
// these (or use the bundled <SchemaSidebar>). Each reads/writes the
// shared store and is headless of outer layout.

import { useStore } from '../store'

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
        ? t.columns.find((c) => c.name.toLowerCase().includes(q))
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
      colHits: q
        ? t.columns.filter((c) => c.name.toLowerCase().includes(q))
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
    </div>
  )
}

/** « button that hides the sidebar (store.sidebarOpen). */
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
