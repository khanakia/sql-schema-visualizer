import { useState } from 'react'
import { useStore } from '../store'
import { samples } from '../lib/samples'

export function Sidebar() {
  const {
    sql,
    schema,
    search,
    direction,
    setSql,
    loadSample,
    setSearch,
    setDirection,
    focusTable,
    commentMode,
    toggleComments,
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
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-r border-[#1d1f29] bg-[#0d0e13]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1d1f29]">
        <span className="text-purple-400 text-lg">⛁</span>
        <h1 className="text-sm font-semibold text-gray-100">Schema Visualizer</h1>
      </div>

      <div className="px-4 py-3 border-b border-[#1d1f29]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && jumpFirst()}
          placeholder="Search tables & fields…  (Enter to jump)"
          className="w-full rounded-md border border-[#2a2c37] bg-[#14151b] px-3 py-2 text-sm text-gray-200 outline-none placeholder:text-gray-600 focus:border-purple-500"
        />
      </div>

      <div className="flex border-b border-[#1d1f29] text-xs">
        {(['tables', 'sql'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 capitalize transition-colors ${
              tab === t
                ? 'text-purple-400 border-b-2 border-purple-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'tables' ? `Tables (${schema.tables.length})` : 'SQL'}
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
            <p className="p-4 text-xs text-gray-600">No matches.</p>
          )}
          {tables.map(({ t, colHits }) => (
            <div key={t.name}>
              <button
                onClick={() => focusTable(t.name)}
                className="block w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-[#16171d]"
              >
                <span className="font-medium">{t.name}</span>
                <span className="ml-2 text-[11px] text-gray-600">
                  {t.columns.length} cols
                </span>
              </button>
              {colHits.map((c) => (
                <button
                  key={c.name}
                  onClick={() => focusTable(t.name, c.name)}
                  className="flex w-full items-center gap-2 px-4 py-1 pl-8 text-left text-xs text-gray-400 hover:bg-[#16171d] hover:text-purple-300"
                >
                  <span className="text-gray-600">↳</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-[10px] uppercase text-gray-600">
                    {c.type}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            spellCheck={false}
            placeholder="Paste CREATE TABLE statements…"
            className="flex-1 resize-none bg-[#0a0b0f] p-3 font-mono text-[11px] leading-relaxed text-gray-300 outline-none"
          />
          <label className="cursor-pointer border-t border-[#1d1f29] px-4 py-2 text-center text-xs text-purple-400 hover:bg-[#16171d]">
            Upload .sql file
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
        </div>
      )}

      <div className="border-t border-[#1d1f29] px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-gray-600">
            Samples
          </span>
          <div className="flex gap-2">
            <button
              onClick={toggleComments}
              className={`rounded border px-2 py-0.5 text-[11px] ${
                commentMode === 'off'
                  ? 'border-[#2a2c37] text-gray-500 hover:text-gray-300'
                  : 'border-purple-500/60 text-purple-300'
              }`}
              title="Cycle SQL comments: off → inline → hover"
            >
              {commentMode === 'off'
                ? 'Comments off'
                : commentMode === 'inline'
                  ? 'Comments inline'
                  : 'Comments hover'}
            </button>
            <button
              onClick={() => setDirection(direction === 'LR' ? 'TB' : 'LR')}
              className="rounded border border-[#2a2c37] px-2 py-0.5 text-[11px] text-gray-400 hover:text-gray-200"
              title="Toggle layout direction"
            >
              {direction === 'LR' ? 'Horizontal' : 'Vertical'}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {samples.map((s) => (
            <button
              key={s.id}
              onClick={() => loadSample(s.id)}
              className="rounded-md border border-[#2a2c37] bg-[#14151b] px-2.5 py-1 text-[11px] text-gray-300 hover:border-purple-500 hover:text-purple-300"
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
