// The bundled sidebar = the primitives in `sidebar-parts.tsx` arranged in
// a panel with a tables/SQL tab switch. Want a different layout/subset?
// Compose SchemaSearch / TableList / SqlImport / … yourself instead.
import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import {
  SchemaSearch,
  TableList,
  SqlImport,
  CollapseSidebarButton,
  GroupsPanel,
  NotesPanel,
} from './sidebar-parts'

export interface SchemaSidebarProps {
  /** Override the panel width. If omitted the user-resizable
   *  store width (`sidebarWidth`) is used; passing this prop pins
   *  the sidebar to a fixed width and disables the drag handle. */
  width?: number | string
  className?: string
  /** show the title + collapse header (default true) */
  showHeader?: boolean
  /** Show the right-edge drag handle (default true when `width` is
   *  store-driven; ignored when `width` is provided explicitly). */
  resizable?: boolean
}

export function Sidebar({
  width,
  className = '',
  showHeader = true,
  resizable = true,
}: SchemaSidebarProps = {}) {
  const storeWidth = useStore((s) => s.sidebarWidth)
  const setSidebarWidth = useStore((s) => s.setSidebarWidth)
  // Effective width: explicit prop wins (locks it), else use store.
  const effectiveWidth = width ?? storeWidth
  const isResizable = resizable && width === undefined

  // Drag-to-resize: pointer-events on a 4px handle on the right edge.
  // We capture move + up on `window` so the drag survives the mouse
  // leaving the handle's tiny area while resizing.
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (!isResizable) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startW: storeWidth }
  }
  useEffect(() => {
    if (!isResizable) return
    const move = (e: PointerEvent) => {
      if (!dragRef.current) return
      const dx = e.clientX - dragRef.current.startX
      setSidebarWidth(dragRef.current.startW + dx)
    }
    const up = () => {
      dragRef.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [isResizable, setSidebarWidth])

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
  // Count tables that have any `/* @doc */` annotation so the Notes
  // tab can show a badge ("Notes (3)") when there's something to read.
  const notesCount = useStore((s) =>
    s.schema.tables.reduce(
      (n, t) =>
        n + (t.description || t.columns.some((c) => c.description) ? 1 : 0),
      0,
    ),
  )
  // Tab is store-driven so external triggers (e.g. clicking the 📖
  // badge on a table) can switch tabs without prop-drilling.
  const tab = useStore((s) => s.sidebarTab)
  const setTab = useStore((s) => s.setSidebarTab)

  return (
    <aside
      style={{ width: effectiveWidth }}
      className={`relative flex h-full shrink-0 flex-col border-r border-[var(--border-soft)] bg-[var(--surface)] ${className}`}
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
        {(['tables', 'groups', 'notes', 'sql'] as const).map((t) => {
          const label =
            t === 'tables'
              ? `Tables (${tableCount})`
              : t === 'groups'
                ? `Groups (${groupCount})`
                : t === 'notes'
                  ? `📖 Notes${notesCount ? ` (${notesCount})` : ''}`
                  : '⊕ SQL'
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
      {tab === 'notes' && <NotesPanel className="flex-1" />}
      {tab === 'sql' && <SqlImport />}

      {isResizable && (
        // Right-edge drag handle — 4px hit zone, becomes purple on
        // hover so it's discoverable. Lives outside the scrolling tab
        // content so it stays grabbable at any scroll position.
        <div
          onPointerDown={onPointerDown}
          title="Drag to resize"
          className="absolute inset-y-0 right-0 z-10 w-1 cursor-col-resize bg-transparent transition-colors hover:bg-purple-500/40"
        />
      )}
    </aside>
  )
}
