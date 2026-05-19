import { createFileRoute } from '@tanstack/react-router'
import {
  SchemaSidebar,
  SchemaCanvas,
  useSchemaStore,
} from '@sqlviz/react'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const sidebarOpen = useSchemaStore((s) => s.sidebarOpen)
  const toggleSidebar = useSchemaStore((s) => s.toggleSidebar)
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {sidebarOpen && <SchemaSidebar />}
      <main className="relative flex-1">
        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            title="Show sidebar"
            className="absolute left-3 top-3 z-20 rounded-md border border-[var(--border)] bg-[var(--surface-3)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-strong)] hover:bg-[var(--hover)]"
          >
            ☰ Panel
          </button>
        )}
        <SchemaCanvas />
      </main>
    </div>
  )
}
