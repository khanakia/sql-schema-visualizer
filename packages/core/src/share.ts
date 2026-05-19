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
