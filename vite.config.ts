import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// base 设为 './' 以兼容 CloudBase 静态部署
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor'
            if (id.includes('zustand')) return 'state-vendor'
            if (id.includes('lucide-react')) return 'icons'
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  plugins: [react()],
})
