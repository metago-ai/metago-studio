import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Electron 打包专用 Vite 配置
// base 使用相对路径，确保 file:// 协议下资源正确加载
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
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
