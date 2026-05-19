// Runs synchronously, imported eagerly by main.tsx BEFORE the router is
// created. With autoCodeSplitting the route (and the store) load lazily, so
// the token must be stripped here — otherwise the hash router mounts on
// "#/s=<token>", matches no route, and flashes "Not Found" until the chunk
// loads. The fragment payload is never sent to the server (no 414).

function captureShareToken(): string | null {
  // hash may be "#s=..", "#/s=..", "#/?s=.."; also accept legacy "?s=" query
  const h = window.location.hash.replace(/^#\/?\??/, '')
  let token: string | null = null
  if (h.startsWith('s=')) token = h.slice(2)
  else {
    const m = h.match(/[?&]s=([^&]+)/)
    if (m) token = m[1]
  }
  if (!token) token = new URLSearchParams(window.location.search).get('s')
  if (token) {
    token = decodeURIComponent(token)
    window.history.replaceState(null, '', window.location.pathname + '#/')
  }
  return token
}

export const pendingShareToken = captureShareToken()
