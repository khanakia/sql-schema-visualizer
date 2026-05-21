import { create } from 'zustand'
import {
  parseSchema,
  encodeSql,
  encodeGroups,
  samples,
  type Schema,
} from '@khanakia/sql-schema-core'
import { storage } from './storage'

// Cap on the FK-navigation history stack. Bounded so a long browsing
// session can't grow memory unbounded; 50 is plenty for human "back" UX.
const HISTORY_MAX = 50

const K_SQL = 'dbviz.sql'
const K_COMMENTS = 'dbviz.comments'
const K_THEME = 'dbviz.theme'
const K_SIDEBAR_WIDTH = 'dbviz.sidebarWidth.v1'
const SIDEBAR_MIN = 240
const SIDEBAR_MAX = 700
const SIDEBAR_DEFAULT = 340
// Versioned key so future shape changes don't silently break older saves.
// See .ai/plans/table-groups/PLAN.md "Data model".
const K_GROUPS = 'dbviz.groups.v1'
const MAX_GROUP_NAME_LEN = 60

/** Persistent shape stored under K_GROUPS. Kept tiny to fit in localStorage
 *  alongside SQL + theme + comment-mode without crowding. */
interface GroupsState {
  groups: Record<string, string[]>   // group name -> table names (order = display order)
  activeGroup: string | null         // null = "Show all"; else only that group is visible
}

function readGroupsState(): GroupsState {
  const raw = storage.getItem(K_GROUPS)
  if (!raw) return { groups: {}, activeGroup: null }
  try {
    const parsed = JSON.parse(raw) as Partial<GroupsState>
    const groups: Record<string, string[]> = {}
    if (parsed && typeof parsed.groups === 'object' && parsed.groups) {
      for (const [name, tables] of Object.entries(parsed.groups)) {
        if (!name || typeof name !== 'string') continue
        if (!Array.isArray(tables)) continue
        // Dedup + filter to non-empty strings; preserve insertion order.
        const seen = new Set<string>()
        const clean: string[] = []
        for (const t of tables) {
          if (typeof t !== 'string' || !t || seen.has(t)) continue
          seen.add(t)
          clean.push(t)
        }
        groups[name] = clean
      }
    }
    const activeGroup =
      typeof parsed?.activeGroup === 'string' && parsed.activeGroup in groups
        ? parsed.activeGroup
        : null
    return { groups, activeGroup }
  } catch {
    return { groups: {}, activeGroup: null }
  }
}

function writeGroupsState(s: GroupsState) {
  // Skip persisting when the state is "empty default" to keep storage clean
  // for users who never touched groups.
  if (Object.keys(s.groups).length === 0 && s.activeGroup === null) {
    storage.setItem(K_GROUPS, '')
    return
  }
  storage.setItem(K_GROUPS, JSON.stringify(s))
}

// Browsers handle huge fragments fine, but a link this long gets mangled
// when pasted into chat apps / link unfurlers, so Share warns past this.
export const SHARE_URL_SOFT_LIMIT = 16000

/** Build a shareable absolute URL. SQL always goes in `#s=`; groups +
 *  active group (if any) go in `#g=` as a separate compressed param so
 *  pre-groups viewers ignore them and still load the SQL correctly. */
export async function buildShareUrl(
  sql: string,
  opts?: { groups?: Record<string, string[]>; activeGroup?: string | null },
): Promise<string> {
  const sToken = await encodeSql(sql)
  const gToken = opts
    ? await encodeGroups({
        groups: opts.groups ?? {},
        activeGroup: opts.activeGroup ?? null,
      })
    : null
  const { origin, pathname } = window.location
  const hash = gToken ? `#s=${sToken}&g=${gToken}` : `#s=${sToken}`
  return `${origin}${pathname}${hash}`
}

function readCommentMode(): 'off' | 'inline' | 'hover' {
  const v = storage.getItem(K_COMMENTS)
  if (v === 'off' || v === '0') return 'off'
  if (v === 'hover') return 'hover'
  return 'inline'
}

function readTheme(): 'dark' | 'light' {
  return storage.getItem(K_THEME) === 'light' ? 'light' : 'dark'
}

function applyThemeAttr(t: 'dark' | 'light') {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = t
}

interface State {
  sql: string
  schema: Schema
  search: string
  direction: 'LR' | 'TB'
  focus: { table: string; column?: string; nonce: number } | null
  commentMode: 'off' | 'inline' | 'hover'
  toggleComments: () => void
  sidebarOpen: boolean
  toggleSidebar: () => void
  /** Persisted sidebar width in px. User-resizable via drag handle. */
  sidebarWidth: number
  setSidebarWidth: (w: number) => void
  /** Active sidebar tab — session only. Lifted into the store so any
   *  component (e.g. the table 📖 badge inside a React Flow node) can
   *  switch tabs without prop-drilling. */
  sidebarTab: 'tables' | 'groups' | 'notes' | 'sql'
  setSidebarTab: (t: 'tables' | 'groups' | 'notes' | 'sql') => void
  /** Right-side drawer showing a single table-or-column /​* @doc *​/.
   *  Opens on click of the 📖 / 📝 badge; null = closed. Session-only. */
  docDrawer:
    | { kind: 'table'; table: string; body: string }
    | { kind: 'column'; table: string; column: string; body: string }
    | null
  openDocDrawer: (
    payload:
      | { kind: 'table'; table: string; body: string }
      | { kind: 'column'; table: string; column: string; body: string },
  ) => void
  closeDocDrawer: () => void
  collapsed: Record<string, true>
  toggleCollapse: (table: string) => void
  collapseAll: (names: string[]) => void
  expandAll: () => void
  relayoutNonce: number
  resetLayout: () => void
  theme: 'dark' | 'light'
  toggleTheme: () => void
  setSql: (sql: string) => void
  loadSample: (id: string) => void
  setSearch: (q: string) => void
  setDirection: (d: 'LR' | 'TB') => void
  /**
   * Navigation history stack. Each entry is a previous `focus` that we
   * popped off when the user navigated forward (clicked an FK, picked a
   * table from the sidebar, etc.). `back()` pops the top and restores
   * that focus. Capped at HISTORY_MAX so a long session can't grow it
   * unbounded. Does NOT include the current focus — only previous ones.
   */
  history: Array<{ table: string; column: string | null }>
  /**
   * Navigate to a table (and optionally a specific column). Pushes the
   * CURRENT focus onto `history` first so `back()` can return there.
   * Pass `push: false` to navigate without recording history (used by
   * `back()` itself to avoid history loops).
   */
  focusTable: (table: string, column?: string, opts?: { push?: boolean }) => void
  /** Pop the last history entry and focus it. No-op if history empty. */
  back: () => void

  // --- Table groups (see .ai/plans/table-groups/PLAN.md) ---
  // Pure UI state. Never touches schema/SQL; reparsing the SQL doesn't
  // change membership (only filters stale names from the visible set).
  /** Group name -> list of table names. Order = display order. */
  groups: Record<string, string[]>
  /** null = "Show all"; else only the named group's members are visible. */
  activeGroup: string | null
  /** Create a new empty group. No-op if name is empty/dup/too long. */
  createGroup: (name: string) => void
  /** Rename a group. No-op if `to` is empty/dup or `from` doesn't exist. */
  renameGroup: (from: string, to: string) => void
  /** Delete a group. Auto-clears activeGroup if it pointed here. */
  deleteGroup: (name: string) => void
  /** Add one or more tables to a group. Dedup'd, order preserved. */
  addToGroup: (name: string, tables: string[]) => void
  /** Remove a single table from a group. */
  removeFromGroup: (name: string, table: string) => void
  /** Switch the active-view group. null = show all. */
  setActiveGroup: (name: string | null) => void
  /** Prune stale members (names not in the current schema). Returns
   *  silently if no-op or group missing; mutates groups[name] in place. */
  cleanGroup: (name: string) => void

  /** Re-read persisted state from the (possibly just-swapped) adapter. */
  hydrate: () => void
}

const initialSql = storage.getItem(K_SQL) ?? samples[0].sql
const initialTheme = readTheme()
applyThemeAttr(initialTheme)
const initialGroupsState = readGroupsState()

// Shared helper: validate a group name. Returns the trimmed name on success
// or null on rejection (with a console.warn explaining why). Caller treats
// null as no-op — actions are idempotent and tolerant.
function validGroupName(name: string, existing: Record<string, string[]>, kind: 'create' | 'rename'): string | null {
  const n = (name ?? '').trim()
  if (!n) {
    console.warn(`[dbviz] ${kind} group: name is empty`)
    return null
  }
  if (n.length > MAX_GROUP_NAME_LEN) {
    console.warn(`[dbviz] ${kind} group: name exceeds ${MAX_GROUP_NAME_LEN} chars`)
    return null
  }
  if (n in existing) {
    console.warn(`[dbviz] ${kind} group: "${n}" already exists`)
    return null
  }
  return n
}

export const useStore = create<State>((set) => ({
  sql: initialSql,
  schema: parseSchema(initialSql),
  search: '',
  direction: 'LR',
  focus: null,
  commentMode: readCommentMode(),
  toggleComments: () =>
    set((s) => {
      const next =
        s.commentMode === 'off'
          ? 'inline'
          : s.commentMode === 'inline'
            ? 'hover'
            : 'off'
      storage.setItem(K_COMMENTS, next)
      return { commentMode: next }
    }),
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  sidebarWidth: (() => {
    const raw = storage.getItem(K_SIDEBAR_WIDTH)
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) && n >= SIDEBAR_MIN && n <= SIDEBAR_MAX
      ? n
      : SIDEBAR_DEFAULT
  })(),
  setSidebarWidth: (w) =>
    set(() => {
      const clamped = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, Math.round(w)))
      storage.setItem(K_SIDEBAR_WIDTH, String(clamped))
      return { sidebarWidth: clamped }
    }),
  sidebarTab: 'tables',
  setSidebarTab: (t) => set({ sidebarTab: t }),
  docDrawer: null,
  openDocDrawer: (payload) => set({ docDrawer: payload }),
  closeDocDrawer: () => set({ docDrawer: null }),
  collapsed: {},
  toggleCollapse: (table) =>
    set((s) => {
      const c = { ...s.collapsed }
      if (c[table]) delete c[table]
      else c[table] = true
      return { collapsed: c }
    }),
  collapseAll: (names) =>
    set(() => ({
      collapsed: Object.fromEntries(names.map((n) => [n, true])),
    })),
  expandAll: () => set({ collapsed: {} }),
  relayoutNonce: 0,
  resetLayout: () => set((s) => ({ relayoutNonce: s.relayoutNonce + 1 })),
  theme: initialTheme,
  toggleTheme: () =>
    set((s) => {
      const t = s.theme === 'dark' ? 'light' : 'dark'
      storage.setItem(K_THEME, t)
      applyThemeAttr(t)
      return { theme: t }
    }),
  setSql: (sql) => {
    storage.setItem(K_SQL, sql)
    set({ sql, schema: parseSchema(sql) })
  },
  loadSample: (id) => {
    const s = samples.find((x) => x.id === id)
    if (!s) return
    storage.setItem(K_SQL, s.sql)
    set({ sql: s.sql, schema: parseSchema(s.sql) })
  },
  setSearch: (search) => set({ search }),
  setDirection: (direction) => set({ direction }),
  history: [],
  focusTable: (table, column, opts) =>
    set((s) => {
      // Don't push a redundant entry if we're already focused on the
      // same (table, column) — common when the FK glyph is double-clicked
      // or the same edge re-fired.
      const sameAsCurrent =
        s.focus?.table === table && (s.focus.column ?? null) === (column ?? null)
      const push = opts?.push !== false && !sameAsCurrent && s.focus
      const nextHistory =
        push && s.focus
          ? [
              ...s.history,
              { table: s.focus.table, column: s.focus.column ?? null },
            ].slice(-HISTORY_MAX)
          : s.history
      return {
        history: nextHistory,
        focus: { table, column, nonce: (s.focus?.nonce ?? 0) + 1 },
      }
    }),
  back: () =>
    set((s) => {
      if (s.history.length === 0) return s
      const prev = s.history[s.history.length - 1]
      return {
        history: s.history.slice(0, -1),
        focus: {
          table: prev.table,
          column: prev.column ?? undefined,
          nonce: (s.focus?.nonce ?? 0) + 1,
        },
      }
    }),
  // --- Groups: initial state ---
  groups: initialGroupsState.groups,
  activeGroup: initialGroupsState.activeGroup,
  createGroup: (name) =>
    set((s) => {
      const n = validGroupName(name, s.groups, 'create')
      if (n === null) return s
      const next = { ...s.groups, [n]: [] }
      writeGroupsState({ groups: next, activeGroup: s.activeGroup })
      return { groups: next }
    }),
  renameGroup: (from, to) =>
    set((s) => {
      if (!(from in s.groups)) {
        console.warn(`[dbviz] rename group: "${from}" not found`)
        return s
      }
      const n = validGroupName(to, s.groups, 'rename')
      if (n === null || n === from) return s
      // Rebuild to preserve insertion order with `from` swapped for `n`.
      const next: Record<string, string[]> = {}
      for (const [k, v] of Object.entries(s.groups)) {
        next[k === from ? n : k] = v
      }
      const nextActive = s.activeGroup === from ? n : s.activeGroup
      writeGroupsState({ groups: next, activeGroup: nextActive })
      return { groups: next, activeGroup: nextActive }
    }),
  deleteGroup: (name) =>
    set((s) => {
      if (!(name in s.groups)) return s
      const next = { ...s.groups }
      delete next[name]
      // If the active view pointed at the deleted group, fall back to "all".
      const nextActive = s.activeGroup === name ? null : s.activeGroup
      writeGroupsState({ groups: next, activeGroup: nextActive })
      return { groups: next, activeGroup: nextActive }
    }),
  addToGroup: (name, tables) =>
    set((s) => {
      if (!(name in s.groups)) {
        console.warn(`[dbviz] addToGroup: "${name}" not found`)
        return s
      }
      const current = s.groups[name]
      const seen = new Set(current)
      const added: string[] = []
      for (const t of tables) {
        if (typeof t !== 'string' || !t || seen.has(t)) continue
        seen.add(t)
        added.push(t)
      }
      if (added.length === 0) return s
      const next = { ...s.groups, [name]: [...current, ...added] }
      writeGroupsState({ groups: next, activeGroup: s.activeGroup })
      return { groups: next }
    }),
  removeFromGroup: (name, table) =>
    set((s) => {
      if (!(name in s.groups)) return s
      const current = s.groups[name]
      if (!current.includes(table)) return s
      const filtered = current.filter((t) => t !== table)
      const next = { ...s.groups, [name]: filtered }
      writeGroupsState({ groups: next, activeGroup: s.activeGroup })
      return { groups: next }
    }),
  setActiveGroup: (name) =>
    set((s) => {
      // Allow null (clear), an existing user-managed group, OR a
      // derived group from `-- @group:` SQL annotations.
      const ok =
        name === null ||
        name in s.groups ||
        name in (s.schema.groupAnnotations ?? {})
      if (!ok) {
        console.warn(`[dbviz] setActiveGroup: "${name}" not found`)
        return s
      }
      writeGroupsState({ groups: s.groups, activeGroup: name })
      return { activeGroup: name }
    }),
  cleanGroup: (name) =>
    set((s) => {
      const current = s.groups[name]
      if (!current) return s
      const known = new Set(s.schema.tables.map((t) => t.name))
      const cleaned = current.filter((t) => known.has(t))
      if (cleaned.length === current.length) return s
      const next = { ...s.groups, [name]: cleaned }
      writeGroupsState({ groups: next, activeGroup: s.activeGroup })
      return { groups: next }
    }),

  hydrate: () =>
    set(() => {
      const th = readTheme()
      applyThemeAttr(th)
      const sql = storage.getItem(K_SQL)
      const g = readGroupsState()
      return {
        commentMode: readCommentMode(),
        theme: th,
        groups: g.groups,
        activeGroup: g.activeGroup,
        ...(sql ? { sql, schema: parseSchema(sql) } : {}),
      }
    }),
}))

/**
 * Convenience hook returning JUST the store action functions (no state).
 * Stable references — calling components don't re-render on state
 * changes the way `useSchemaStore(s => s.everything)` would. Use this
 * when you only need to mutate (e.g. a custom toolbar button that
 * toggles a group).
 *
 *   const { createGroup, addToGroup, setActiveGroup } = useSchemaActions()
 */
export function useSchemaActions() {
  return useStore((s) => ({
    // Schema input
    setSql: s.setSql,
    loadSample: s.loadSample,
    // Search + filter
    setSearch: s.setSearch,
    setDirection: s.setDirection,
    // Display preferences
    toggleComments: s.toggleComments,
    toggleSidebar: s.toggleSidebar,
    toggleTheme: s.toggleTheme,
    // Table-level UI
    toggleCollapse: s.toggleCollapse,
    collapseAll: s.collapseAll,
    expandAll: s.expandAll,
    resetLayout: s.resetLayout,
    // FK navigation
    focusTable: s.focusTable,
    back: s.back,
    // Groups
    createGroup: s.createGroup,
    renameGroup: s.renameGroup,
    deleteGroup: s.deleteGroup,
    addToGroup: s.addToGroup,
    removeFromGroup: s.removeFromGroup,
    setActiveGroup: s.setActiveGroup,
    cleanGroup: s.cleanGroup,
    // Hydration (rare — used by storage adapter swaps)
    hydrate: s.hydrate,
  }))
}
