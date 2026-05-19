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
