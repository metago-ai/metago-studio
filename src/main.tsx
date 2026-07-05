import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initErrorMonitor } from './lib/errorMonitor'
import './index.css'

// 启动错误监控（必须在渲染之前）
initErrorMonitor()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
