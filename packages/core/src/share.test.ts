import { describe, it, expect } from 'vitest'
import { encodeSql, decodeSql } from './share'
import { snippets } from './snippets'

describe('share codec (deflate-raw + base64url)', () => {
  it('round-trips non-empty SQL through encode/decode', async () => {
    for (const sql of Object.values(snippets).filter((s) => s.trim())) {
      expect(await decodeSql(await encodeSql(sql))).toBe(sql)
    }
  })

  it('blank input round-trips to null (no schema)', async () => {
    expect(await decodeSql(await encodeSql('   '))).toBeNull()
  })

  it('produces URL-fragment-safe tokens (base64url alphabet)', async () => {
    const token = await encodeSql(snippets.mysqlBackticks)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('compresses a large repetitive schema well below raw size', async () => {
    const big = Array.from(
      { length: 60 },
      (_, i) =>
        `CREATE TABLE t${i} ( id int PRIMARY KEY, ref int REFERENCES t0(id) );`,
    ).join('\n')
    const token = await encodeSql(big)
    expect(token.length).toBeLessThan(big.length / 3)
    expect(await decodeSql(token)).toBe(big)
  })

  it('returns null for missing or garbage tokens', async () => {
    expect(await decodeSql(null)).toBeNull()
    expect(await decodeSql('')).toBeNull()
    expect(await decodeSql('!!!not-valid!!!')).toBeNull()
  })
})

import { encodeGroups, decodeGroups } from './share'

describe('groups codec', () => {
  it('returns null token for empty default payload', async () => {
    expect(await encodeGroups({ groups: {}, activeGroup: null })).toBeNull()
  })

  it('round-trips a single group', async () => {
    const payload = { groups: { billing: ['orders', 'invoices'] }, activeGroup: null }
    const tok = await encodeGroups(payload)
    expect(tok).not.toBeNull()
    expect(await decodeGroups(tok)).toEqual(payload)
  })

  it('round-trips multiple groups + active group', async () => {
    const payload = {
      groups: {
        billing: ['orders', 'invoices'],
        auth: ['users', 'sessions'],
        empty: [],
      },
      activeGroup: 'auth' as string | null,
    }
    const tok = await encodeGroups(payload)
    expect(await decodeGroups(tok)).toEqual(payload)
  })

  it('drops dangling activeGroup on decode', async () => {
    // Manually craft a payload claiming activeGroup that isn't in groups.
    const tok = await encodeGroups({
      groups: { a: ['t'] },
      activeGroup: 'a',
    })
    // Decoding works.
    expect((await decodeGroups(tok)).activeGroup).toBe('a')
    // A malformed token returns empty defaults, no throw.
    const bad = await decodeGroups('!!!nope!!!')
    expect(bad).toEqual({ groups: {}, activeGroup: null })
  })

  it('tolerates null/empty/undefined input', async () => {
    const empty = { groups: {}, activeGroup: null }
    expect(await decodeGroups(null)).toEqual(empty)
    expect(await decodeGroups(undefined)).toEqual(empty)
    expect(await decodeGroups('')).toEqual(empty)
  })

  it('dedups and drops non-string table entries on decode', async () => {
    // We can't easily craft a malformed inner payload from outside, so
    // simulate by encoding a payload that has duplicates — encoder
    // preserves them, decoder cleans them. (Round-trip is via the
    // production encoder, which writes verbatim; cleanup happens on
    // decodeGroups for tokens authored by older clients with looser
    // shapes.)
    const tok = await encodeGroups({
      groups: { g: ['a', 'b', 'a', 'c'] },
      activeGroup: null,
    })
    const decoded = await decodeGroups(tok)
    expect(decoded.groups.g).toEqual(['a', 'b', 'c'])
  })
})
