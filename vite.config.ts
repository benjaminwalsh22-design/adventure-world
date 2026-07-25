import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// DEPLOY_BASE is set by CI when deploying to a sub-path host
// (GitHub Pages project sites serve at /<repo>/). Local dev stays at /.
export default defineConfig({
  base: process.env.DEPLOY_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2020',
    // Keep three.js in its own chunk so the app shell loads fast on cellular.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) return 'three'
        },
      },
    },
  },
})
