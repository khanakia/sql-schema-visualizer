// Backup primitives — thin React wrappers around buildBackup +
// applyBackup. Two buttons; each one composable:
//
//   <ExportBackupButton /> — click to download a JSON snapshot of
//   everything (SQL, groups, active group, comment mode, theme).
//
//   <ImportBackupButton /> — file picker; on a valid backup file,
//   applies it to the store (SQL first, then groups, then prefs).
//
// Library consumers wanting a custom UI (POST to backend, save to
// IndexedDB, paste-from-clipboard, etc.) should reach for the pure
// helpers in '../backup' directly instead of these buttons.

import { useRef } from 'react'
import { useStore } from '../store'
import {
  applyBackup,
  buildBackup,
  downloadBackup,
  validateBackup,
} from '../backup'

export interface ExportBackupButtonProps {
  /** Override the download filename (defaults to a dated default). */
  filename?: string
  /** Optional label saved INTO the payload (not the filename). */
  label?: string
  className?: string
  children?: React.ReactNode
}

/** Click → downloads `sql-schema-visualizer-backup-YYYY-MM-DD.json`
 *  containing the full current state. */
export function ExportBackupButton({
  filename,
  label,
  className = '',
  children = '⤓ Export backup',
}: ExportBackupButtonProps = {}) {
  const sql = useStore((s) => s.sql)
  const groups = useStore((s) => s.groups)
  const activeGroup = useStore((s) => s.activeGroup)
  const commentMode = useStore((s) => s.commentMode)
  const theme = useStore((s) => s.theme)
  return (
    <button
      type="button"
      onClick={() =>
        downloadBackup(
          buildBackup({ sql, groups, activeGroup, commentMode, theme }, label),
          filename,
        )
      }
      title="Download a JSON snapshot of everything (SQL, groups, preferences)"
      className={`rounded-md border border-[var(--border)] px-3 py-2 text-xs text-[var(--text)] hover:text-[var(--text-strong)] ${className}`}
    >
      {children}
    </button>
  )
}

export interface ImportBackupButtonProps {
  /** Whether to confirm before overwriting current state (default true). */
  confirmOnImport?: boolean
  /** Called with the error message string when the file is rejected. */
  onError?: (message: string) => void
  className?: string
  children?: React.ReactNode
}

/** File-picker button. On a valid backup, applies it via the store
 *  actions. Confirms first (toggleable). Rejects malformed / wrong-
 *  version files with an alert. */
export function ImportBackupButton({
  confirmOnImport = true,
  onError,
  className = '',
  children = '⤴ Import backup',
}: ImportBackupButtonProps = {}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const setSql = useStore((s) => s.setSql)
  const createGroup = useStore((s) => s.createGroup)
  const deleteGroup = useStore((s) => s.deleteGroup)
  const addToGroup = useStore((s) => s.addToGroup)
  const setActiveGroup = useStore((s) => s.setActiveGroup)
  const toggleComments = useStore((s) => s.toggleComments)
  const toggleTheme = useStore((s) => s.toggleTheme)
  // We snapshot prefs at call time (not at render) so applyBackup
  // sees the most recent values.
  return (
    <>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        title="Replace current state with a backup JSON file"
        className={`rounded-md border border-[var(--border)] px-3 py-2 text-xs text-[var(--text)] hover:text-[var(--text-strong)] ${className}`}
      >
        {children}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          // Reset so picking the same file twice still fires onChange.
          e.target.value = ''
          if (!file) return
          let raw: unknown
          try {
            raw = JSON.parse(await file.text())
          } catch {
            const msg = `Couldn't parse "${file.name}" as JSON.`
            if (onError) onError(msg)
            else window.alert(msg)
            return
          }
          const result = validateBackup(raw)
          if (!result.ok) {
            if (onError) onError(result.error)
            else window.alert(`Invalid backup: ${result.error}`)
            return
          }
          if (
            confirmOnImport &&
            !window.confirm(
              `Replace your current schema, groups, and preferences with the contents of "${file.name}"?`,
            )
          ) {
            return
          }
          const cur = useStore.getState()
          applyBackup(
            result.payload,
            {
              setSql,
              createGroup,
              deleteGroup,
              addToGroup,
              setActiveGroup,
              toggleComments,
              toggleTheme,
            },
            cur.theme,
            cur.commentMode,
            Object.keys(cur.groups),
          )
        }}
      />
    </>
  )
}
