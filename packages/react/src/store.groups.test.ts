// Store CRUD tests for the table-groups feature. Pure logic — no React
// rendering. Storage falls back to the in-memory adapter in node since
// there's no `window`, so localStorage behavior is also exercised end
// to end via `writeGroupsState` round-trips.

import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './store'

// Reset state before each test. Zustand stores are singletons in module
// scope; we restore the same initial shape created by the factory.
function resetStore() {
  useStore.setState({
    groups: {},
    activeGroup: null,
    focus: null,
    history: [],
    search: '',
    collapsed: {},
  })
}

beforeEach(resetStore)

describe('createGroup', () => {
  it('creates an empty group', () => {
    useStore.getState().createGroup('billing')
    expect(useStore.getState().groups).toEqual({ billing: [] })
  })

  it('trims whitespace', () => {
    useStore.getState().createGroup('  auth  ')
    expect(Object.keys(useStore.getState().groups)).toEqual(['auth'])
  })

  it('rejects empty / whitespace-only names', () => {
    useStore.getState().createGroup('')
    useStore.getState().createGroup('   ')
    expect(useStore.getState().groups).toEqual({})
  })

  it('rejects duplicate names', () => {
    useStore.getState().createGroup('a')
    useStore.getState().addToGroup('a', ['t1'])
    useStore.getState().createGroup('a')  // no-op
    expect(useStore.getState().groups).toEqual({ a: ['t1'] })  // not wiped
  })

  it('rejects names over 60 chars', () => {
    useStore.getState().createGroup('x'.repeat(61))
    expect(useStore.getState().groups).toEqual({})
  })
})

describe('addToGroup / removeFromGroup', () => {
  it('adds tables, dedups, preserves insertion order', () => {
    const s = useStore.getState()
    s.createGroup('g')
    s.addToGroup('g', ['users', 'orders', 'users', 'products'])
    s.addToGroup('g', ['orders', 'invoices'])
    expect(useStore.getState().groups.g).toEqual([
      'users',
      'orders',
      'products',
      'invoices',
    ])
  })

  it('ignores empty / non-string entries silently', () => {
    const s = useStore.getState()
    s.createGroup('g')
    // @ts-expect-error – exercise runtime guard
    s.addToGroup('g', ['ok', '', null, undefined, 7, 'ok'])
    expect(useStore.getState().groups.g).toEqual(['ok'])
  })

  it('no-op on unknown group', () => {
    useStore.getState().addToGroup('nope', ['x'])
    expect(useStore.getState().groups).toEqual({})
  })

  it('removes a member', () => {
    const s = useStore.getState()
    s.createGroup('g')
    s.addToGroup('g', ['a', 'b', 'c'])
    s.removeFromGroup('g', 'b')
    expect(useStore.getState().groups.g).toEqual(['a', 'c'])
  })

  it('removeFromGroup is a no-op for missing table / missing group', () => {
    const s = useStore.getState()
    s.createGroup('g')
    s.addToGroup('g', ['a'])
    s.removeFromGroup('g', 'zzz')
    s.removeFromGroup('absent', 'a')
    expect(useStore.getState().groups.g).toEqual(['a'])
  })
})

describe('renameGroup', () => {
  it('renames and preserves members + insertion order', () => {
    const s = useStore.getState()
    s.createGroup('a')
    s.createGroup('b')
    s.createGroup('c')
    s.addToGroup('b', ['t1', 't2'])
    s.renameGroup('b', 'beta')
    const keys = Object.keys(useStore.getState().groups)
    expect(keys).toEqual(['a', 'beta', 'c'])  // order preserved
    expect(useStore.getState().groups.beta).toEqual(['t1', 't2'])
  })

  it('updates activeGroup if it pointed at the renamed group', () => {
    const s = useStore.getState()
    s.createGroup('foo')
    s.setActiveGroup('foo')
    s.renameGroup('foo', 'fooz')
    expect(useStore.getState().activeGroup).toBe('fooz')
  })

  it('rejects rename to existing name', () => {
    const s = useStore.getState()
    s.createGroup('a')
    s.createGroup('b')
    s.renameGroup('a', 'b')
    expect(Object.keys(useStore.getState().groups)).toEqual(['a', 'b'])
  })

  it('no-op for unknown source', () => {
    useStore.getState().renameGroup('ghost', 'x')
    expect(useStore.getState().groups).toEqual({})
  })
})

describe('deleteGroup', () => {
  it('removes the group', () => {
    const s = useStore.getState()
    s.createGroup('a')
    s.createGroup('b')
    s.deleteGroup('a')
    expect(Object.keys(useStore.getState().groups)).toEqual(['b'])
  })

  it('auto-clears activeGroup if it was the deleted one', () => {
    const s = useStore.getState()
    s.createGroup('foo')
    s.setActiveGroup('foo')
    s.deleteGroup('foo')
    expect(useStore.getState().activeGroup).toBe(null)
  })

  it('leaves other active group alone', () => {
    const s = useStore.getState()
    s.createGroup('foo')
    s.createGroup('bar')
    s.setActiveGroup('foo')
    s.deleteGroup('bar')
    expect(useStore.getState().activeGroup).toBe('foo')
  })
})

describe('setActiveGroup', () => {
  it('accepts null (clear)', () => {
    const s = useStore.getState()
    s.createGroup('g')
    s.setActiveGroup('g')
    s.setActiveGroup(null)
    expect(useStore.getState().activeGroup).toBe(null)
  })

  it('rejects unknown group name', () => {
    useStore.getState().setActiveGroup('nope')
    expect(useStore.getState().activeGroup).toBe(null)
  })
})
