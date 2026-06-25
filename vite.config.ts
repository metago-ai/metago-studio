import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// base 设为 './' 以兼容 CloudBase 静态部署
export default defineConfig({
  base: './',
  plugins: [react()],
})
