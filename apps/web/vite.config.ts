import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// The app bundles @sqlviz/* from source so Tailwind scans the component
// classes and HMR works in dev. The packages still ship their own tsup
// builds for external consumers.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/sql-schema-visualizer/' : '/',
  resolve: {
    alias: {
      '@sqlviz/react/styles.css': r('../../packages/react/src/styles.css'),
      '@sqlviz/react': r('../../packages/react/src/index.ts'),
      '@sqlviz/core': r('../../packages/core/src/index.ts'),
    },
  },
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
}))
