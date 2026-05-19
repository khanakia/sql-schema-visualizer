import LZString from 'lz-string'

// URL-safe, window-free SQL <-> share-token codec. Kept separate from the
// store so it can be unit-tested without a DOM.

export const encodeSql = (sql: string): string =>
  LZString.compressToEncodedURIComponent(sql)

export function decodeSql(param: string | null | undefined): string | null {
  if (!param) return null
  try {
    const sql = LZString.decompressFromEncodedURIComponent(param)
    return sql && sql.trim() ? sql : null
  } catch {
    return null
  }
}
