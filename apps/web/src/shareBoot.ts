// Runs synchronously, imported eagerly by main.tsx BEFORE the router is
// created. With autoCodeSplitting the route (and the store) load lazily, so
// the token must be stripped here — otherwise the hash router mounts on
// "#/s=<token>", matches no route, and flashes "Not Found" until the chunk
// loads. The fragment payload is never sent to the server (no 414).

// Captures `s` (SQL) and `g` (groups + active group) tokens from the URL
// in a single pass, then rewrites history so the hash router lands on
// "#/". Two-param `#s=<...>&g=<...>` design — pre-groups viewers parsing
// only `s` keep working.
function captureShareTokens(): { s: string | null; g: string | null } {
  const h = window.location.hash.replace(/^#\/?\??/, '')
  // Parse the whole hash body as a flat key=value list (after the
  // optional leading 's=' shortcut). Supports both `#s=...` and
  // `#k=v&k=v&...` forms.
  const pairs: Record<string, string> = {}
  if (h.startsWith('s=')) {
    const amp = h.indexOf('&')
    pairs.s = amp === -1 ? h.slice(2) : h.slice(2, amp)
    if (amp !== -1) {
      for (const kv of h.slice(amp + 1).split('&')) {
        const eq = kv.indexOf('=')
        if (eq > 0) pairs[kv.slice(0, eq)] = kv.slice(eq + 1)
      }
    }
  } else {
    for (const kv of h.split('&')) {
      const eq = kv.indexOf('=')
      if (eq > 0) pairs[kv.slice(0, eq)] = kv.slice(eq + 1)
    }
  }
  // Legacy fallback: `?s=` query string.
  if (!pairs.s) {
    const q = new URLSearchParams(window.location.search).get('s')
    if (q) pairs.s = q
  }
  const decode = (v: string | undefined) => (v ? decodeURIComponent(v) : null)
  const out = { s: decode(pairs.s), g: decode(pairs.g) }
  if (out.s || out.g) {
    window.history.replaceState(null, '', window.location.pathname + '#/')
  }
  return out
}

const tokens = captureShareTokens()
export const pendingShareToken = tokens.s
export const pendingGroupsToken = tokens.g
