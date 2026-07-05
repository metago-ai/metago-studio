/**
 * 诊断管理器
 *
 * 集成 Monaco 的 TypeScript LSP 和 AI 审查结果，
 * 在编辑器内联展示问题。
 */

import type { editor } from 'monaco-editor'

/** Marker 数据结构（避免直接依赖 monaco-editor 类型） */
type IMarkerData = {
  startLineNumber: number
  endLineNumber: number
  startColumn: number
  endColumn: number
  message: string
  severity: number
  source?: string
}
import type { ReviewIssue, Severity } from '../types'

// ============ 类型 ============

export interface Diagnostic {
  id: string
  file: string
  line: number
  column: number
  endLine?: number
  endColumn?: number
  message: string
  source: 'typescript' | 'ai-review' | 'linter'
  severity: 'error' | 'warning' | 'info' | 'hint'
}

// ============ 存储与订阅 ============

type DiagnosticListener = (diagnostics: Map<string, Diagnostic[]>) => void

class DiagnosticManager {
  private store = new Map<string, Diagnostic[]>()
  private listeners = new Set<DiagnosticListener>()

  /** 设置某个文件的诊断 */
  setDiagnostics(file: string, diagnostics: Diagnostic[]): void {
    this.store.set(file, diagnostics)
    this.notify()
  }

  /** 获取某个文件的诊断 */
  getDiagnostics(file: string): Diagnostic[] {
    return this.store.get(file) ?? []
  }

  /** 获取所有诊断 */
  getAllDiagnostics(): Map<string, Diagnostic[]> {
    return new Map(this.store)
  }

  /** 统计 */
  getStats(): { errors: number; warnings: number; infos: number } {
    let errors = 0, warnings = 0, infos = 0
    for (const diags of this.store.values()) {
      for (const d of diags) {
        if (d.severity === 'error') errors++
        else if (d.severity === 'warning') warnings++
        else infos++
      }
    }
    return { errors, warnings, infos }
  }

  /** 清空某个文件的诊断 */
  clear(file: string): void {
    this.store.delete(file)
    this.notify()
  }

  /** 清空所有 */
  clearAll(): void {
    this.store.clear()
    this.notify()
  }

  /** 订阅变更 */
  subscribe(listener: DiagnosticListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    const snapshot = this.getAllDiagnostics()
    this.listeners.forEach(l => l(snapshot))
  }

  /** 将 AI 审查问题转换为诊断 */
  issuesToDiagnostics(issues: ReviewIssue[], fileName: string): Diagnostic[] {
    const severityMap: Record<Severity, Diagnostic['severity']> = {
      critical: 'error',
      major: 'warning',
      minor: 'info',
      info: 'hint',
    }

    return issues
      .filter(i => !i.fileName || i.fileName === fileName)
      .map(issue => ({
        id: issue.id,
        file: fileName,
        line: issue.lineRange?.start ?? 1,
        endLine: issue.lineRange?.end,
        message: `[${issue.severity}] ${issue.description}`,
        source: 'ai-review' as const,
        severity: severityMap[issue.severity],
        column: 1,
        endColumn: 1,
      }))
  }

  /** 转换为 Monaco markers */
  toMonacoMarkers(diagnostics: Diagnostic[]): IMarkerData[] {
    const severityMap = {
      error: 8,      // MarkerSeverity.Error
      warning: 4,    // MarkerSeverity.Warning
      info: 2,       // MarkerSeverity.Info
      hint: 1,       // MarkerSeverity.Hint
    }

    return diagnostics.map(d => ({
      startLineNumber: d.line,
      endLineNumber: d.endLine ?? d.line,
      startColumn: d.column,
      endColumn: d.endColumn ?? (d.column + 1),
      message: d.message,
      severity: severityMap[d.severity] as any,
      source: d.source,
    }))
  }
}

// ============ 单例 ============

let _instance: DiagnosticManager | null = null

export function getDiagnosticManager(): DiagnosticManager {
  if (!_instance) {
    _instance = new DiagnosticManager()
  }
  return _instance
}

// ============ Monaco 编辑器集成 ============

/** 将诊断应用到 Monaco 编辑器 */
export function applyDiagnosticsToEditor(
  _editor: editor.IStandaloneCodeEditor,
  monaco: typeof import('monaco-editor'),
  file: string,
  model: editor.ITextModel | null,
): void {
  void _editor
  const dm = getDiagnosticManager()
  const diags = dm.getDiagnostics(file)
  const markers = dm.toMonacoMarkers(diags)
  if (model) {
    monaco.editor.setModelMarkers(model, 'metago-agent', markers)
  }
}
