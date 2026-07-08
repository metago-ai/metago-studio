/**
 * Admin Tab ErrorBoundary
 *
 * 包裹每个 Tab 内容，防止单个 Tab 渲染崩溃导致整个 AdminPage 黑屏。
 * 崩溃时显示友好错误提示 + 重试按钮，而非白屏。
 */

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  tabLabel?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class TabErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[TabErrorBoundary] Tab 渲染崩溃:', error, info)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card-base p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-zinc-200 mb-2">
            {this.props.tabLabel ? `${this.props.tabLabel} 加载失败` : '页面加载失败'}
          </h3>
          <p className="text-xs text-zinc-500 mb-1">该 Tab 渲染时发生错误，已隔离防止影响其他页面。</p>
          <p className="text-xs text-red-400/70 font-mono mb-4 break-all px-4">
            {this.state.error?.message || '未知错误'}
          </p>
          <button
            onClick={this.handleRetry}
            className="btn-secondary text-xs inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
