import { useStore } from './store'
import { Canvas } from './components/Canvas'
import { Sidebar } from './components/Sidebar'
import { DocDrawer } from './components/DocDrawer'
import { SchemaProvider, type SchemaProviderProps } from './SchemaProvider'

export interface SchemaVisualizerProps
  extends Omit<SchemaProviderProps, 'children'> {
  /** show the left sidebar (search / tables / SQL import). Default true. */
  showSidebar?: boolean
  /** show the canvas toolbar. Default true. */
  showToolbar?: boolean
  className?: string
}

/**
 * One-line full experience: provider + sidebar + canvas + toolbar.
 * For custom layouts compose SchemaProvider / SchemaSidebar / SchemaCanvas
 * (and the atomic toolbar controls) yourself instead.
 */
export function SchemaVisualizer({
  sql,
  theme,
  showSidebar = true,
  showToolbar = true,
  className,
}: SchemaVisualizerProps) {
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  return (
    <SchemaProvider sql={sql} theme={theme}>
      <div
        className={className}
        style={{ display: 'flex', height: '100%', width: '100%' }}
      >
        {showSidebar && sidebarOpen && <Sidebar />}
        <div style={{ position: 'relative', flex: 1 }}>
          <Canvas showToolbar={showToolbar} />
        </div>
      </div>
      {/* DocDrawer renders via portal — mounting it once at the
          provider root is enough; it watches store.docDrawer. */}
      <DocDrawer />
    </SchemaProvider>
  )
}
