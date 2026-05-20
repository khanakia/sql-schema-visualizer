# Table Groups — tasks

Atomic work items for the spec in [PLAN.md](./PLAN.md). Sigil convention: `[ ]` todo · `[>]` in progress · `[x]` done · `[-]` cancelled.

## Phase 1 — store + persistence (foundation)

- [x] **T1** Extend `useStore` with `groups: Record<string, string[]>` and `activeGroup: string | null`; defaults `{}` / `null`. Add storage key `dbviz.groups.v1`, hydrate on init, persist on every mutation.
- [x] **T2** Add CRUD actions: `createGroup(name)`, `renameGroup(old, new)`, `deleteGroup(name)`, `addToGroup(name, tables[])`, `removeFromGroup(name, table)`, `setActiveGroup(name | null)`. All idempotent, all reject empty / duplicate names with no-op + console.warn.
- [x] **T3** Unit tests for the store actions (vitest in packages/react: 19 tests, all passing).

## Phase 2 — share URL codec

- [x] **T4** Two-param URL format: `#s=` (SQL) unchanged + new `#g=` (compressed groups + activeGroup JSON). Encoder returns null when payload is empty default so `&g=` is omitted. `buildShareUrl(sql, {groups, activeGroup})` builds both.
- [x] **T5** Decoder is tolerant: dedups tables, filters non-strings, drops dangling activeGroup, returns empty defaults on malformed input. 6 round-trip tests pass.

## Phase 3 — view filtering

- [x] **T6** Canvas derives `visibleSet` from `activeGroup ∩ schema.tables`; baseNodes filtered, baseEdges filtered to both-endpoints-visible.
- [x] **T7** Layout recompute is automatic — `visibleSet` feeds `baseNodes`/`baseEdges` → `laidOut` → existing setNodes effect re-runs. No new nonce needed.
- [-] **T8** Position preservation across enter/exit — deferred to v2 (current behavior: fresh dagre layout each switch, which fits the visible subset cleanly).

## Phase 4 — sidebar UI

- [x] **T9** New `<GroupsPanel>` component above the existing tables list. Header: "Groups (N)" + "+ New group" button (opens inline name input).
- [x] **T10** Row has eye (active toggle), name, `visible/total` badge (when stale members exist), ✎ rename, 🗑 delete.
- [x] **T11** Expanded group lists members with × per row; "+ Add tables…" opens an inline picker (filter input + checkboxes against non-member tables + Apply/Cancel).
- [x] **T12** Empty-state copy shipped: "No groups yet. Create one to focus on a subset of tables."

## Phase 5 — toolbar + canvas affordances

- [x] **T13** Toolbar pill: when `activeGroup` set, render `Viewing: <name> · ×` (clickable × clears active). Placed near `BackButton`.
- [x] **T14** Canvas right-click on a table node → context menu "Groups ▸": current memberships with `✓` (click to remove), other groups (click to add), "+ New group from this table". Suppress default browser context menu only for the table node area.

## Phase 6 — schema-edit interaction

- [x] **T15** When `schema` changes (SQL reparse), recompute count badges (visible / total) but DO NOT mutate `groups`. Add a per-group `Clean up` action in the `⋯` menu that prunes stale table names.
- [x] **T16** If the active group has zero visible members after a reparse, auto-clear `activeGroup` to `null` and toast/log "Group '<name>' has no visible tables in the current schema."

## Phase 7 — docs + sample

- [x] **T17** Update `README.md` (app + package) with a short "Groups" section + screenshot/GIF placeholder.
- [x] **T18** Add a small sample SQL (or extend "Relationship notation demo") that's interesting to group — e.g. a 12-table schema where 3 obvious clusters (auth, billing, content) are easy to demo.
- [>] **T19** Codec round-trip is covered by 6 unit tests; sidebar create/delete + localStorage persistence verified live in the dev server. Manual two-tab e2e (encode in tab A → paste URL in tab B → groups appear) is the only remaining check — deferred to a real-user verification pass.

## Definition of done

- [x] Build green, all 44 tests pass (25 core + 19 react), new tests for store + codec pass.
- [x] Create a group → click 👁 → only its members visible (verified in browser).
- [x] Right-click a table → Groups submenu opens with add/remove/new options.
- [x] Clear → all tables back (visibleSet falls to null → full schema).
- [x] Reload page → groups persist from localStorage; share URL `#g=` round-trips via codec unit tests.

## Out of MVP scope (logged for v2)

- [-] T8 position preservation across enter/exit group view.
- [-] Drag-to-group from canvas → sidebar (deferred per PLAN).
- [-] Color tagging / per-group chips.
- [-] Multi-group union/intersection view.
- [-] One-hop neighbor inclusion / cross-boundary edge stubs.
- [-] SQL `-- @group:` annotations.
