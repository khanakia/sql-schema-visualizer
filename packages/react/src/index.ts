// @khanakia/sql-schema-react — composable React components for SQL schema visualization.
//
// Import the stylesheet once in your app:  import '@khanakia/sql-schema-react/styles.css'
//
// Pick your level:
//  • <SchemaVisualizer />  — one-line full app (provider + sidebar + canvas)
//  • <SchemaProvider> + <SchemaCanvas/> + <SchemaSidebar/>  — compose your own
//  • useSchemaStore / useSchemaActions  — drive everything headlessly

export { SchemaVisualizer } from './SchemaVisualizer'
export type { SchemaVisualizerProps } from './SchemaVisualizer'
export { SchemaProvider } from './SchemaProvider'
export type { SchemaProviderProps } from './SchemaProvider'

export { Canvas as SchemaCanvas } from './components/Canvas'
export type { SchemaCanvasProps } from './components/Canvas'
export { Sidebar as SchemaSidebar } from './components/Sidebar'
export type { SchemaSidebarProps } from './components/Sidebar'
// atomic sidebar primitives — build your own panel
export {
  SchemaSearch,
  SchemaWarnings,
  TableList,
  SqlImport,
  GroupsPanel,
  CollapseSidebarButton,
} from './components/sidebar-parts'
export { Toolbar as SchemaToolbar } from './components/Toolbar'
export type { SchemaToolbarProps } from './components/Toolbar'
export { TableNode } from './components/TableNode'
export type { TableNodeData } from './components/TableNode'
export { SelfLoopEdge } from './components/SelfLoopEdge'
// canvas-render primitives — for users composing their own <ReactFlow>
// instead of using the bundled <SchemaCanvas>.
export {
  ErdMarkers,
  ERD_MARKER_ONE,
  ERD_MARKER_MANY_MANDATORY,
  ERD_MARKER_MANY_OPTIONAL,
} from './components/ErdMarkers'
export { GroupsContextMenu } from './components/GroupsContextMenu'
export type { GroupsContextMenuProps } from './components/GroupsContextMenu'

// Backup / restore — JSON snapshot of SQL + groups + preferences.
// The components are thin wrappers around the pure helpers below;
// consumers wanting custom UI should reach for the helpers directly.
export {
  ExportBackupButton,
  ImportBackupButton,
} from './components/Backup'
export type {
  ExportBackupButtonProps,
  ImportBackupButtonProps,
} from './components/Backup'
export {
  BACKUP_VERSION,
  BACKUP_KIND,
  buildBackup,
  validateBackup,
  applyBackup,
  downloadBackup,
} from './backup'
export type { BackupPayload, BackupApplyActions } from './backup'

// atomic toolbar primitives — build your own toolbar
export {
  ToolbarButton,
  ToolbarDivider,
  SamplesMenu,
  BackButton,
  ActiveGroupPill,
  LayoutDirectionButton,
  CollapseAllButton,
  CommentModeButton,
  ResetLayoutButton,
  ThemeButton,
  ShareButton,
  FitButton,
  ExportButton,
} from './components/controls'
export type { ToolbarButtonProps } from './components/controls'

// help system — searchable "every feature" modal + its trigger.
// Both accept an `entries` prop so you can extend or replace the
// bundled `defaultHelpEntries` for your distribution.
export { HelpButton, HelpModal } from './components/Help'
export type { HelpButtonProps, HelpModalProps } from './components/Help'
export { defaultHelpEntries, matchHelpEntry } from './help'
export type { HelpEntry } from './help'

// store + share helpers
export {
  useStore as useSchemaStore,
  useSchemaActions,
  buildShareUrl,
  SHARE_URL_SOFT_LIMIT,
} from './store'

// pure helpers for the groups feature (no React) — for custom UIs
// and custom canvases.
export { computeVisibleSet, edgeIsVisible } from './groups'

// pluggable persistence
export { setStorageAdapter, type StorageAdapter } from './storage'

// re-export the framework-agnostic core for convenience
export {
  parseSchema,
  layoutGraph,
  encodeSql,
  decodeSql,
  encodeGroups,
  decodeGroups,
  samples,
  type Schema,
  type Table,
  type Column,
  type ForeignKey,
  type Sample,
} from '@khanakia/sql-schema-core'
