import { create } from 'zustand'
import { parseSchema, type Schema } from './lib/parser'
import { samples } from './lib/samples'
import { encodeSql, decodeSql } from './lib/share'
import { pendingShareToken } from './lib/shareBoot'

const LS_KEY = 'dbviz.sql'

// Browsers handle huge fragments fine, but a link this long gets mangled
// when pasted into chat apps / link unfurlers, so Share warns past this.
export const SHARE_URL_SOFT_LIMIT = 16000

/** Build a shareable absolute URL with the SQL compressed into the fragment. */
export async function buildShareUrl(sql: string): Promise<string> {
  const token = await encodeSql(sql)
  const { origin, pathname } = window.location
  return `${origin}${pathname}#s=${token}`
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
  localStorage.getItem(LS_KEY) ?? samples[0].sql

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

// Hydrate from a shared link (decode is async; the captured token was
// already stripped from the URL synchronously above).
if (pendingShareToken) {
  decodeSql(pendingShareToken).then((sql) => {
    if (sql) useStore.getState().setSql(sql)
  })
}
