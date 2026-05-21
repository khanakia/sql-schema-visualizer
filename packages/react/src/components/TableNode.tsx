import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Column } from '@khanakia/sql-schema-core'
import { useStore } from '../store'
import { renderMarkdown } from '../markdown'

export interface TableNodeData {
  label: string
  columns: Column[]
  tableComment?: string
  /** Long markdown body from a `/​* @doc ... *​/` block above the table. */
  tableDescription?: string
  /** Multi-column UNIQUE constraints, rendered as a footer per group. */
  compositeUniques?: string[][]
  dim: boolean
  matched: boolean
  queryCol?: string
  focusCol?: string | null
  [key: string]: unknown
}

const ROW = 'h-7 flex items-center gap-2 px-3 text-[12px] leading-none'

function Popover({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute left-full top-0 z-50 ml-2 hidden w-56 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[11px] italic leading-snug text-[var(--text)] shadow-xl group-hover:block whitespace-normal break-words">
      {text}
    </div>
  )
}

/** Inline 📖 / 📝 badge that opens a wider markdown popover on hover.
 *
 *  The popover is rendered via a portal to `document.body` so it
 *  escapes any clipping from React Flow's transformed/scaled node
 *  containers AND any stacking-context oddities — neither of which we
 *  control from inside a custom node. Position is computed from the
 *  badge's bounding rect each hover. */
function DocBadge({
  emoji,
  body,
  title,
  className = '',
  onActivate,
}: {
  emoji: ReactNode
  body: string
  title: string
  className?: string
  /** Called when the badge is clicked — typically opens the Notes
   *  sidebar tab and focuses the relevant table. */
  onActivate?: () => void
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const open = () => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    // Anchor the popover just below + right of the badge so it never
    // overlaps the badge itself (which would re-fire mouseleave and
    // flicker). Clamp to viewport so very-right tables still show it.
    const w = 320
    const x = Math.min(r.right + 8, window.innerWidth - w - 8)
    const y = Math.min(r.bottom + 4, window.innerHeight - 40)
    setPos({ x, y })
  }
  const close = () => setPos(null)
  return (
    <>
      <span
        ref={anchorRef}
        className={`relative inline-flex ${onActivate ? 'cursor-pointer' : 'cursor-help'} text-[11px] text-purple-300 hover:text-purple-200 ${className}`}
        onMouseEnter={open}
        onMouseLeave={close}
        onClick={(e) => {
          e.stopPropagation()
          onActivate?.()
          // Close the hover popover after activating so the sidebar
          // becomes the primary reading surface.
          close()
        }}
        // React Flow steals mousedown for node drags — stopPropagation
        // here keeps clicks crisp on the badge.
        onMouseDown={(e) => e.stopPropagation()}
        title={title}
      >
        {emoji}
      </span>
      {pos &&
        createPortal(
          <div
            // Portal-rendered so React Flow can't clip it. Match
            // hover lifecycle by also closing when the popover itself
            // is left (so users can mouse into it to read / click).
            onMouseEnter={() => setPos(pos)}
            onMouseLeave={close}
            style={{
              position: 'fixed',
              left: pos.x,
              top: pos.y,
              zIndex: 9999,
              width: 320,
              maxHeight: '60vh',
            }}
            className="overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text)] shadow-2xl"
          >
            {renderMarkdown(body)}
          </div>,
          document.body,
        )}
    </>
  )
}

export function TableNode({ data, selected }: NodeProps) {
  const d = data as TableNodeData
  const mode = useStore((s) => s.commentMode)
  const collapsed = useStore((s) => !!s.collapsed[d.label])
  // Map a column name to the composite-unique tuples it participates
  // in. Used to label the per-row `U` glyph with its partners.
  const compositeByCol = (() => {
    const map = new Map<string, string[][]>()
    for (const tuple of d.compositeUniques ?? []) {
      for (const col of tuple) {
        const arr = map.get(col) ?? []
        arr.push(tuple)
        map.set(col, arr)
      }
    }
    return map
  })()
  const toggleCollapse = useStore((s) => s.toggleCollapse)
  const inline = mode === 'inline' && !collapsed
  const hover = mode === 'hover'

  return (
    <div
      className={`rounded-lg border bg-[var(--surface)] shadow-xl transition-opacity ${
        d.dim ? 'opacity-25' : 'opacity-100'
      } ${
        selected || d.matched
          ? 'border-purple-500 ring-2 ring-purple-500/40'
          : 'border-[var(--border)]'
      }`}
      style={{ width: 260 }}
    >
      <div
        className={`group relative flex items-center justify-between rounded-t-lg bg-[var(--surface-2)] px-3 py-2 ${
          collapsed ? 'rounded-b-lg' : 'border-b border-[var(--border)]'
        }`}
      >
        <span className="flex items-center gap-1.5 font-semibold text-[13px] text-[var(--text-strong)] truncate">
          <button
            className="nodrag shrink-0 text-[var(--text-soft)] hover:text-[var(--text-strong)]"
            title={collapsed ? 'Expand fields' : 'Collapse fields'}
            onClick={(e) => {
              e.stopPropagation()
              toggleCollapse(d.label)
            }}
          >
            {collapsed ? '▸' : '▾'}
          </button>
          <span className="truncate">{d.label}</span>
          {hover && d.tableComment && (
            <span className="text-[9px] text-purple-400">●</span>
          )}
          {d.tableDescription && (
            <DocBadge
              emoji="📖"
              body={d.tableDescription}
              title="Hover for preview · click to open"
              onActivate={() =>
                useStore.getState().openDocDrawer({
                  kind: 'table',
                  table: d.label,
                  body: d.tableDescription!,
                })
              }
            />
          )}
        </span>
        <span className="text-[10px] text-[var(--text-soft)] tabular-nums">
          {d.columns.length}
        </span>
        {hover && d.tableComment && <Popover text={d.tableComment} />}
      </div>

      {collapsed && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-0">
          {d.columns.map((c) => (
            <span key={c.name}>
              <Handle
                type="target"
                position={Position.Left}
                id={c.name}
                style={{ left: -1, top: 0 }}
              />
              <Handle
                type="source"
                position={Position.Right}
                id={c.name}
                style={{ right: -1, top: 0 }}
              />
            </span>
          ))}
        </div>
      )}

      {inline && d.tableComment && (
        <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[10px] italic leading-snug text-[var(--text-soft)] whitespace-normal break-words">
          {d.tableComment}
        </div>
      )}

      {!collapsed && (
      <div className="py-1">
        {d.columns.map((c) => {
          const qc = (d.queryCol ?? '').toLowerCase()
          const isQ = qc.length > 0 && c.name.toLowerCase().includes(qc)
          const isFocus = d.focusCol === c.name
          return (
            <div
              key={c.name}
              className="border-b border-[var(--border-soft)] last:border-0"
            >
              <div
                className={`group ${ROW} relative ${
                  isFocus
                    ? 'bg-purple-500/25'
                    : isQ
                      ? 'bg-purple-500/10'
                      : ''
                }`}
              >
                <Handle
                  type="target"
                  position={Position.Left}
                  id={c.name}
                  style={{ left: -1, top: '50%' }}
                />
                <Handle
                  type="source"
                  position={Position.Right}
                  id={c.name}
                  style={{ right: -1, top: '50%' }}
                />
                <span className="w-3 shrink-0 text-center">
                  {c.pk ? (
                    <span title="Primary key" className="text-amber-400">
                      ◆
                    </span>
                  ) : c.fk ? (
                    // Foreign-key navigator: clicking the ↗ glyph jumps
                    // to the referenced table+column. Pushes the current
                    // focus onto history so Backspace / Back returns.
                    // stopPropagation + onMouseDown stop React Flow from
                    // selecting/dragging the node when the glyph is
                    // clicked.
                    <button
                      type="button"
                      title={`Follow FK to ${c.fk.table}.${c.fk.column} (⌥/Alt + ← to go back)`}
                      className="cursor-pointer text-sky-400 hover:text-sky-200"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        useStore
                          .getState()
                          .focusTable(c.fk!.table, c.fk!.column)
                      }}
                    >
                      ↗
                    </button>
                  ) : null}
                </span>
                <span
                  className={`flex-1 truncate ${
                    c.pk ? 'font-semibold text-[var(--text-strong)]' : 'text-[var(--text)]'
                  }`}
                >
                  {c.name}
                  {!c.nullable && (
                    <span className="text-rose-400/70" title="NOT NULL">
                      {' '}
                      *
                    </span>
                  )}
                  {c.description && (
                    <DocBadge
                      emoji="📝"
                      body={c.description}
                      title="Hover for preview · click to open"
                      className="ml-1 text-[10px]"
                      onActivate={() =>
                        useStore.getState().openDocDrawer({
                          kind: 'column',
                          table: d.label,
                          column: c.name,
                          body: c.description!,
                        })
                      }
                    />
                  )}
                  {/* UNIQUE glyph — skipped on PK rows since PKs are
                      implicitly unique. Tooltip lists the partner
                      columns when this column is part of a composite. */}
                  {c.unique && !c.pk && (
                    <span
                      className="ml-1 inline-block rounded border border-emerald-500/40 px-1 text-[9px] uppercase tracking-wide text-emerald-300"
                      title={(() => {
                        const tuples = compositeByCol.get(c.name)
                        if (!tuples || tuples.length === 0) return 'UNIQUE'
                        return tuples
                          .map((t) => `UNIQUE (${t.join(', ')})`)
                          .join('\n')
                      })()}
                    >
                      U
                    </span>
                  )}
                </span>
                {hover && c.comment && (
                  <span className="shrink-0 text-[9px] text-purple-400">
                    ●
                  </span>
                )}
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--text-soft)] truncate max-w-[80px]">
                  {c.type}
                </span>
                {hover && c.comment && <Popover text={c.comment} />}
              </div>
              {inline && c.comment && (
                <div className="px-3 pb-1 pl-8 text-[10px] italic leading-snug text-[var(--text-soft)] whitespace-normal break-words">
                  {c.comment}
                </div>
              )}
            </div>
          )
        })}
        {/* Composite (multi-column) UNIQUE constraints. Shows "these
            columns are unique together" — the per-row `U` glyph can't
            convey grouping on its own. One line per constraint;
            truncated when long, but a hover popover shows the full
            tuple (reuses the same Popover the column comments use). */}
        {d.compositeUniques && d.compositeUniques.length > 0 && (
          <div className="border-t border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-1">
            {d.compositeUniques.map((tuple, i) => {
              const full = `UNIQUE (${tuple.join(', ')})`
              return (
                <div
                  key={`uq-${i}`}
                  className="group relative flex items-center text-[10px] text-emerald-300/90"
                  title={full}
                >
                  <span className="mr-1 shrink-0 text-emerald-400/70">U</span>
                  <span className="truncate">({tuple.join(', ')})</span>
                  <Popover text={full} />
                </div>
              )
            })}
          </div>
        )}
      </div>
      )}
    </div>
  )
}
