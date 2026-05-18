import { create } from 'zustand'
import { parseSchema, type Schema } from './lib/parser'
import { samples } from './lib/samples'

const LS_KEY = 'dbviz.sql'

interface State {
  sql: string
  schema: Schema
  search: string
  direction: 'LR' | 'TB'
  focus: { table: string; column?: string; nonce: number } | null
  commentMode: 'off' | 'inline' | 'hover'
  toggleComments: () => void
  setSql: (sql: string) => void
  loadSample: (id: string) => void
  setSearch: (q: string) => void
  setDirection: (d: 'LR' | 'TB') => void
  focusTable: (table: string, column?: string) => void
}

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
