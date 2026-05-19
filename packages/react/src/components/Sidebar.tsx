// The bundled sidebar = the primitives in `sidebar-parts.tsx` arranged in
// a panel with a tables/SQL tab switch. Want a different layout/subset?
// Compose SchemaSearch / TableList / SqlImport / … yourself instead.
import { useState } from 'react'
import { useStore } from '../store'
import {
  SchemaSearch,
  TableList,
  SqlImport,
  CollapseSidebarButton,
} from './sidebar-parts'

export interface SchemaSidebarProps {
  /** override the panel width (default 340px) */
  width?: number | string
  className?: string
  /** show the title + collapse header (default true) */
  showHeader?: boolean
}

export function Sidebar({
  width = 340,
  className = '',
  showHeader = true,
}: SchemaSidebarProps = {}) {
  const tableCount = useStore((s) => s.schema.tables.length)
  const [tab, setTab] = useState<'tables' | 'sql'>('tables')

  return (
    <aside
      style={{ width }}
      className={`flex h-full shrink-0 flex-col border-r border-[var(--border-soft)] bg-[var(--surface)] ${className}`}
    >
      {showHeader && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-soft)]">
          <span className="text-purple-400 text-lg">⛁</span>
          <h1 className="flex-1 text-sm font-semibold text-[var(--text-strong)]">
            Schema Visualizer
          </h1>
          <CollapseSidebarButton />
        </div>
      )}

      <div className="px-4 py-3 border-b border-[var(--border-soft)]">
        <SchemaSearch />
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
              ? `Tables (${tableCount})`
              : '⊕ Paste / Import SQL'}
          </button>
        ))}
      </div>

      {tab === 'tables' ? (
        <TableList className="flex-1" />
      ) : (
        <SqlImport />
      )}
    </aside>
  )
}
