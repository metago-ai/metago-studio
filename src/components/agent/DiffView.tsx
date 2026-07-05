import { useEffect, useState } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import { X, GitCompare } from 'lucide-react'
import type { DiffResult } from '../../lib/git/gitProvider'

interface DiffViewProps {
  diff: DiffResult | null
  onClose: () => void
}

/** Monaco DiffEditor 差异对比视图 */
export function DiffView({ diff, onClose }: DiffViewProps) {
  const [language, setLanguage] = useState('typescript')

  useEffect(() => {
    if (diff) {
      const ext = diff.newPath.split('.').pop() ?? ''
      const langMap: Record<string, string> = {
        ts: 'typescript', tsx: 'typescript',
        js: 'javascript', jsx: 'javascript',
        css: 'css', json: 'json', md: 'markdown',
        html: 'html', py: 'python', go: 'go',
      }
      setLanguage(langMap[ext] ?? 'text')
    }
  }, [diff])

  if (!diff) return null

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-border-subtle bg-bg-deep">
        <GitCompare className="w-3.5 h-3.5 text-accent-blue" />
        <span className="text-xs text-zinc-300 font-medium">{diff.newPath}</span>
        <button
          onClick={onClose}
          className="ml-auto p-1 text-zinc-500 hover:text-zinc-300"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <DiffEditor
          height="100%"
          original={diff.oldContent}
          modified={diff.newContent}
          language={language}
          theme="vs-dark"
          options={{
            readOnly: true,
            renderSideBySide: true,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          }}
        />
      </div>
    </div>
  )
}
