// Atomic, store-driven toolbar primitives. Compose your own toolbar from
// these (or use the bundled <SchemaToolbar>). Every button is headless of
// layout — drop them anywhere; they read/write the shared store.

import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { useStore, buildShareUrl, SHARE_URL_SOFT_LIMIT } from '../store'
import { samples } from '@khanakia/sql-schema-core'

const BTN =
  'flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-[var(--text)] transition-colors hover:bg-[var(--hover)]'

export interface ToolbarButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  children: ReactNode
}

/** Base styled button — build any custom control on top of this. */
export function ToolbarButton({
  active,
  className = '',
  children,
  ...rest
}: ToolbarButtonProps) {
  return (
    <button
      {...rest}
      className={`${BTN} ${active ? 'text-purple-300' : ''} ${className}`}
    >
      {children}
    </button>
  )
}

export function ToolbarDivider() {
  return <div className="mx-0.5 h-5 w-px bg-[var(--border)]" />
}

export function SamplesMenu() {
  const loadSample = useStore((s) => s.loadSample)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <ToolbarButton
        onClick={() => setOpen((m) => !m)}
        title="Load a sample schema"
      >
        ⊞ Samples ▾
      </ToolbarButton>
      {open && (
        <div className="absolute left-0 top-9 w-44 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-3)] py-1 shadow-xl">
          {samples.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                loadSample(s.id)
                setOpen(false)
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
  )
}

export function LayoutDirectionButton() {
  const direction = useStore((s) => s.direction)
  const setDirection = useStore((s) => s.setDirection)
  return (
    <ToolbarButton
      title="Layout direction"
      onClick={() => setDirection(direction === 'LR' ? 'TB' : 'LR')}
    >
      {direction === 'LR' ? '⇄' : '⇅'} Layout
    </ToolbarButton>
  )
}

export function CollapseAllButton() {
  const collapsed = useStore((s) => s.collapsed)
  const collapseAll = useStore((s) => s.collapseAll)
  const expandAll = useStore((s) => s.expandAll)
  const tables = useStore((s) => s.schema.tables)
  const all = tables.length > 0 && tables.every((t) => collapsed[t.name])
  return (
    <ToolbarButton
      title="Collapse / expand all tables"
      onClick={() =>
        all ? expandAll() : collapseAll(tables.map((t) => t.name))
      }
    >
      {all ? '⊞ Expand' : '⊟ Collapse'}
    </ToolbarButton>
  )
}

export function CommentModeButton() {
  const commentMode = useStore((s) => s.commentMode)
  const toggleComments = useStore((s) => s.toggleComments)
  return (
    <ToolbarButton
      active={commentMode !== 'off'}
      title="SQL comments: off → inline → hover"
      onClick={toggleComments}
    >
      💬{' '}
      {commentMode === 'off'
        ? 'Off'
        : commentMode === 'inline'
          ? 'Inline'
          : 'Hover'}
    </ToolbarButton>
  )
}

export function ResetLayoutButton() {
  const resetLayout = useStore((s) => s.resetLayout)
  return (
    <ToolbarButton
      title="Reset positions to auto-layout (undo manual drags)"
      onClick={resetLayout}
    >
      ↺ Reset
    </ToolbarButton>
  )
}

export function ThemeButton() {
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  return (
    <ToolbarButton title="Toggle light / dark theme" onClick={toggleTheme}>
      {theme === 'dark' ? '☀ Light' : '🌙 Dark'}
    </ToolbarButton>
  )
}

export function ShareButton() {
  const sql = useStore((s) => s.sql)
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
  return (
    <ToolbarButton
      active={!!shared}
      title="Copy a shareable link with this schema embedded (compressed)"
      onClick={onShare}
    >
      {shared === 'ok'
        ? '✓ Copied'
        : shared === 'big'
          ? '✓ Copied (large)'
          : '🔗 Share'}
    </ToolbarButton>
  )
}

/** Generic — wire to your canvas fit handler. */
export function FitButton({ onClick }: { onClick: () => void }) {
  return (
    <ToolbarButton title="Fit to view" onClick={onClick}>
      ⤢ Fit
    </ToolbarButton>
  )
}

/** Generic — wire to your PNG export handler. */
export function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <ToolbarButton title="Export PNG" onClick={onClick}>
      ⤓ PNG
    </ToolbarButton>
  )
}
