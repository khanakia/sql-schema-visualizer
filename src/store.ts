import { create } from 'zustand'
import { parseSchema, type Schema } from './lib/parser'
import { samples } from './lib/samples'
import { encodeSql, decodeSql } from './lib/share'

const LS_KEY = 'dbviz.sql'
const SHARE_PARAM = 's'

/**
 * Decode a schema embedded in the URL (?s=<lz-compressed>), if present,
 * then strip the param so later edits persist to localStorage and a reload
 * doesn't silently revert to the shared snapshot.
 */
function sqlFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const sql = decodeSql(params.get(SHARE_PARAM))
  if (params.has(SHARE_PARAM)) {
    params.delete(SHARE_PARAM)
    const qs = params.toString()
    window.history.replaceState(
      null,
      '',
      window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash,
    )
  }
  return sql
}

// Beyond this many chars a URL gets unreliable across browsers / chat apps /
// link unfurlers, so Share warns the user.
export const SHARE_URL_SOFT_LIMIT = 12000

/** Build a shareable absolute URL with the SQL compressed into ?s=. */
export function buildShareUrl(sql: string): string {
  const u = new URL(window.location.href)
  u.search = `?${SHARE_PARAM}=${encodeSql(sql)}`
  return u.toString()
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
  focusTable: (table: string, column?: string) => void
}

// A shared ?s= URL wins over localStorage so links open the shared schema.
const initialSql =
  sqlFromUrl() ?? localStorage.getItem(LS_KEY) ?? samples[0].sql

export const useStore = create<State>((set) => ({
  sql: initialSql,
  schema: parseSchema(initialSql),
  search: '',
  direction: 'LR',
  focus: null,
  commentMode: ((): 'off' | 'inline' | 'hover' => {
    const v = localStorage.getItem('dbviz.comments')
    if (v === 'off' || v === '0') return 'off'
    if (v === 'hover') return 'hover'
    return 'inline'
  })(),
  toggleComments: () =>
    set((s) => {
      const next =
        s.commentMode === 'off'
          ? 'inline'
          : s.commentMode === 'inline'
            ? 'hover'
            : 'off'
      localStorage.setItem('dbviz.comments', next)
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
  resetLayout: () =>
    set((s) => ({ relayoutNonce: s.relayoutNonce + 1 })),
  theme: ((): 'dark' | 'light' => {
    const t = localStorage.getItem('dbviz.theme') === 'light' ? 'light' : 'dark'
    document.documentElement.dataset.theme = t
    return t
  })(),
  toggleTheme: () =>
    set((s) => {
      const t = s.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('dbviz.theme', t)
      document.documentElement.dataset.theme = t
      return { theme: t }
    }),
  setSql: (sql) => {
    localStorage.setItem(LS_KEY, sql)
    set({ sql, schema: parseSchema(sql) })
  },
  loadSample: (id) => {
    const s = samples.find((x) => x.id === id)
    if (!s) return
    localStorage.setItem(LS_KEY, s.sql)
    set({ sql: s.sql, schema: parseSchema(s.sql) })
  },
  setSearch: (search) => set({ search }),
  setDirection: (direction) => set({ direction }),
  focusTable: (table, column) =>
    set((s) => ({
      focus: { table, column, nonce: (s.focus?.nonce ?? 0) + 1 },
    })),
}))
