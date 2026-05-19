import { useEffect, useRef, type ReactNode } from 'react'
import { useStore } from './store'
import { setStorageAdapter, type StorageAdapter } from './storage'

export interface SchemaProviderProps {
  /** Initial / controlled SQL DDL. When it changes the diagram re-parses. */
  sql?: string
  /** Force a theme; omit to use the persisted user choice. */
  theme?: 'dark' | 'light'
  /** Bring your own persistence (cookies, IndexedDB, backend, …). */
  storage?: StorageAdapter
  children: ReactNode
}

/**
 * Optional convenience wrapper. The store is a module singleton, so the
 * pieces (SchemaCanvas, SchemaSidebar, …) also work without this — use it
 * when you want to drive SQL / theme / storage from your app.
 */
export function SchemaProvider({
  sql,
  theme,
  storage,
  children,
}: SchemaProviderProps) {
  const setSql = useStore((s) => s.setSql)
  const curTheme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)

  // Swap the persistence backend + re-hydrate once, synchronously, before
  // children render — so no flash of localStorage state.
  const storageApplied = useRef(false)
  if (!storageApplied.current && storage) {
    storageApplied.current = true
    setStorageAdapter(storage)
    useStore.getState().hydrate()
  }

  useEffect(() => {
    if (sql != null) setSql(sql)
  }, [sql, setSql])

  useEffect(() => {
    if (theme && theme !== curTheme) toggleTheme()
  }, [theme, curTheme, toggleTheme])

  return <>{children}</>
}
