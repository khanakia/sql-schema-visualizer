import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// The app bundles @khanakia/sql-schema-* from source so Tailwind scans the component
// classes and HMR works in dev. The packages still ship their own tsup
// builds for external consumers.
export default defineConfig(({ command }) => ({
  // Production assets serve under the canonical gateway path
  // khanakia.com/app/sql-schema-visualizer/ — the edge gateway forwards
  // the path UNCHANGED (no /app stripping), so the origin must serve at
  // exactly this base. Keep this string == the ROUTES KV key
  // `app/sql-schema-visualizer`. Routing is hash-based so base only
  // affects asset URLs, not the router.
  base: command === 'build' ? '/app/sql-schema-visualizer/' : '/',
  resolve: {
    alias: {
      '@khanakia/sql-schema-react/styles.css': r('../../packages/react/src/styles.css'),
      '@khanakia/sql-schema-react': r('../../packages/react/src/index.ts'),
      '@khanakia/sql-schema-core': r('../../packages/core/src/index.ts'),
    },
  },
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
}))
