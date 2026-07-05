import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// base 设为 '/studio/' 以兼容 CloudBase 子目录部署
// 绝对路径确保 /studio 和 /studio/ 都能正确加载资源
export default defineConfig({
  base: '/studio/',
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
