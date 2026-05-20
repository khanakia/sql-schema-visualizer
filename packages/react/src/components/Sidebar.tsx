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
  GroupsPanel,
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
  // Tab badge counts user groups + derived `-- @group:` SQL annotations
  // (deduped by name; user group shadows derived on collision).
  const groupCount = useStore((s) => {
    const userNames = new Set(Object.keys(s.groups))
    for (const n of Object.keys(s.schema.groupAnnotations ?? {}))
      userNames.add(n)
    return userNames.size
  })
  const activeGroup = useStore((s) => s.activeGroup)
  const [tab, setTab] = useState<'tables' | 'groups' | 'sql'>('tables')

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

      {/* Three-tab strip. Groups gets a small dot indicator when a group
          is currently filtering the canvas, so it's discoverable even
          when the user is on a different tab. */}
      <div className="flex border-b border-[var(--border-soft)] text-xs">
        {(['tables', 'groups', 'sql'] as const).map((t) => {
          const label =
            t === 'tables'
              ? `Tables (${tableCount})`
              : t === 'groups'
                ? `Groups (${groupCount})`
                : '⊕ Paste / Import SQL'
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 capitalize transition-colors ${
                tab === t
                  ? 'text-purple-400 border-b-2 border-purple-500'
                  : 'text-[var(--text-soft)] hover:text-[var(--text)]'
              }`}
              title={
                t === 'groups' && activeGroup
                  ? `A group is filtering the canvas: ${activeGroup}`
                  : undefined
              }
            >
              {label}
              {t === 'groups' && activeGroup && (
                <span
                  aria-hidden
                  className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-purple-400"
                />
              )}
            </button>
          )
        })}
      </div>

      {tab === 'tables' && <TableList className="flex-1" />}
      {tab === 'groups' && <GroupsPanel className="flex-1 overflow-y-auto" />}
      {tab === 'sql' && <SqlImport />}
    </aside>
  )
}
