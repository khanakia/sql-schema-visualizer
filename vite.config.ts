import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// https://vite.dev/config/
// On GitHub Pages the app is served from /<repo>/, so the production
// build needs that base path; local dev stays at /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/sql-schema-visualizer/' : '/',
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
}))
