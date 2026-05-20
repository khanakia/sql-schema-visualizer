// Help system — composable primitives for a searchable "every feature"
// modal. Two pieces, each usable independently:
//
//   <HelpButton entries={…?} />   the trigger; opens the modal on click
//   <HelpModal open onClose entries={…?} />   controlled modal
//
// Both default to `defaultHelpEntries` from '../help'. Pass `entries` to
// extend or fully replace the bundled content — that's the pluggability
// hook for library consumers. The list is grouped by `section` and
// filtered by `matchHelpEntry` (substring across title + body + keywords).

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  defaultHelpEntries,
  matchHelpEntry,
  type HelpEntry,
} from '../help'

export interface HelpModalProps {
  open: boolean
  onClose: () => void
  /** Override the bundled entries. Defaults to `defaultHelpEntries`. */
  entries?: HelpEntry[]
  /** Modal title shown above the search input. */
  title?: string
  /** Search input placeholder. */
  placeholder?: string
}

/** A focused, scrollable, click-outside-to-close help modal. Sectioned
 *  list with a sticky search box; "?" or "/" key focuses the search. */
export function HelpModal({
  open,
  onClose,
  entries = defaultHelpEntries,
  title = 'Help — every feature',
  placeholder = 'Search features… (try "multi", "fk", "filter")',
}: HelpModalProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the search input on open + clear stale query when reopened.
  useEffect(() => {
    if (open) {
      setQuery('')
      // Small delay so the autofocus survives the modal mount.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Escape closes; "/" focuses search when modal already open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Group filtered entries by section in their declared order.
  const sections = useMemo(() => {
    const matched = entries.filter((e) => matchHelpEntry(e, query))
    const bySection = new Map<string, HelpEntry[]>()
    for (const e of matched) {
      const arr = bySection.get(e.section) ?? []
      arr.push(e)
      bySection.set(e.section, arr)
    }
    return Array.from(bySection.entries())
  }, [entries, query])

  if (!open) return null

  return (
    <div
      // Backdrop: click outside the card closes the modal.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ position: 'fixed', inset: 0, zIndex: 100 }}
      className="flex items-start justify-center bg-black/40 p-6 backdrop-blur-sm"
    >
      <div className="mt-[8vh] flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-purple-400">?</span>
            <h2 className="text-sm font-semibold text-[var(--text-strong)]">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--text-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            title="Close (Esc)"
            aria-label="Close help"
          >
            ×
          </button>
        </div>

        <div className="border-b border-[var(--border-soft)] px-4 py-2">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
          {sections.length === 0 && (
            <p className="py-4 text-center text-[var(--text-soft)]">
              No matches for "{query}".
            </p>
          )}
          {sections.map(([section, items]) => (
            <section key={section} className="mb-4 last:mb-0">
              <h3 className="mb-2 text-[10px] uppercase tracking-wide text-[var(--text-soft)]">
                {section}
              </h3>
              <ul className="space-y-2">
                {items.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <strong className="text-[var(--text-strong)]">
                        {e.title}
                      </strong>
                      {e.shortcut && (
                        <code className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] text-purple-300">
                          {e.shortcut}
                        </code>
                      )}
                    </div>
                    <p className="mt-1 text-[var(--text)]">{e.body}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="border-t border-[var(--border-soft)] px-4 py-2 text-[11px] text-[var(--text-soft)]">
          <kbd className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5">Esc</kbd> close ·
          <kbd className="ml-2 rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5">/</kbd> focus search
        </div>
      </div>
    </div>
  )
}

export interface HelpButtonProps {
  /** Override the bundled entries (passed through to HelpModal). */
  entries?: HelpEntry[]
  /** Override the modal title. */
  modalTitle?: string
  /** Optional className extra-classes on the trigger button. */
  className?: string
}

/** Toolbar trigger that toggles a `<HelpModal />`. Self-contained — no
 *  external state needed. For full control, mount `<HelpModal />`
 *  yourself and skip this button. */
export function HelpButton({
  entries,
  modalTitle,
  className = '',
}: HelpButtonProps = {}) {
  const [open, setOpen] = useState(false)

  // Global "?" keyboard shortcut opens help (when no input is focused).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?' || open) return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable)
      )
        return
      e.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Help — every feature (?)"
        aria-label="Open help"
        className={`flex h-7 w-7 items-center justify-center rounded-md text-xs text-[var(--text)] transition-colors hover:bg-[var(--hover)] ${className}`}
      >
        ?
      </button>
      <HelpModal
        open={open}
        onClose={() => setOpen(false)}
        entries={entries}
        title={modalTitle}
      />
    </>
  )
}
