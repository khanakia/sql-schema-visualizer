import { createFileRoute } from '@tanstack/react-router'
import {
  SchemaSidebar,
  SchemaCanvas,
  useSchemaStore,
} from '@khanakia/sql-schema-react'

export const Route = createFileRoute('/')({
  component: Home,
})

// Inline styles so the app shell never depends on Tailwind scanning the
// app dir — only @khanakia/sql-schema-react owns Tailwind classes.
function Home() {
  const sidebarOpen = useSchemaStore((s) => s.sidebarOpen)
  const toggleSidebar = useSchemaStore((s) => s.toggleSidebar)
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
      }}
    >
      {sidebarOpen && <SchemaSidebar />}
      <main style={{ position: 'relative', flex: 1 }}>
        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            title="Show sidebar"
            style={{
              position: 'absolute',
              left: 12,
              top: 12,
              zIndex: 20,
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface-3)',
              color: 'var(--text-strong)',
              padding: '6px 10px',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            ☰ Panel
          </button>
        )}
        <SchemaCanvas />
      </main>
    </div>
  )
}
