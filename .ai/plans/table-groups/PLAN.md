# Table Groups — design spec

Named subsets of tables for focused viewing. Pick a group → canvas shows only those tables; toggle back to "all" any time. Each table can belong to 0+ groups. Per-schema, persisted locally and (optionally) carried in the share URL. Tasks live in [TASKS.md](./TASKS.md).

## Goals

- Hide noise in large schemas. "Show me just the billing tables." Four tables visible instead of forty.
- Cheap to set up: name a group, add/remove tables in seconds. No SQL changes required.
- Persistent across reloads; sharable via URL when wanted.
- Multiple groups per schema; each table in multiple groups; no exclusivity.

## Non-goals (MVP)

- No automatic grouping (FK-cluster suggestions) — future.
- No color tagging / per-group badges on table headers — future.
- No SQL `-- @group: x` annotations — future.
- No multi-group union/intersection view — single active group only.
- No dim-mode (non-group tables grayed out instead of hidden) — future toggle.

## Core invariant

> Groups are pure UI state. They do NOT touch the parsed schema, the SQL text, or the FK graph. Reparsing the SQL never changes group membership (except dropping names that no longer exist as tables).

This keeps the parser, share codec, and existing layout/render paths cleanly orthogonal to groups.

## Data model

```ts
type Groups = Record<string, string[]>   // group name -> table names
type State = {
  groups: Groups                          // all groups for the current schema
  activeGroup: string | null              // null = view all; else only that group
  // existing fields unchanged
}
```

Group name = non-empty string, unique within schema, case-sensitive, max 60 chars. Table-name entries that don't match the current schema are silently filtered at view time (the membership stays in `groups` so re-adding the table re-includes it).

Storage key: `dbviz.groups.v1` → `{ groups, activeGroup }`. Versioned key so future shape changes don't break old saves.

## View behavior

Default mode is **hide-others**:

- Visible tables = group members that exist in the current schema.
- Visible edges = edges whose **both** endpoints are in the visible set. Cross-boundary edges are dropped (not stubbed) in MVP.
- On entering / leaving a group view, re-run dagre layout over the visible subset so the remaining tables fit nicely (don't sit in their old wide-spread positions with huge gaps). Reuses the existing `relayoutNonce` mechanism.
- Toolbar shows a "Viewing: `<name>` · clear" pill when a group is active.
- "Show all" / clearing the pill restores the full view; the previous full-view layout is preserved (we don't relayout *back* — only forward into the subset).

Status of the table-name set on group enter/exit is reflected in node `selected`, `focusCol`, etc. exactly as today; nothing changes there.

## UI surfaces

Three entry points for membership editing, all operating on the same store actions:

1. **Sidebar — new "Groups" section** above the existing "Tables" section.
   - Per group: row with name, member count, eye-icon (set as active / clear), `▸` to expand.
   - Expanded: member list with `×` per table (remove); footer "+ Add tables…" opens a small picker (search + checkboxes against full table list, Apply).
   - Group-row `⋯` menu: rename, delete.
   - Header: "+ New group" → name input.
2. **Canvas right-click on a table → "Groups ▸" submenu** (the ergonomic upgrade).
   - Lists current memberships with `✓` (click to remove).
   - Lists other groups (click to add).
   - "+ New group from this table" at bottom.
3. **(v2)** Multi-select on canvas → toolbar "+ Add N tables to ▸ <group>". Deferred to scope this MVP tighter.

While a group is active:
- Removing a member → that table disappears from canvas instantly.
- Adding a member → that table appears instantly, joins the relayout.
- Empty group → still listed; if it was the active group, view auto-clears to "all".

## Persistence + share

- Local: `localStorage['dbviz.groups.v1']`. Restored on hydrate alongside SQL/theme.
- Share URL: extend the existing compressed share payload with an additive `g` (groups) and `a` (activeGroup) field. Old viewers without these fields ignore them — backward compatible. Decoder validates names + filters to known tables.

## Cross-boundary edges

In hide-others view, an edge whose other end is not in the visible set is **dropped**. No stub, no "ghost" indicator. This is the simplest and matches user intuition ("I asked for just these 4 tables"). Stubbed cross-boundary indicators are a v2 polish if requested.

## Schema-edit interaction

When the SQL is reparsed:
- Tables present in `groups` but no longer in `schema.tables` → still stored, but filtered out of visible set. Sidebar shows `(visible / total)` count, e.g. `Billing (3 / 5)`, with a `Clean up` action that prunes the stale names from membership.
- New tables added in SQL never auto-join any group — explicit addition only.

## Risk register

- **Relayout disorientation** — re-running dagre on the subset means tables jump to new positions. Mitigation: animate the position change (~300 ms ease-out) instead of snapping.
- **Share URL bloat** — many large groups grow the payload. Mitigation: stay under the existing `SHARE_URL_SOFT_LIMIT`; if exceeded, decoder/UI warns same as for big SQL.
- **Editing a group while not viewing it** — feedback gap (changes aren't visible). Mitigation: sidebar member count updates immediately; success toast not needed, the count change is the feedback.
- **Two open tabs with same schema diverging** — both write to the same localStorage key. Mitigation: last-write-wins (existing pattern); document the limitation.

## Open decisions (locked for MVP unless objections)

- View mode default = **hide** (not dim).
- Cross-boundary edges = **drop** (not stub).
- Relayout on group switch = **yes, animated**.
- Multi-group union = **no** (single active group only).
- Color tagging = **no** for MVP.
- Share URL includes groups = **yes** (additive, backward-compat).
- Right-click submenu = **yes** for MVP (sidebar + right-click both ship).

## Out of scope (revisit after MVP feedback)

Auto-cluster suggestions, color chips, dim mode, multi-group union/intersection, SQL annotations, one-hop neighbor inclusion, drag-to-group, undo stack for membership edits.
