// Pluggable persistence. Defaults to browser localStorage; falls back to
// in-memory (SSR / privacy mode). Consumers can supply their own adapter
// (e.g. cookies, IndexedDB, a backend) via setStorageAdapter() or the
// <SchemaProvider storage={...}> prop.

export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const mem = new Map<string, string>()
const memoryAdapter: StorageAdapter = {
  getItem: (k) => (mem.has(k) ? (mem.get(k) as string) : null),
  setItem: (k, v) => void mem.set(k, v),
}

function browserAdapter(): StorageAdapter | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const ls = window.localStorage
      const probe = '__sqlviz_probe__'
      ls.setItem(probe, '1')
      ls.removeItem(probe)
      return {
        getItem: (k) => ls.getItem(k),
        setItem: (k, v) => {
          try {
            ls.setItem(k, v)
          } catch {
            /* quota / disabled — ignore */
          }
        },
      }
    }
  } catch {
    /* localStorage blocked */
  }
  return null
}

let current: StorageAdapter = browserAdapter() ?? memoryAdapter

/** Replace the persistence backend. Call before first render, or pass it to
 * <SchemaProvider storage> which also re-hydrates the store. */
export function setStorageAdapter(adapter: StorageAdapter): void {
  current = adapter
}

export const storage: StorageAdapter = {
  getItem: (k) => current.getItem(k),
  setItem: (k, v) => current.setItem(k, v),
}
