import { useState } from 'react'
import { useStore } from '../store'

export function Sidebar() {
  const {
    sql,
    schema,
    search,
    setSql,
    setSearch,
    focusTable,
    toggleSidebar,
  } = useStore()
  const [tab, setTab] = useState<'sql' | 'tables'>('tables')

  const q = search.trim().toLowerCase()
  const tables = schema.tables
    .map((t) => {
      const nameHit = t.name.toLowerCase().includes(q)
      const colHits = q
        ? t.columns.filter((c) => c.name.toLowerCase().includes(q))
        : []
      return { t, nameHit, colHits }
    })
    .filter(({ nameHit, colHits }) => !q || nameHit || colHits.length > 0)

  const jumpFirst = () => {
    const first = tables[0]
    if (!first) return
    focusTable(first.t.name, first.colHits[0]?.name)
  }

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-r border-[var(--border-soft)] bg-[var(--surface)]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-soft)]">
        <span className="text-purple-400 text-lg">⛁</span>
        <h1 className="flex-1 text-sm font-semibold text-[var(--text-strong)]">
          Schema Visualizer
        </h1>
        <button
          onClick={toggleSidebar}
          title="Hide sidebar (more canvas)"
          className="rounded px-1.5 text-[var(--text-soft)] hover:text-[var(--text-strong)]"
        >
          «
        </button>
      </div>

      <div className="px-4 py-3 border-b border-[var(--border-soft)]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && jumpFirst()}
          placeholder="Search tables & fields…  (Enter to jump)"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-strong)] outline-none placeholder:text-[var(--text-soft)] focus:border-purple-500"
        />
      </div>

      <div className="flex border-b border-[var(--border-soft)] text-xs">
        {(['tables', 'sql'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 capitalize transition-colors ${
              tab === t
                ? 'text-purple-400 border-b-2 border-purple-500'
                : 'text-[var(--text-soft)] hover:text-[var(--text)]'
            }`}
          >
            {t === 'tables'
              ? `Tables (${schema.tables.length})`
              : '⊕ Paste / Import SQL'}
          </button>
        ))}
      </div>

      {tab === 'tables' ? (
        <div className="flex-1 overflow-y-auto">
          {schema.warnings.length > 0 && (
            <div className="m-3 rounded-md border border-amber-700/40 bg-amber-950/30 p-2 text-[11px] text-amber-300">
              {schema.warnings.map((w, i) => (
                <div key={i}>⚠ {w}</div>
              ))}
            </div>
          )}
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
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="flex gap-2 border-b border-[var(--border-soft)] p-3">
            <label className="flex-1 cursor-pointer rounded-md bg-purple-600 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-purple-500">
              ⬆ Import .sql file
              <input
                type="file"
                accept=".sql,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  f.text().then(setSql)
                }}
              />
            </label>
            <button
              onClick={() => setSql('')}
              className="rounded-md border border-[var(--border)] px-3 py-2 text-xs text-[var(--text)] hover:text-[var(--text-strong)]"
              title="Clear"
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
      )}
    </aside>
  )
}
