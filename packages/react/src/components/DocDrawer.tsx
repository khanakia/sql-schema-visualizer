// Slide-in right-side drawer that shows a single table-or-column
// /​* @doc *​/ markdown body. Triggered by clicking a 📖 (table) or
// 📝 (column) badge — the badge writes `docDrawer` on the store, this
// component subscribes and renders. Esc + click-outside close.
//
// Why a drawer (not the sidebar Notes tab): the click was a "deep
// read" intent and deserves more real estate + focus. The sidebar
// Notes tab is still the browsing surface; the drawer is the per-item
// reader.

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store'
import { renderMarkdown } from '../markdown'

export function DocDrawer() {
  const drawer = useStore((s) => s.docDrawer)
  const close = useStore((s) => s.closeDocDrawer)
  const panelRef = useRef<HTMLDivElement>(null)

  // Esc to close + click-outside the panel to close. The click-outside
  // listener attaches ONE TICK LATER than the drawer mounts — otherwise
  // the same click that opened us (the badge mousedown bubbling
  // through) immediately closes us. Without the deferral the drawer
  // appears to "not work".
  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null
      if (t && panelRef.current && !panelRef.current.contains(t)) close()
    }
    window.addEventListener('keydown', onKey)
    // Defer attaching the mousedown listener until after the current
    // event-loop tick so the opening click isn't seen here.
    let armed = false
    const armId = setTimeout(() => {
      armed = true
      window.addEventListener('mousedown', onDown, true)
    }, 0)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(armId)
      if (armed) window.removeEventListener('mousedown', onDown, true)
    }
  }, [drawer, close])

  if (!drawer) return null

  const title =
    drawer.kind === 'table'
      ? drawer.table
      : `${drawer.table}.${drawer.column}`
  const subtitle = drawer.kind === 'table' ? 'Table description' : 'Column description'

  return createPortal(
    <div
      // Fixed full-height, anchored to the right. No backdrop — keeps
      // the canvas visible so the user retains context. Click-outside
      // is still wired via the effect above.
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, zIndex: 100 }}
      className="flex flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl"
      ref={panelRef}
      // Stop pointer events from leaking to the canvas (otherwise
      // clicking inside the drawer would also deselect nodes etc).
      onMouseDown={(e) => e.stopPropagation()}
    >
      <header className="flex items-start justify-between gap-3 border-b border-[var(--border-soft)] px-5 py-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-soft)]">
            {subtitle}
          </div>
          <h2 className="truncate text-sm font-semibold text-[var(--text-strong)]">
            {drawer.kind === 'table' ? '📖' : '📝'} {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close drawer (Esc)"
          title="Close (Esc)"
          className="rounded p-1 text-[var(--text-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
        >
          ×
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-4 text-[12px] leading-relaxed text-[var(--text)]">
        {renderMarkdown(drawer.body)}
      </div>
      <footer className="border-t border-[var(--border-soft)] px-5 py-2 text-[10px] text-[var(--text-soft)]">
        Edit by changing the <code>/* @doc … */</code> block in the SQL.
      </footer>
    </div>,
    document.body,
  )
}
