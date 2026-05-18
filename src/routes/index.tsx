import { createFileRoute } from '@tanstack/react-router'
import { Sidebar } from '../components/Sidebar'
import { Canvas } from '../components/Canvas'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <main className="relative flex-1">
        <Canvas />
      </main>
    </div>
  )
}
