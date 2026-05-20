// The right-click "Groups ▸" menu for a table (or multi-selection)
// on the canvas. Lists current memberships with ✓ (click toggles off)
// and other groups (click adds). "+ New group" prompts a name and adds
// the target(s) in one shot.
//
// Bulk semantics: when `tableIds.length > 1` (a multi-selection right-
// click), per-group action shows "Add N (M already in)" or "Remove all
// (N)". This is the chosen heuristic — single button per group, no
// confusing two-mode UI.
//
// Composable: this component is purely controlled by `x` / `y` /
// `tableIds` / `onClose`. The dismiss-on-outside-click + Esc behavior
// belongs to whoever mounts it (so consumers can wire it into custom
// menus or non-context-menu triggers). The bundled <Canvas /> wires
// those for you; consumers building their own canvas should mirror the
// pattern (see Canvas.tsx, "click-outside / Escape dismisses" effect).
// The `data-groups-ctxmenu` attribute marks the element so that effect
// knows clicks INSIDE the menu shouldn't close it.

import { useStore } from '../store'

export interface GroupsContextMenuProps {
  /** Viewport x coord (clientX) to position the menu at. */
  x: number
  /** Viewport y coord (clientY) to position the menu at. */
  y: number
  /** One or more tables the menu acts on. >1 = bulk action. */
  tableIds: string[]
  /** Called after any action completes (or via Esc / outside click). */
  onClose: () => void
}

export function GroupsContextMenu({
  x,
  y,
  tableIds,
  onClose,
}: GroupsContextMenuProps) {
  const groups = useStore((s) => s.groups)
  const addToGroup = useStore((s) => s.addToGroup)
  const removeFromGroup = useStore((s) => s.removeFromGroup)
  const createGroup = useStore((s) => s.createGroup)
  const entries = Object.entries(groups)
  const isMulti = tableIds.length > 1
  const targetLabel = isMulti
    ? `${tableIds.length} tables selected`
    : tableIds[0]
  return (
    <div
      data-groups-ctxmenu
      style={{
        position: 'fixed',
        left: Math.min(x, window.innerWidth - 240),
        top: Math.min(y, window.innerHeight - 220),
        zIndex: 50,
      }}
      className="min-w-[220px] rounded-md border border-[var(--border)] bg-[var(--surface)] py-1 text-xs shadow-xl"
    >
      <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-[var(--text-soft)]">
        Groups — {targetLabel}
      </div>
      {entries.length === 0 && (
        <div className="px-3 py-1 text-[11px] text-[var(--text-soft)]">
          No groups yet.
        </div>
      )}
      {entries.map(([name, members]) => {
        const memberSet = new Set(members)
        const inCount = tableIds.filter((t) => memberSet.has(t)).length
        const allIn = inCount === tableIds.length
        return (
          <button
            key={name}
            type="button"
            onClick={() => {
              if (allIn) {
                for (const t of tableIds) removeFromGroup(name, t)
              } else {
                addToGroup(
                  name,
                  tableIds.filter((t) => !memberSet.has(t)),
                )
              }
              onClose()
            }}
            className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-[var(--surface-2)]"
          >
            <span className="w-3 text-purple-400">{allIn ? '✓' : ''}</span>
            <span className="flex-1 truncate text-[var(--text)]">{name}</span>
            <span className="text-[10px] text-[var(--text-soft)]">
              {allIn
                ? isMulti
                  ? `Remove all (${inCount})`
                  : 'Remove'
                : isMulti
                  ? `Add ${tableIds.length - inCount}${
                      inCount > 0 ? ` (${inCount} already in)` : ''
                    }`
                  : 'Add'}
            </span>
          </button>
        )
      })}
      <div className="my-1 h-px bg-[var(--border-soft)]" />
      <button
        type="button"
        onClick={() => {
          const placeholder = isMulti ? '' : tableIds[0]
          const n = window.prompt(
            isMulti
              ? `New group containing ${tableIds.length} tables:`
              : `New group from "${tableIds[0]}":`,
            placeholder,
          )
          if (n === null) return
          const trimmed = n.trim()
          if (!trimmed) return
          createGroup(trimmed)
          addToGroup(trimmed, tableIds)
          onClose()
        }}
        className="flex w-full items-center gap-2 px-3 py-1 text-left text-[var(--text)] hover:bg-[var(--surface-2)]"
      >
        <span className="w-3 text-[var(--text-soft)]">+</span>
        <span>
          {isMulti
            ? `New group from ${tableIds.length} tables…`
            : 'New group from this table…'}
        </span>
      </button>
    </div>
  )
}
