import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  RouterProvider,
  createRouter,
  createHashHistory,
} from '@tanstack/react-router'
import './index.css'
import { routeTree } from './routeTree.gen'

// Hash history keeps routing working under any base path (e.g. the
// /sql-schema-visualizer/ subpath on GitHub Pages) with no server-side
// rewrite or 404 fallback needed.
const router = createRouter({
  routeTree,
  history: createHashHistory(),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
