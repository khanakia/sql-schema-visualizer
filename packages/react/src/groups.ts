// Composable helpers around the groups feature. Pure (no React) so they
// can be used in node code, custom canvases, tests, or library consumers
// building their own UI on top of `useSchemaStore`.

import type { Schema } from '@khanakia/sql-schema-core'

/**
 * Returns the set of table names that should be VISIBLE on the canvas
 * given the active group + the full schema. When `activeGroup` is null
 * (the "show all" state) returns null — callers should treat null as
 * "no filter; show everything".
 *
 * Filtering applies after the schema intersection: a group can keep a
 * stale member (e.g. table was removed from SQL) but it just won't be
 * in the returned set — the storage entry stays, so re-adding the
 * table to SQL re-includes it without any user action.
 */
export function computeVisibleSet(
  schema: Schema,
  groups: Record<string, string[]>,
  activeGroup: string | null,
): Set<string> | null {
  if (!activeGroup) return null
  const members = groups[activeGroup]
  if (!members) return null
  const known = new Set(schema.tables.map((t) => t.name))
  return new Set(members.filter((m) => known.has(m)))
}

/**
 * True if a relationship should render with `activeGroup` enabled.
 * Both endpoints must be in the visible set. `visibleSet === null`
 * means "no filter" — every edge passes. Used by the Canvas to filter
 * `baseEdges`; exported so consumers building custom canvases can
 * reuse the same predicate.
 */
export function edgeIsVisible(
  visibleSet: Set<string> | null,
  source: string,
  target: string,
): boolean {
  if (visibleSet === null) return true
  return visibleSet.has(source) && visibleSet.has(target)
}
