import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Separate build for the public GitHub Pages guide (the NoteBook page only).
 * Kept apart from vite.config.ts because it needs a different `base` (GitHub
 * Pages project-site subpath) and a different entry (notebook.html), and must
 * never accidentally bundle the authenticated dashboard's index.html/App.tsx.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/ai-dev-guardian/',
  build: {
    outDir: 'dist-notebook',
    rollupOptions: {
      input: 'notebook.html',
    },
  },
})
