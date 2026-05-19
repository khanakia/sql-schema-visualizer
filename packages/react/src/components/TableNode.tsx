import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Column } from '@sqlviz/core'
import { useStore } from '../store'

export interface TableNodeData {
  label: string
  columns: Column[]
  tableComment?: string
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

export function TableNode({ data, selected }: NodeProps) {
  const d = data as TableNodeData
  const mode = useStore((s) => s.commentMode)
  const collapsed = useStore((s) => !!s.collapsed[d.label])
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
                    <span title="Foreign key" className="text-sky-400">
                      ↗
                    </span>
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
      </div>
      )}
    </div>
  )
}
