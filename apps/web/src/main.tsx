import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  RouterProvider,
  createRouter,
  createHashHistory,
} from '@tanstack/react-router'
import '@khanakia/sql-schema-react/styles.css'
import { useSchemaStore, decodeSql } from '@khanakia/sql-schema-react'
// Eager — strips a #s=<token> share link from the URL synchronously BEFORE
// the router is created, so the hash router never mounts on the token and
// flashes "Not Found".
import { pendingShareToken } from './shareBoot'
import { routeTree } from './routeTree.gen'

// Hydrate from a shared link (decode is async; the token was already
// stripped from the URL synchronously by shareBoot).
if (pendingShareToken) {
  decodeSql(pendingShareToken).then((sql) => {
    if (sql) useSchemaStore.getState().setSql(sql)
  })
}

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
