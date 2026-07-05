import { useRef, forwardRef, useImperativeHandle } from 'react'
import Editor, { type OnMount, type OnChange } from '@monaco-editor/react'

interface CodeEditorProps {
  value: string
  language?: string
  onChange?: (value: string) => void
  onSelectionChange?: (selectedText: string, range?: { startLine: number; endLine: number }) => void
}

/** 暴露给父组件的方法 */
export interface CodeEditorHandle {
  /** 跳转到指定行号并高亮 */
  jumpToLine: (start: number, end?: number) => void
}

/** Monaco 代码编辑器封装（VS Code 同款编辑器） */
export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  { value, language = 'typescript', onChange, onSelectionChange },
  ref,
) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null)

  useImperativeHandle(ref, () => ({
    jumpToLine(start: number, end?: number) {
      const editor = editorRef.current
      const monaco = monacoRef.current
      if (!editor || !monaco) return

      const endLine = end ?? start
      // 设置选区
      editor.setSelection(new monaco.Range(start, 1, endLine, 1))
      // 滚动到目标行
      editor.revealLineInCenter(start)
      // 聚焦编辑器
      editor.focus()

      // 触发选区回调（让 AI 对话面板同步）
      if (onSelectionChange) {
        const model = editor.getModel()
        const selectedText = model?.getValueInRange({
          startLineNumber: start,
          startColumn: 1,
          endLineNumber: endLine,
          endColumn: (model?.getLineMaxColumn(endLine) ?? 1),
        }) || ''
        onSelectionChange(selectedText, { startLine: start, endLine })
      }
    },
  }), [onSelectionChange])

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // 定义 MetaGO 暗色主题（与 Studio 整体配色一致）
    monaco.editor.defineTheme('metago-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#0a0a0b',
        'editor.foreground': '#e4e4e7',
        'editorLineNumber.foreground': '#52525b',
        'editorLineNumber.activeForeground': '#a1a1aa',
        'editor.selectionBackground': '#10b98133',
        'editor.lineHighlightBackground': '#18181b',
        'editorCursor.foreground': '#10b981',
      },
    })
    monaco.editor.setTheme('metago-dark')

    // 监听选区变化（供 AI 对话面板获取选中代码）
    editor.onDidChangeCursorSelection(e => {
      if (onSelectionChange) {
        const model = editor.getModel()
        const selectedText = model?.getValueInRange(e.selection) || ''
        onSelectionChange(selectedText, {
          startLine: e.selection.startLineNumber,
          endLine: e.selection.endLineNumber,
        })
      }
    })
  }

  const handleChange: OnChange = (val) => {
    onChange?.(val ?? '')
  }

  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      onMount={handleMount}
      onChange={handleChange}
      loading={
        <div className="flex items-center justify-center h-full bg-bg-deep">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-accent-emerald rounded-full animate-spin" />
        </div>
      }
      options={{
        fontSize: 13,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        lineNumbers: 'on',
        minimap: { enabled: true, scale: 1 },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        padding: { top: 12, bottom: 12 },
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        renderWhitespace: 'selection',
      }}
    />
  )
})
