import { useState, useCallback, useEffect, useRef } from 'react'
import { Search, CaseSensitive, Regex, FileCode, ChevronRight } from 'lucide-react'
import { getFS, type FileSearchResult } from '../../lib/fs/fsInterface'

interface SearchPanelProps {
  onResultClick: (result: FileSearchResult) => void
}

/** 跨文件搜索面板 */
export function SearchPanel({ onResultClick }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FileSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [filePattern, setFilePattern] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([])
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    try {
      const fs = await getFS()
      const searchResults = await fs.search(query, {
        regex: useRegex,
        caseSensitive,
        filePattern: filePattern || undefined,
        maxResults: 200,
      })
      if (!controller.signal.aborted) {
        setResults(searchResults)
      }
    } catch (e) {
      console.error('搜索失败', e)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [query, caseSensitive, useRegex, filePattern])

  // 防抖
  useEffect(() => {
    const timer = setTimeout(handleSearch, 300)
    return () => clearTimeout(timer)
  }, [handleSearch])

  // 按文件分组
  const grouped = results.reduce<Record<string, FileSearchResult[]>>((acc, r) => {
    (acc[r.filePath] ??= []).push(r)
    return acc
  }, {})

  const fileCount = Object.keys(grouped).length

  return (
    <div className="h-full flex flex-col">
      {/* 搜索输入 */}
      <div className="flex-shrink-0 p-2 space-y-1.5 border-b border-border-subtle">
        <div className="flex items-center gap-1">
          <div className="flex-1 flex items-center gap-1 px-2 py-1 rounded-lg bg-bg-deep border border-border-subtle">
            <Search className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="搜索..."
              className="flex-1 bg-transparent text-xs text-zinc-200 focus:outline-none placeholder:text-zinc-600"
              autoFocus
            />
            {loading && <div className="w-3 h-3 border border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCaseSensitive(!caseSensitive)}
            className={`p-1 rounded ${caseSensitive ? 'bg-accent-emerald/15 text-accent-emerald' : 'text-zinc-500 hover:text-zinc-300'}`}
            title="区分大小写"
          >
            <CaseSensitive className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setUseRegex(!useRegex)}
            className={`p-1 rounded ${useRegex ? 'bg-accent-emerald/15 text-accent-emerald' : 'text-zinc-500 hover:text-zinc-300'}`}
            title="正则表达式"
          >
            <Regex className="w-3.5 h-3.5" />
          </button>
          <input
            value={filePattern}
            onChange={e => setFilePattern(e.target.value)}
            placeholder="*.ts"
            className="w-20 px-1.5 py-0.5 text-[10px] rounded bg-bg-deep border border-border-subtle text-zinc-300 focus:outline-none"
            title="文件名过滤"
          />
          <span className="ml-auto text-[10px] text-zinc-600">
            {results.length > 0 && `${results.length} 项 / ${fileCount} 文件`}
          </span>
        </div>
      </div>

      {/* 结果列表 */}
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 && query && !loading && (
          <div className="px-3 py-4 text-center text-[11px] text-zinc-600">
            无匹配结果
          </div>
        )}
        {!query && (
          <div className="px-3 py-4 text-center text-[11px] text-zinc-600">
            输入关键词开始搜索
          </div>
        )}
        {Object.entries(grouped).map(([filePath, items]) => (
          <div key={filePath} className="border-b border-border-subtle/50">
            <div className="flex items-center gap-1 px-2 py-1 bg-bg-deep/30">
              <FileCode className="w-3 h-3 text-zinc-500" />
              <span className="text-[10px] text-zinc-400 truncate">{filePath}</span>
              <span className="text-[9px] text-zinc-600 ml-auto">{items.length}</span>
            </div>
            {items.map((r, i) => (
              <button
                key={i}
                onClick={() => onResultClick(r)}
                className="w-full text-left px-3 py-1 hover:bg-bg-hover group"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-zinc-600 font-mono w-8">{r.line}</span>
                  <ChevronRight className="w-2.5 h-2.5 text-zinc-700 group-hover:text-zinc-500" />
                  <code className="text-[10px] text-zinc-400 font-mono truncate">
                    {r.lineText}
                  </code>
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
