import { useEffect, useRef, useState } from 'react'
import { useStore, buildShareUrl, SHARE_URL_SOFT_LIMIT } from '../store'
import { samples } from '../lib/samples'

interface Props {
  onFit: () => void
  onExport: () => void
}

const btn =
  'flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-[var(--text)] transition-colors hover:bg-[var(--hover)]'

export function Toolbar({ onFit, onExport }: Props) {
  const direction = useStore((s) => s.direction)
  const setDirection = useStore((s) => s.setDirection)
  const commentMode = useStore((s) => s.commentMode)
  const toggleComments = useStore((s) => s.toggleComments)
  const collapsed = useStore((s) => s.collapsed)
  const collapseAll = useStore((s) => s.collapseAll)
  const expandAll = useStore((s) => s.expandAll)
  const loadSample = useStore((s) => s.loadSample)
  const resetLayout = useStore((s) => s.resetLayout)
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const sql = useStore((s) => s.sql)
  const tables = useStore((s) => s.schema.tables)

  const [shared, setShared] = useState<'ok' | 'big' | null>(null)
  const onShare = async () => {
    const url = await buildShareUrl(sql)
    const tooBig = url.length > SHARE_URL_SOFT_LIMIT
    if (
      tooBig &&
      !window.confirm(
        `This link is ~${Math.round(url.length / 1000)} KB. It works in a ` +
          `browser but may get truncated by chat apps or link previews. ` +
          `Copy anyway?`,
      )
    )
      return
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('Copy this shareable URL:', url)
    }
    setShared(tooBig ? 'big' : 'ok')
    setTimeout(() => setShared(null), 2200)
  }

  const allCollapsed =
    tables.length > 0 && tables.every((t) => collapsed[t.name])

  const [menu, setMenu] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setMenu(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const Divider = () => <div className="mx-0.5 h-5 w-px bg-[var(--border)]" />

  return (
    <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xl backdrop-blur">
      <div className="relative" ref={ref}>
        <button
          className={btn}
          onClick={() => setMenu((m) => !m)}
          title="Load a sample schema"
        >
          ⊞ Samples ▾
        </button>
        {menu && (
          <div className="absolute left-0 top-9 w-44 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-3)] py-1 shadow-xl">
            {samples.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  loadSample(s.id)
                  setMenu(false)
                }}
                className="block w-full px-3 py-1.5 text-left text-xs text-[var(--text)] hover:bg-[var(--hover)]"
              >
                {s.name}
                <span className="ml-1 text-[10px] text-[var(--text-soft)]">
                  {s.dialect}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Divider />

      <button
        className={btn}
        onClick={() => setDirection(direction === 'LR' ? 'TB' : 'LR')}
        title="Layout direction"
      >
        {direction === 'LR' ? '⇄' : '⇅'} Layout
      </button>
      <button
        className={btn}
        onClick={() =>
          allCollapsed
            ? expandAll()
            : collapseAll(tables.map((t) => t.name))
        }
        title="Collapse / expand all tables"
      >
        {allCollapsed ? '⊞ Expand' : '⊟ Collapse'}
      </button>
      <button
        className={`${btn} ${commentMode !== 'off' ? 'text-purple-300' : ''}`}
        onClick={toggleComments}
        title="SQL comments: off → inline → hover"
      >
        💬 {commentMode === 'off' ? 'Off' : commentMode === 'inline' ? 'Inline' : 'Hover'}
      </button>

      <Divider />

      <button
        className={btn}
        onClick={resetLayout}
        title="Reset positions to auto-layout (undo manual drags)"
      >
        ↺ Reset
      </button>
      <button className={btn} onClick={onFit} title="Fit to view">
        ⤢ Fit
      </button>
      <button className={btn} onClick={onExport} title="Export PNG">
        ⤓ PNG
      </button>
      <button
        className={`${btn} ${shared ? 'text-purple-300' : ''}`}
        onClick={onShare}
        title="Copy a shareable link with this schema embedded (compressed)"
      >
        {shared === 'ok'
          ? '✓ Copied'
          : shared === 'big'
            ? '✓ Copied (large)'
            : '🔗 Share'}
      </button>

      <Divider />

      <button
        className={btn}
        onClick={toggleTheme}
        title="Toggle light / dark theme"
      >
        {theme === 'dark' ? '☀ Light' : '🌙 Dark'}
      </button>
    </div>
  )
}
