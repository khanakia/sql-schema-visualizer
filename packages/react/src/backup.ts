// Full-state backup payload — JSON-serialisable snapshot of everything
// the user has configured: SQL, groups, active group, comment mode,
// theme. Pure data + a few small helpers; the React components in
// components/Backup.tsx are thin wrappers around this.
//
// Pluggability hooks: library consumers can build their own backup UI
// (e.g. POST to a backend, save to IndexedDB) by calling buildBackup()
// + applyBackup() directly. Version field is bumped only on
// shape-breaking changes; older versions remain readable.

import type { useStore } from './store'

export const BACKUP_VERSION = 1
/** Used as the magic at the top of the file for quick sanity-check. */
export const BACKUP_KIND = 'sql-schema-visualizer-backup' as const

export interface BackupPayload {
  kind: typeof BACKUP_KIND
  /** Bump only on shape-breaking changes. Decoder rejects unknown majors. */
  version: number
  /** ISO timestamp the backup was produced at. Informational. */
  exportedAt: string
  /** Optional human label the user / app added (e.g. "before refactor"). */
  label?: string
  sql: string
  groups: Record<string, string[]>
  activeGroup: string | null
  commentMode: 'off' | 'inline' | 'hover'
  theme: 'dark' | 'light'
}

/** Slice of the store shape we need for building a backup. Avoids
 *  depending on the full State type so this stays test-friendly. */
type BackupSourceState = Pick<
  ReturnType<typeof useStore.getState>,
  'sql' | 'groups' | 'activeGroup' | 'commentMode' | 'theme'
>

/** Subset of the actions applyBackup needs to mutate the store. */
export interface BackupApplyActions {
  setSql: (sql: string) => void
  // Reset + restore groups by re-creating from scratch. Simpler than
  // diffing, and applying a backup is by definition a "replace" op.
  createGroup: (name: string) => void
  deleteGroup: (name: string) => void
  addToGroup: (name: string, tables: string[]) => void
  setActiveGroup: (name: string | null) => void
  // Comment mode + theme are toggles, not setters — applyBackup cycles
  // through them to match the target value. Implemented in the helper.
  toggleComments: () => void
  toggleTheme: () => void
}

/** Build a fresh backup payload from a state snapshot. */
export function buildBackup(
  state: BackupSourceState,
  label?: string,
): BackupPayload {
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    label,
    sql: state.sql,
    groups: state.groups,
    activeGroup: state.activeGroup,
    commentMode: state.commentMode,
    theme: state.theme,
  }
}

/** Validate + normalize a parsed JSON payload. Returns the payload on
 *  success, or { error } describing what's wrong. Tolerant of missing
 *  optional fields — only `kind`, `version`, and `sql` are required. */
export function validateBackup(
  raw: unknown,
):
  | { ok: true; payload: BackupPayload }
  | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Not a JSON object.' }
  }
  const r = raw as Record<string, unknown>
  if (r.kind !== BACKUP_KIND) {
    return { ok: false, error: `Not a ${BACKUP_KIND} file.` }
  }
  if (typeof r.version !== 'number' || r.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `Unsupported backup version: ${String(r.version)}. This app reads up to v${BACKUP_VERSION}.`,
    }
  }
  if (typeof r.sql !== 'string') {
    return { ok: false, error: 'Missing `sql` field.' }
  }
  // Sanitize groups: filter to {name: string[]} with non-empty strings.
  const groups: Record<string, string[]> = {}
  if (r.groups && typeof r.groups === 'object') {
    for (const [name, members] of Object.entries(r.groups as Record<string, unknown>)) {
      if (!name || typeof name !== 'string' || !Array.isArray(members)) continue
      const seen = new Set<string>()
      const clean: string[] = []
      for (const m of members) {
        if (typeof m !== 'string' || !m || seen.has(m)) continue
        seen.add(m)
        clean.push(m)
      }
      groups[name] = clean
    }
  }
  const activeGroup =
    typeof r.activeGroup === 'string' && r.activeGroup in groups
      ? r.activeGroup
      : null
  const commentMode: BackupPayload['commentMode'] =
    r.commentMode === 'off' || r.commentMode === 'hover'
      ? r.commentMode
      : 'inline'
  const theme: BackupPayload['theme'] = r.theme === 'light' ? 'light' : 'dark'
  return {
    ok: true,
    payload: {
      kind: BACKUP_KIND,
      version: r.version,
      exportedAt: typeof r.exportedAt === 'string' ? r.exportedAt : '',
      label: typeof r.label === 'string' ? r.label : undefined,
      sql: r.sql,
      groups,
      activeGroup,
      commentMode,
      theme,
    },
  }
}

/** Apply a backup payload to the store via the provided action funcs.
 *  Order matters: SQL first (so newly-loaded tables are known when
 *  groups are restored), then groups, then preferences. */
export function applyBackup(
  payload: BackupPayload,
  actions: BackupApplyActions,
  currentTheme: 'dark' | 'light',
  currentCommentMode: 'off' | 'inline' | 'hover',
  currentGroupNames: string[],
): void {
  // 1) SQL — triggers a schema reparse.
  actions.setSql(payload.sql)

  // 2) Groups — wipe current then rebuild. Wiping first guarantees the
  //    payload is authoritative (no leftover from before-import).
  for (const name of currentGroupNames) actions.deleteGroup(name)
  for (const [name, members] of Object.entries(payload.groups)) {
    actions.createGroup(name)
    if (members.length > 0) actions.addToGroup(name, members)
  }
  actions.setActiveGroup(payload.activeGroup)

  // 3) Preferences — toggle until they match. Each is a small finite
  //    cycle (theme: 2, commentMode: 3) so this is fine without setters.
  if (currentTheme !== payload.theme) actions.toggleTheme()
  // commentMode cycles off -> inline -> hover -> off. Toggle until we hit.
  let cm = currentCommentMode
  let safety = 4
  while (cm !== payload.commentMode && safety-- > 0) {
    actions.toggleComments()
    cm = cm === 'off' ? 'inline' : cm === 'inline' ? 'hover' : 'off'
  }
}

/** Browser-only helper: trigger a download of `payload` as JSON.
 *  Picks a default filename including the date if none supplied. */
export function downloadBackup(payload: BackupPayload, filename?: string): void {
  const name =
    filename ??
    `sql-schema-visualizer-backup-${new Date().toISOString().slice(0, 10)}.json`
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Release the object URL after the download triggers; small delay so
  // the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
