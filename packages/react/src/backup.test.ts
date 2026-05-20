// Backup codec tests — pure helpers, no React.

import { describe, expect, it } from 'vitest'
import {
  BACKUP_KIND,
  BACKUP_VERSION,
  buildBackup,
  validateBackup,
  applyBackup,
} from './backup'

const sampleState = {
  sql: 'CREATE TABLE a (id INT PRIMARY KEY);',
  groups: { core: ['a'], misc: [] },
  activeGroup: 'core' as string | null,
  commentMode: 'inline' as const,
  theme: 'dark' as const,
}

describe('buildBackup', () => {
  it('captures every field + adds kind/version/exportedAt', () => {
    const p = buildBackup(sampleState, 'before refactor')
    expect(p.kind).toBe(BACKUP_KIND)
    expect(p.version).toBe(BACKUP_VERSION)
    expect(p.sql).toBe(sampleState.sql)
    expect(p.groups).toEqual(sampleState.groups)
    expect(p.activeGroup).toBe('core')
    expect(p.commentMode).toBe('inline')
    expect(p.theme).toBe('dark')
    expect(p.label).toBe('before refactor')
    expect(new Date(p.exportedAt).toString()).not.toBe('Invalid Date')
  })
})

describe('validateBackup', () => {
  it('round-trips a fresh payload', () => {
    const p = buildBackup(sampleState)
    const r = validateBackup(JSON.parse(JSON.stringify(p)))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.payload).toEqual(p)
  })

  it('rejects non-objects', () => {
    expect(validateBackup(null).ok).toBe(false)
    expect(validateBackup('hi').ok).toBe(false)
    expect(validateBackup(42).ok).toBe(false)
  })

  it('rejects wrong kind', () => {
    const r = validateBackup({ kind: 'something-else', version: 1, sql: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Not a/)
  })

  it('rejects unsupported versions (higher major)', () => {
    const r = validateBackup({ kind: BACKUP_KIND, version: 999, sql: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Unsupported/)
  })

  it('requires sql', () => {
    const r = validateBackup({ kind: BACKUP_KIND, version: 1 })
    expect(r.ok).toBe(false)
  })

  it('sanitizes garbage in groups + dangling activeGroup', () => {
    const r = validateBackup({
      kind: BACKUP_KIND,
      version: 1,
      sql: '-- empty',
      groups: {
        core: ['a', '', 'a', 7, 'b'],       // dedup + drop non-strings
        '': ['x'],                          // empty-name dropped
        bad: 'not-an-array',                // dropped
      },
      activeGroup: 'ghost',                  // not in groups -> null
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.payload.groups).toEqual({ core: ['a', 'b'] })
      expect(r.payload.activeGroup).toBe(null)
    }
  })
})

describe('applyBackup', () => {
  it('drives the right action sequence', () => {
    const calls: string[] = []
    const actions = {
      setSql: (s: string) => calls.push(`setSql:${s.length}`),
      createGroup: (n: string) => calls.push(`createGroup:${n}`),
      deleteGroup: (n: string) => calls.push(`deleteGroup:${n}`),
      addToGroup: (n: string, ts: string[]) =>
        calls.push(`addToGroup:${n}:${ts.join(',')}`),
      setActiveGroup: (n: string | null) => calls.push(`setActiveGroup:${n}`),
      toggleComments: () => calls.push('toggleComments'),
      toggleTheme: () => calls.push('toggleTheme'),
    }
    const payload = buildBackup(sampleState)
    applyBackup(payload, actions, 'light', 'off', ['stale'])
    // Order: SQL -> delete existing -> create+add new -> active -> prefs.
    expect(calls[0]).toMatch(/^setSql:\d+$/)
    expect(calls).toContain('deleteGroup:stale')
    expect(calls).toContain('createGroup:core')
    expect(calls).toContain('addToGroup:core:a')
    expect(calls).toContain('createGroup:misc')
    expect(calls).not.toContain('addToGroup:misc:')   // empty list -> skipped
    expect(calls).toContain('setActiveGroup:core')
    expect(calls).toContain('toggleTheme')             // light -> dark
    expect(calls).toContain('toggleComments')          // off -> inline
  })

  it('no-ops the prefs toggles when already matching', () => {
    const calls: string[] = []
    const actions = {
      setSql: () => {},
      createGroup: () => {},
      deleteGroup: () => {},
      addToGroup: () => {},
      setActiveGroup: () => {},
      toggleComments: () => calls.push('toggleComments'),
      toggleTheme: () => calls.push('toggleTheme'),
    }
    applyBackup(buildBackup(sampleState), actions, 'dark', 'inline', [])
    expect(calls).toEqual([])
  })
})
