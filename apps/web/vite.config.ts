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
  base: command === 'build' ? '/sql-schema-visualizer/' : '/',
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
