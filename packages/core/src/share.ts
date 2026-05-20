// URL-safe SQL <-> share-token codec.
//
// Uses the native CompressionStream('deflate-raw') — zero dependencies, and
// ~2.9x on SQL (vs ~2x for lz-string), close to brotli without shipping a
// WASM blob. The token is base64url so it is safe in a URL *fragment*
// (fragments are never sent to the server, so no "414 URI Too Long").

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function pipe(data: Uint8Array, stream: GenericTransformStream) {
  const blob = new Blob([data as BlobPart])
  const buf = await new Response(
    blob.stream().pipeThrough(stream),
  ).arrayBuffer()
  return new Uint8Array(buf)
}

export async function encodeSql(sql: string): Promise<string> {
  const data = new TextEncoder().encode(sql)
  const out = await pipe(data, new CompressionStream('deflate-raw'))
  return bytesToB64Url(out)
}

export async function decodeSql(
  token: string | null | undefined,
): Promise<string | null> {
  if (!token) return null
  try {
    const bytes = b64UrlToBytes(token)
    const out = await pipe(bytes, new DecompressionStream('deflate-raw'))
    const sql = new TextDecoder().decode(out)
    return sql.trim() ? sql : null
  } catch {
    return null
  }
}

// ── Groups share codec ──────────────────────────────────────────────
// Independent of the SQL token: lives at `#g=<...>` alongside `#s=...`.
// Two-param design (additive) so any pre-groups viewer keeps decoding
// `#s=` exactly as today and just ignores `#g=`. Internally a compact
// JSON blob `{g: {name: [tables]}, a: activeGroup|null}` then
// deflate-raw + base64url, same pipeline as the SQL token.

/** Persistent groups payload as it travels in a share URL. */
export interface SharedGroups {
  groups: Record<string, string[]>
  activeGroup: string | null
}

/** Returns null when payload is "empty default" (no groups + no active) so
 *  callers can omit the `&g=` query param entirely. */
export async function encodeGroups(
  payload: SharedGroups,
): Promise<string | null> {
  const groupNames = Object.keys(payload.groups ?? {})
  if (groupNames.length === 0 && (payload.activeGroup ?? null) === null) {
    return null
  }
  // Short keys to keep the URL tight on big group sets.
  const compact = {
    g: payload.groups,
    a: payload.activeGroup ?? null,
  }
  const data = new TextEncoder().encode(JSON.stringify(compact))
  const out = await pipe(data, new CompressionStream('deflate-raw'))
  return bytesToB64Url(out)
}

/** Decode a `#g=` token. Tolerant: returns empty defaults on any
 *  malformed input — never throws, never returns null. Names are
 *  validated (non-empty strings; table list is string[]). */
export async function decodeGroups(
  token: string | null | undefined,
): Promise<SharedGroups> {
  const empty: SharedGroups = { groups: {}, activeGroup: null }
  if (!token) return empty
  try {
    const bytes = b64UrlToBytes(token)
    const out = await pipe(bytes, new DecompressionStream('deflate-raw'))
    const json = new TextDecoder().decode(out)
    const raw = JSON.parse(json) as { g?: unknown; a?: unknown }
    const groups: Record<string, string[]> = {}
    if (raw && typeof raw.g === 'object' && raw.g) {
      for (const [name, tables] of Object.entries(raw.g as Record<string, unknown>)) {
        if (!name || typeof name !== 'string' || !Array.isArray(tables)) continue
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
      typeof raw?.a === 'string' && raw.a in groups ? raw.a : null
    return { groups, activeGroup }
  } catch {
    return empty
  }
}
