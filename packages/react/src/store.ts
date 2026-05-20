import { create } from 'zustand'
import { parseSchema, encodeSql, samples, type Schema } from '@khanakia/sql-schema-core'
import { storage } from './storage'

// Cap on the FK-navigation history stack. Bounded so a long browsing
// session can't grow memory unbounded; 50 is plenty for human "back" UX.
const HISTORY_MAX = 50

const K_SQL = 'dbviz.sql'
const K_COMMENTS = 'dbviz.comments'
const K_THEME = 'dbviz.theme'

// Browsers handle huge fragments fine, but a link this long gets mangled
// when pasted into chat apps / link unfurlers, so Share warns past this.
export const SHARE_URL_SOFT_LIMIT = 16000

/** Build a shareable absolute URL with the SQL compressed into the fragment. */
export async function buildShareUrl(sql: string): Promise<string> {
  const token = await encodeSql(sql)
  const { origin, pathname } = window.location
  return `${origin}${pathname}#s=${token}`
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
  /** Re-read persisted state from the (possibly just-swapped) adapter. */
  hydrate: () => void
}

const initialSql = storage.getItem(K_SQL) ?? samples[0].sql
const initialTheme = readTheme()
applyThemeAttr(initialTheme)

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
  hydrate: () =>
    set(() => {
      const th = readTheme()
      applyThemeAttr(th)
      const sql = storage.getItem(K_SQL)
      return {
        commentMode: readCommentMode(),
        theme: th,
        ...(sql ? { sql, schema: parseSchema(sql) } : {}),
      }
    }),
}))
