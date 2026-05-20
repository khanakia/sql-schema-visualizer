// Help entries — pure data, no React. Library consumers can extend or
// fully replace this list via the `entries` prop on <HelpButton /> and
// <HelpModal />, e.g.:
//
//   import { HelpButton, defaultHelpEntries } from '@khanakia/sql-schema-react'
//   <HelpButton entries={[...defaultHelpEntries, { id: 'mine', section: 'Custom', title: '…' }]} />
//
// or replace entirely:
//
//   <HelpButton entries={myEntries} />

export interface HelpEntry {
  /** Stable id used as the React key. Lowercase-kebab. */
  id: string
  /** Section header the entry appears under (e.g. "Navigation"). */
  section: string
  /** One-line title shown in the entry header. */
  title: string
  /** Longer body — plain text, may contain code-ish phrases. Wraps naturally. */
  body: string
  /** Optional keyboard shortcut chip(s). Rendered as `⌘ + [` style boxes. */
  shortcut?: string
  /** Extra search terms beyond title + body (synonyms, alt phrasings). */
  keywords?: string[]
}

/** The bundled help content. Add new features here when shipping them. */
export const defaultHelpEntries: HelpEntry[] = [
  // ── Navigation ──────────────────────────────────────────────────
  {
    id: 'pan-zoom',
    section: 'Navigation',
    title: 'Pan & zoom the canvas',
    body: 'Two-finger / trackpad scroll pans the canvas. ⌘/Ctrl + scroll zooms. Double-click to zoom in on a spot. Drag the canvas background to pan with a mouse.',
    keywords: ['scroll', 'wheel', 'pinch', 'zoom in', 'zoom out', 'figma'],
  },
  {
    id: 'fit-view',
    section: 'Navigation',
    title: 'Fit everything in view',
    body: 'Click ⤢ Fit in the toolbar to zoom out so the whole schema is visible.',
    keywords: ['fit', 'frame', 'overview'],
  },
  {
    id: 'click-to-navigate',
    section: 'Navigation',
    title: 'Jump to a table or column',
    body: 'Click any table name in the sidebar to center it on the canvas. Search filters the list — pressing Enter jumps to the first hit. Clicking a column row highlights that specific row in the table on the canvas.',
    keywords: ['navigate', 'sidebar', 'search', 'find', 'jump'],
  },
  {
    id: 'fk-follow',
    section: 'Navigation',
    title: 'Follow a foreign key',
    body: 'Click the blue ↗ glyph on any FK column to jump straight to the referenced table; that table\'s matching PK column is highlighted. Clicking the relationship line (the edge) does the same thing — ping-ponging between source and target on repeat clicks.',
    keywords: ['fk', 'foreign key', 'relationship', 'edge', 'follow', 'jump'],
  },
  {
    id: 'fk-back',
    section: 'Navigation',
    title: 'Go back through FK history',
    body: 'Each follow-the-FK jump is pushed on a 50-entry history stack. ← Back in the toolbar pops the last one. Two keyboard shortcuts work for it.',
    shortcut: '⌥/Alt + ←   or   ⌘/Ctrl + [',
    keywords: ['back', 'history', 'undo navigation', 'previous'],
  },

  // ── Multi-select + groups ───────────────────────────────────────
  {
    id: 'multi-select',
    section: 'Multi-select & groups',
    title: 'Select multiple tables',
    body: 'Shift-click or ⌘/Ctrl-click each table to add it to the selection. Alternatively drag a rubber-band rectangle on the canvas background to select everything inside. Selected tables get a purple outline.',
    shortcut: 'Shift-click   or   ⌘/Ctrl-click',
    keywords: ['multi select', 'multiselect', 'rubber band', 'lasso', 'pick'],
  },
  {
    id: 'groups-create',
    section: 'Multi-select & groups',
    title: 'Create a group',
    body: 'Open the Groups tab in the sidebar, click "+ New", type a name, press Enter. A group is just a named subset of tables — used to filter the canvas to that subset.',
    keywords: ['group', 'create', 'new', 'folder', 'subset'],
  },
  {
    id: 'groups-bulk-add',
    section: 'Multi-select & groups',
    title: 'Add a multi-selection to a group',
    body: 'Select multiple tables, right-click any one of them, then pick a group from the "Groups" submenu — every selected table is added at once. "+ New group from N tables…" creates a fresh group already containing the selection.',
    keywords: ['bulk add', 'multi add', 'right click', 'context menu'],
  },
  {
    id: 'groups-add-single',
    section: 'Multi-select & groups',
    title: 'Add one table to a group',
    body: 'Right-click the table on the canvas → Groups submenu. ✓ shows current memberships; clicking toggles them. Alternative: open the Groups tab, expand a group, click "+ Add tables…" for a checkbox picker.',
    keywords: ['add table', 'membership', 'right click'],
  },
  {
    id: 'groups-filter',
    section: 'Multi-select & groups',
    title: 'Filter canvas to a group',
    body: 'In the Groups tab, click the 👁 icon next to a group name — the canvas shows only that group\'s tables and the edges between them. The toolbar gets a "Viewing: <name> ×" pill; click × to restore the full schema. Cross-boundary FK edges are hidden while filtered.',
    keywords: ['filter', 'focus', 'view only', 'hide other', 'subset'],
  },
  {
    id: 'groups-clean',
    section: 'Multi-select & groups',
    title: 'Clean up stale group members',
    body: 'If you edit the SQL and remove a table, group memberships for that name stay (in case you add it back). The group row shows visible/total in amber. Click 🧹 Clean up inside the expanded group to prune them.',
    keywords: ['stale', 'cleanup', 'prune', 'missing', 'orphan'],
  },

  // ── Reading the diagram ─────────────────────────────────────────
  {
    id: 'erd-markers',
    section: 'Reading the diagram',
    title: 'What the line ends mean (crow\'s-foot ERD)',
    body: 'Blue crow\'s foot = FK side ("many"). Amber bar + arrowhead = PK side ("one") — the arrow points to the parent table. A circle in front of the crow\'s foot means the FK is nullable ("zero or many"). Two-way relationships render as two separate edges, each pointing the right way.',
    keywords: ['erd', 'notation', 'crow foot', 'cardinality', 'one to many', 'optional', 'direction'],
  },
  {
    id: 'sql-comments',
    section: 'Reading the diagram',
    title: 'SQL comments inline vs hover vs off',
    body: 'The 💬 toolbar button cycles through three modes: off → inline (shown beside columns) → hover (popover on hover). Captures both `--` line comments and `/* … */` block comments.',
    keywords: ['comment', 'docs', 'description', 'caption'],
  },
  {
    id: 'collapse-tables',
    section: 'Reading the diagram',
    title: 'Collapse / expand tables',
    body: '⊟ Collapse in the toolbar collapses every table to just its header (handy on big schemas). Click a table\'s ⊟ in its header to collapse only that one.',
    keywords: ['collapse', 'expand', 'minimize', 'header only'],
  },

  // ── Schema input ────────────────────────────────────────────────
  {
    id: 'paste-sql',
    section: 'Schema input',
    title: 'Paste or upload a .sql file',
    body: 'Use the "⊕ Paste / Import SQL" tab in the sidebar to drop your CREATE TABLE / ALTER TABLE script. Edits live-update the diagram. Multi-dialect: PostgreSQL, MySQL (backticks), SQLite, ANSI.',
    keywords: ['import', 'paste', 'upload', 'sql', 'ddl', 'create table'],
  },
  {
    id: 'samples',
    section: 'Schema input',
    title: 'Try a built-in sample schema',
    body: 'Click "⊞ Samples ▾" in the toolbar — covers e-commerce, blog, SaaS, banking ledger, social network, project management, library catalogue, plus the notation + groups demo.',
    keywords: ['sample', 'demo', 'example', 'template'],
  },

  // ── Output + sharing ────────────────────────────────────────────
  {
    id: 'share-url',
    section: 'Output & sharing',
    title: 'Share by URL',
    body: 'Click 🔗 Share — the whole SQL is compressed (deflate-raw, ~2.9×) into the URL fragment plus, if you have any, your groups + active group. Fragment URLs aren\'t sent to servers, so even very large schemas don\'t hit "414 URI Too Long".',
    keywords: ['share', 'link', 'copy', 'url', 'export'],
  },
  {
    id: 'export-png',
    section: 'Output & sharing',
    title: 'Export to PNG',
    body: 'Click ⤓ PNG to download a high-res image of the current canvas. Honors the active group filter, so the PNG shows what you see.',
    keywords: ['export', 'png', 'image', 'screenshot', 'download'],
  },

  // ── Look & feel ─────────────────────────────────────────────────
  {
    id: 'theme',
    section: 'Look & feel',
    title: 'Light / dark theme',
    body: 'Toggle with ☀ Light / 🌙 Dark in the toolbar. Choice is remembered.',
    keywords: ['theme', 'dark mode', 'light mode', 'appearance'],
  },
  {
    id: 'reset-layout',
    section: 'Look & feel',
    title: 'Reset positions',
    body: 'After dragging tables around, click ↺ Reset to re-run the auto-layout. The viewport (zoom + pan) is preserved so you don\'t lose your spot.',
    keywords: ['reset', 'layout', 'auto arrange', 'undrag'],
  },
  {
    id: 'layout-direction',
    section: 'Look & feel',
    title: 'Horizontal / vertical layout',
    body: 'Click ⇄ Layout to swap between left-to-right and top-to-bottom dagre layouts.',
    keywords: ['direction', 'layout', 'horizontal', 'vertical', 'lr', 'tb'],
  },
  {
    id: 'sidebar-toggle',
    section: 'Look & feel',
    title: 'Hide / show the sidebar',
    body: 'Click « in the sidebar header (or the ›/‹ pull-tab when hidden) for more canvas real estate.',
    keywords: ['sidebar', 'hide', 'show', 'collapse panel'],
  },
]

/** True if any of (title, body, keywords) matches every space-separated
 *  token in the query (case-insensitive). Designed to be fast on the
 *  small ~30-entry default set without needing a fuzzy library. */
export function matchHelpEntry(entry: HelpEntry, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = `${entry.title} ${entry.body} ${(entry.keywords ?? []).join(' ')}`.toLowerCase()
  return q.split(/\s+/).every((tok) => hay.includes(tok))
}
