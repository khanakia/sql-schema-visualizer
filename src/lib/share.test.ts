import { describe, it, expect } from 'vitest'
import { encodeSql, decodeSql } from './share'
import { snippets } from './snippets'

describe('share codec', () => {
  it('round-trips non-empty SQL through encode/decode', () => {
    const meaningful = Object.values(snippets).filter((s) => s.trim())
    for (const sql of meaningful) {
      expect(decodeSql(encodeSql(sql))).toBe(sql)
    }
  })

  it('blank input encodes but decodes back to null (no schema)', () => {
    expect(decodeSql(encodeSql('   '))).toBeNull()
  })

  it('produces tokens within the lz-string URL-safe alphabet', () => {
    const token = encodeSql(snippets.mysqlBackticks)
    expect(token).toMatch(/^[A-Za-z0-9+\-$]+$/)
  })

  it('compresses large schemas well below the raw size', () => {
    const big = Array.from({ length: 60 }, (_, i) =>
      `CREATE TABLE t${i} ( id int PRIMARY KEY, ref int REFERENCES t0(id) );`,
    ).join('\n')
    const token = encodeSql(big)
    expect(token.length).toBeLessThan(big.length / 2)
    expect(decodeSql(token)).toBe(big)
  })

  it('returns null for missing or garbage tokens', () => {
    expect(decodeSql(null)).toBeNull()
    expect(decodeSql('')).toBeNull()
    expect(decodeSql('%%%not-valid%%%')).toBeNull()
  })
})
