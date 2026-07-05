import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bot, FolderOpen, PanelBottomClose, PanelBottomOpen,
  Search, GitBranch, Files, AlertCircle, TriangleAlert,
  Zap, Wrench, History as HistoryIcon, Globe,
  PanelRightClose, PanelRightOpen, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { FileTree } from '../components/agent/FileTree'
import { TokenUsageWidget } from '../components/agent/TokenUsageWidget'
import { DownloadDesktopButton } from '../components/agent/DownloadDesktopButton'
import { CodeEditor, type CodeEditorHandle } from '../components/agent/CodeEditor'
import { AIChatPanel } from '../components/agent/AIChatPanel'
import { ReviewBoard } from '../components/agent/ReviewBoard'
import { WorkspaceSelector } from '../components/agent/WorkspaceSelector'
import { TodoPanel, type AgentStep } from '../components/agent/TodoPanel'
import { ContextPanel } from '../components/agent/ContextPanel'
import { TerminalPanel } from '../components/agent/TerminalPanel'
import { SearchPanel } from '../components/agent/SearchPanel'
import { SourceControlPanel } from '../components/agent/SourceControlPanel'
import { FileTabs, type OpenTab } from '../components/agent/FileTabs'
import { CommandPalette } from '../components/agent/CommandPalette'
import { DiffView } from '../components/agent/DiffView'
import { PreviewPanel } from '../components/agent/PreviewPanel'
import { MCPPanel } from '../components/agent/MCPPanel'
import { SkillBrowser } from '../components/agent/SkillBrowser'
import { SessionHistory } from '../components/agent/SessionHistory'
import { ResizeHandle } from '../components/agent/ResizeHandle'
import { useResizablePanel } from '../hooks/useResizablePanel'
import type { ChatSession } from '../lib/sessionStore'
import { DownloadDesktopBanner } from '../components/agent/DownloadDesktopBanner'
import { useStore } from '../store/useStore'
import {
  getFS, isFSSupported, type WorkspaceMeta,
  type FileTreeNode, type FileSearchResult,
} from '../lib/fs/fsInterface'
import { getMemoryManager } from '../lib/memoryManager'
import { getDiagnosticManager, type Diagnostic } from '../lib/diagnostics'
import { getFileDiff, type DiffResult } from '../lib/git/gitProvider'
import type { ReviewIssue, ReviewSession } from '../types'

type SidebarTab = 'files' | 'search' | 'git' | 'problems' | 'skills' | 'mcp' | 'history'
type BottomTab = 'todo' | 'terminal' | 'problems'

/** MetaGO Agent 智能体主页 */
export function AgentPage() {
  // === 工作区 & 文件 ===
  const [workspace, setWorkspace] = useState<WorkspaceMeta | null>(null)
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
  const [activeFile, setActiveFile] = useState<{ path: string; name: string; language?: string } | null>(null)
  const [editorContent, setEditorContent] = useState('')
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([])
  const [selectedCode, setSelectedCode] = useState('')
  const [selectedLineRange, setSelectedLineRange] = useState<{ start: number; end: number } | undefined>(undefined)
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set())

  // === UI 面板 ===
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('files')
  const [bottomTab, setBottomTab] = useState<BottomTab>('todo')
  const [diffView, setDiffView] = useState<DiffResult | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [activeSkills, setActiveSkills] = useState<string[]>([])

  // === 可拖拽 + 可折叠面板系统（参考 Trae IDE / VS Code）===
  // 左侧栏（文件资源管理器等）：横向拖拽调整宽度，再次点击活动栏图标可折叠
  const sidebarPanel = useResizablePanel({
    key: 'agent-sidebar-panel',
    defaultSize: 240,
    minSize: 170,
    maxSize: 500,
    orientation: 'horizontal',
    reverse: false,
  })
  // 右面板（AI 对话 + 审查看板）：横向拖拽调整宽度，向左拖增加宽度
  const rightPanel = useResizablePanel({
    key: 'agent-right-panel',
    defaultSize: 420,
    minSize: 300,
    maxSize: 800,
    orientation: 'horizontal',
    reverse: true,
  })
  // 底部面板（Agent 执行/终端/问题）：纵向拖拽调整高度，向上拖增加高度
  const bottomPanel = useResizablePanel({
    key: 'agent-bottom-panel',
    defaultSize: 200,
    minSize: 120,
    maxSize: 500,
    orientation: 'vertical',
    reverse: true,
  })
  // 审查看板（右面板内部下半部分）：纵向拖拽调整高度
  const reviewPanel = useResizablePanel({
    key: 'agent-review-panel',
    defaultSize: 200,
    minSize: 100,
    maxSize: 500,
    orientation: 'vertical',
    reverse: true,
  })

  // === 审查看板 ===
  const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null)
  const [decisionLockPassed, setDecisionLockPassed] = useState<boolean | undefined>(undefined)
  const [decisionLockReason, setDecisionLockReason] = useState<string | undefined>(undefined)

  // === 诊断 ===
  const [diagStats, setDiagStats] = useState({ errors: 0, warnings: 0 })

  // === Agent 自治 ===
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([])
  const [agentRunning, setAgentRunning] = useState(false)

  // === 会话管理（持久化对话历史） ===
  // currentSessionId 持久化到 localStorage：刷新页面 / 切换页面再回来，当前对话不丢失
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(() => {
    try { return localStorage.getItem('metago_current_session_id') ?? undefined } catch { return undefined }
  })
  // 当前对话消息数（用于 ContextPanel token 用量显示）
  const [, setMessageCount] = useState(0)

  // === 命令面板 ===
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  const editorHandleRef = useRef<CodeEditorHandle>(null)
  const fsSupported = isFSSupported()

  const tier = useStore(s => s.tier)
  const navigate = useNavigate()
  const isPro = tier === 'pro' || tier === 'pro_plus' || tier === 'team' || tier === 'enterprise'

  // currentSessionId 变化时持久化到 localStorage（刷新/切页后恢复当前对话）
  useEffect(() => {
    try {
      if (currentSessionId) localStorage.setItem('metago_current_session_id', currentSessionId)
      else localStorage.removeItem('metago_current_session_id')
    } catch { /* localStorage 不可用时忽略 */ }
  }, [currentSessionId])

  // === 初始化 ===
  useEffect(() => {
    const dm = getDiagnosticManager()
    const unsub = dm.subscribe(() => {
      setDiagStats(dm.getStats())
    })
    return unsub
  }, [])

  useEffect(() => {
    if (fsSupported) {
      getFS().then(fs => fs.restoreWorkspace()).then(meta => {
        if (meta) handleWorkspaceOpen(meta)
      }).catch(() => {})
    }
  }, [])

  // Ctrl+P 命令面板
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault()
        setCommandPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Ctrl+S 保存
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (workspace && activeFile) {
          try {
            const fs = await getFS()
            await fs.writeFile(activeFile.path, editorContent)
            setDirtyFiles(prev => { const n = new Set(prev); n.delete(activeFile.path); return n })
          } catch (e) { console.error('保存失败', e) }
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [workspace, activeFile, editorContent])

  // === 工作区操作 ===
  const handleWorkspaceOpen = useCallback(async (meta: WorkspaceMeta) => {
    setWorkspace(meta)
    const memory = getMemoryManager()
    await memory.initProjectMemory(meta.path)
    try {
      const fs = await getFS()
      const tree = await fs.readTree('', 2)
      setFileTree(tree)
      setSidebarTab('files')
    } catch (e) { console.error('读取文件树失败', e) }
  }, [])

  // === 文件操作 ===
  const openFile = useCallback(async (path: string, name: string, language?: string) => {
    setActiveFile({ path, name, language })
    if (workspace) {
      try {
        const fs = await getFS()
        const content = await fs.readFile(path)
        setEditorContent(content)
        getMemoryManager().addRecentFile(path)
      } catch (e) {
        setEditorContent('// 读取失败：' + (e as Error).message)
      }
    } else {
      // 未打开工作区时不展示任何假内容
      setActiveFile(null)
    }
    // 添加标签页
    setOpenTabs(prev => {
      if (prev.find(t => t.path === path)) return prev
      return [...prev, { path, name, language }]
    })
    // 清除该文件的诊断显示
    getDiagnosticManager().clear(path)
  }, [workspace])

  const handleSelectFile = useCallback((node: FileTreeNode) => {
    if (node.type === 'file') openFile(node.path, node.name, node.language)
  }, [openFile])

  const handleEditorChange = useCallback((value: string) => {
    setEditorContent(value)
    if (activeFile) {
      setDirtyFiles(prev => {
        const n = new Set(prev)
        n.add(activeFile.path)
        return n
      })
    }
  }, [activeFile])

  const handleTabClose = useCallback((path: string) => {
    setOpenTabs(prev => {
      const filtered = prev.filter(t => t.path !== path)
      if (activeFile?.path === path) {
        const next = filtered[filtered.length - 1]
        if (next) {
          openFile(next.path, next.name, next.language)
        } else {
          setActiveFile(null)
          setEditorContent('')
        }
      }
      return filtered
    })
  }, [activeFile, openFile])

  // 搜索结果点击
  const handleSearchResultClick = useCallback(async (r: FileSearchResult) => {
    await openFile(r.filePath, r.fileName)
    setTimeout(() => editorHandleRef.current?.jumpToLine(r.line, r.line), 100)
  }, [openFile])

  // === AI 审查 ===
  const handleReviewComplete = useCallback((messageId: string, issues: ReviewIssue[], fullContent: string) => {
    setReviewSession({ id: `review-${Date.now()}`, messageId, timestamp: new Date().toISOString(), issues })

    // 将问题注入诊断系统
    if (activeFile) {
      const dm = getDiagnosticManager()
      const diags = dm.issuesToDiagnostics(issues, activeFile.name) as Diagnostic[]
      dm.setDiagnostics(activeFile.path, diags)
    }

    const record = useStore.getState().runValidation({
      userInput: (selectedCode || fullContent).slice(0, 500),
      aiOutput: fullContent,
    })
    setDecisionLockPassed(record.passed)
    setDecisionLockReason(record.blockedReason)
  }, [selectedCode, activeFile])

  const handleJumpToIssue = useCallback((issue: ReviewIssue) => {
    if (issue.lineRange) editorHandleRef.current?.jumpToLine(issue.lineRange.start, issue.lineRange.end)
  }, [])

  // Git diff 查看
  const handleGitFileClick = useCallback(async (path: string) => {
    if (!workspace) return
    try {
      const fs = await getFS()
      const diff = await getFileDiff(fs, path)
      if (diff) setDiffView(diff)
    } catch (e) { console.error('diff 失败', e) }
  }, [workspace])

  // === Agent 执行步骤回调（接通 TodoPanel） ===
  const handleToolCall = useCallback((toolName: string, args: Record<string, unknown>, result: string) => {
    setAgentSteps(prev => [...prev, {
      id: `step-${Date.now()}-${prev.length}`,
      index: prev.length + 1,
      action: toolName,
      params: args,
      result,
      status: 'completed',
      timestamp: new Date().toISOString(),
    }])
  }, [])

  const handleSendStart = useCallback(() => {
    setAgentSteps([])
    setAgentRunning(true)
  }, [])

  const handleSendEnd = useCallback(() => {
    setAgentRunning(false)
  }, [])

  const handleClearSteps = useCallback(() => {
    setAgentSteps([])
  }, [])

  // === 会话管理回调 ===
  // 新建对话：清空 currentSessionId，AIChatPanel 通过 key 变化重挂载并清空消息
  const handleNewChat = useCallback(() => {
    setCurrentSessionId(undefined)
  }, [])

  // 恢复历史会话：设置 currentSessionId，AIChatPanel 通过 key 变化重挂载并加载该会话消息
  const handleRestoreSession = useCallback((session: ChatSession) => {
    setCurrentSessionId(session.id)
  }, [])

  // 会话首次创建时记录 ID（用于后续持久化更新）
  const handleSessionCreated = useCallback((id: string) => {
    setCurrentSessionId(id)
  }, [])

  // === 渲染 ===
  const selectedLineCount = selectedCode ? selectedCode.split('\n').length : 0
  const hasWorkspace = Boolean(workspace)

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-2 overflow-hidden">
      {/* Web 端桌面版下载引导（桌面端自动隐藏） */}
      <DownloadDesktopBanner />

      {/* 顶部工具栏 */}
      <div className="flex-shrink-0 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-accent-emerald" />
          <h2 className="text-sm font-semibold text-zinc-100">MetaGO Agent</h2>
          <WorkspaceSelector current={workspace} onWorkspaceOpen={handleWorkspaceOpen} />
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 border border-border-subtle rounded"
            title="Ctrl+P"
          >
            <Search className="w-3 h-3" />
            搜索文件
          </button>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          <button
            onClick={() => { setSidebarTab('problems'); setBottomTab('problems'); }}
            className="flex items-center gap-1 hover:text-zinc-300"
            title="问题"
          >
            <AlertCircle className="w-3 h-3" />
            <span className={diagStats.errors > 0 ? 'text-red-400' : ''}>{diagStats.errors}</span>
            <TriangleAlert className="w-3 h-3 ml-1" />
            <span className={diagStats.warnings > 0 ? 'text-orange-400' : ''}>{diagStats.warnings}</span>
          </button>
          <TokenUsageWidget
            onUpgradeClick={() => navigate('/pro')}
            onByokClick={() => navigate('/pro?tab=byok')}
          />
          <DownloadDesktopButton />
          {hasWorkspace ? (
            <span className="text-accent-emerald">● 已连接</span>
          ) : fsSupported ? (
            <span>演示模式</span>
          ) : (
            <span className="text-orange-400">浏览器受限</span>
          )}
        </div>
      </div>

      {/* 主区域：可拖拽 + 可折叠布局（参考 Trae IDE / VS Code） */}
      <div className="flex-1 flex gap-2 min-h-0">
        {/* 活动栏（最左侧图标列，永远显示，不可折叠） */}
        <aside className="flex-shrink-0 w-11 flex flex-col items-center gap-1 py-2 bg-bg-card/40 border border-border-subtle rounded-lg">
          <ActivityIcon icon={Files} active={sidebarTab === 'files' && !sidebarPanel.collapsed} onClick={() => {
            if (sidebarTab === 'files' && !sidebarPanel.collapsed) sidebarPanel.toggleCollapse()
            else { setSidebarTab('files'); sidebarPanel.setCollapsed(false) }
          }} label="文件" />
          <ActivityIcon icon={Search} active={sidebarTab === 'search' && !sidebarPanel.collapsed} onClick={() => {
            if (sidebarTab === 'search' && !sidebarPanel.collapsed) sidebarPanel.toggleCollapse()
            else { setSidebarTab('search'); sidebarPanel.setCollapsed(false) }
          }} label="搜索" />
          <ActivityIcon icon={GitBranch} active={sidebarTab === 'git' && !sidebarPanel.collapsed} onClick={() => {
            if (sidebarTab === 'git' && !sidebarPanel.collapsed) sidebarPanel.toggleCollapse()
            else { setSidebarTab('git'); sidebarPanel.setCollapsed(false) }
          }} label="Git" badge={0} />
          <ActivityIcon
            icon={AlertCircle}
            active={sidebarTab === 'problems' && !sidebarPanel.collapsed}
            onClick={() => {
              if (sidebarTab === 'problems' && !sidebarPanel.collapsed) sidebarPanel.toggleCollapse()
              else { setSidebarTab('problems'); sidebarPanel.setCollapsed(false) }
            }}
            label="问题"
            badge={diagStats.errors + diagStats.warnings}
            badgeColor={diagStats.errors > 0 ? 'red' : 'orange'}
          />
          <div className="flex-1" />
          <ActivityIcon icon={Zap} active={sidebarTab === 'skills' && !sidebarPanel.collapsed} onClick={() => {
            if (sidebarTab === 'skills' && !sidebarPanel.collapsed) sidebarPanel.toggleCollapse()
            else { setSidebarTab('skills'); sidebarPanel.setCollapsed(false) }
          }} label="技能" />
          <ActivityIcon icon={Wrench} active={sidebarTab === 'mcp' && !sidebarPanel.collapsed} onClick={() => {
            if (sidebarTab === 'mcp' && !sidebarPanel.collapsed) sidebarPanel.toggleCollapse()
            else { setSidebarTab('mcp'); sidebarPanel.setCollapsed(false) }
          }} label="MCP" />
          <ActivityIcon icon={HistoryIcon} active={sidebarTab === 'history' && !sidebarPanel.collapsed} onClick={() => {
            if (sidebarTab === 'history' && !sidebarPanel.collapsed) sidebarPanel.toggleCollapse()
            else { setSidebarTab('history'); sidebarPanel.setCollapsed(false) }
          }} label="历史" />
          <ActivityIcon icon={Globe} active={showPreview} onClick={() => setShowPreview(!showPreview)} label="预览" />
        </aside>

        {/* 侧边栏内容：宽度可拖拽 + 可折叠 */}
        {!sidebarPanel.collapsed ? (
          <>
            <aside
              className="flex-shrink-0 bg-bg-card/60 border border-border-subtle rounded-lg overflow-hidden flex flex-col"
              style={{ width: sidebarPanel.size }}
            >
              <div className="flex-shrink-0 px-3 py-1.5 border-b border-border-subtle bg-bg-deep/50 text-[10px] text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                <span>
                  {sidebarTab === 'files' && '文件资源管理器'}
                  {sidebarTab === 'search' && '搜索'}
                  {sidebarTab === 'git' && '源代码管理'}
                  {sidebarTab === 'problems' && '问题'}
                  {sidebarTab === 'skills' && '技能库'}
                  {sidebarTab === 'mcp' && 'MCP 工具'}
                  {sidebarTab === 'history' && '会话历史'}
                </span>
                <button
                  onClick={() => sidebarPanel.toggleCollapse()}
                  className="p-0.5 text-zinc-500 hover:text-zinc-300"
                  title="折叠侧边栏"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                {sidebarTab === 'files' && (
                  <div className="h-full flex flex-col">
                    <div className="flex-1 overflow-y-auto">
                      <FileTree nodes={fileTree} activeFileId={activeFile?.path ?? null} onSelectFile={handleSelectFile} />
                    </div>
                    <div className="flex-shrink-0 border-t border-border-subtle p-2">
                      <ContextPanel selectedCodeLines={selectedLineCount} messageCount={0} />
                    </div>
                  </div>
                )}
                {sidebarTab === 'search' && <SearchPanel onResultClick={handleSearchResultClick} />}
                {sidebarTab === 'git' && <SourceControlPanel onFileClick={handleGitFileClick} />}
                {sidebarTab === 'problems' && <ProblemsPanel />}
                {sidebarTab === 'skills' && <SkillBrowser onActivateSkill={(skill) => {
                  setActiveSkills(prev => prev.includes(skill.id) ? prev : [...prev, skill.id])
                }} />}
                {sidebarTab === 'mcp' && <MCPPanel />}
                {sidebarTab === 'history' && <SessionHistory onRestore={handleRestoreSession} />}
              </div>
            </aside>
            <ResizeHandle {...sidebarPanel.handleProps} />
          </>
        ) : (
          <button
            onClick={() => sidebarPanel.setCollapsed(false)}
            className="flex-shrink-0 w-6 flex items-center justify-center bg-bg-card/40 border border-border-subtle rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-bg-hover"
            title="展开侧边栏"
          >
            <PanelLeftOpen className="w-3.5 h-3.5" />
          </button>
        )}

        {/* 中栏：编辑器 + 底部面板（flex-1 自适应剩余空间） */}
        <main className="flex-1 min-w-0 bg-bg-card/60 border border-border-subtle rounded-lg overflow-hidden flex flex-col">
          {diffView ? (
            <DiffView diff={diffView} onClose={() => setDiffView(null)} />
          ) : showPreview ? (
            <PreviewPanel onClose={() => setShowPreview(false)} />
          ) : (
            <>
              {/* 文件标签页 */}
              <FileTabs
                tabs={openTabs.map(t => ({ ...t, dirty: dirtyFiles.has(t.path) }))}
                activePath={activeFile?.path ?? null}
                onTabClick={(p) => {
                  const tab = openTabs.find(t => t.path === p)
                  if (tab) openFile(tab.path, tab.name, tab.language)
                }}
                onTabClose={handleTabClose}
              />
              {/* 编辑器（永远 flex-1 自适应） */}
              <div className="flex-1 min-h-0">
                {activeFile ? (
                  <CodeEditor
                    ref={editorHandleRef}
                    value={editorContent}
                    language={activeFile.language}
                    onChange={handleEditorChange}
                    onSelectionChange={(text, range) => {
                      setSelectedCode(text)
                      setSelectedLineRange(range ? { start: range.startLine, end: range.endLine } : undefined)
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                    {hasWorkspace ? '选择文件或 Ctrl+P 搜索' : '点击顶部"打开工作区"开始'}
                  </div>
                )}
              </div>

              {/* 底部面板与编辑器之间的可拖拽分隔条 */}
              {!bottomPanel.collapsed && <ResizeHandle {...bottomPanel.handleProps} />}

              {/* 底部面板：高度可拖拽 + 可折叠 */}
              {!bottomPanel.collapsed ? (
                <div className="flex-shrink-0 border-t border-border-subtle" style={{ height: bottomPanel.size }}>
                  <div className="flex items-center gap-1 px-2 py-1 border-b border-border-subtle bg-bg-deep/50">
                    <BottomTabBtn active={bottomTab === 'todo'} onClick={() => setBottomTab('todo')}>Agent 执行</BottomTabBtn>
                    <BottomTabBtn active={bottomTab === 'terminal'} onClick={() => setBottomTab('terminal')}>终端</BottomTabBtn>
                    <BottomTabBtn active={bottomTab === 'problems'} onClick={() => setBottomTab('problems')}>
                      问题 ({diagStats.errors + diagStats.warnings})
                    </BottomTabBtn>
                    <button onClick={() => bottomPanel.setCollapsed(true)} className="ml-auto p-0.5 text-zinc-500 hover:text-zinc-300" title="折叠底部面板">
                      <PanelBottomClose className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="h-[calc(100%-1.75rem)]">
                    {bottomTab === 'todo' && (
                      <TodoPanel
                        steps={agentSteps}
                        running={agentRunning}
                        onClear={handleClearSteps}
                      />
                    )}
                    {bottomTab === 'terminal' && <TerminalPanel workspacePath={workspace?.path ?? null} />}
                    {bottomTab === 'problems' && <ProblemsPanel />}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => bottomPanel.setCollapsed(false)}
                  className="flex-shrink-0 flex items-center justify-center gap-1 py-1 border-t border-border-subtle bg-bg-deep/50 text-[10px] text-zinc-500 hover:text-zinc-300"
                  title="展开底部面板"
                >
                  <PanelBottomOpen className="w-3 h-3" /> 展开底部面板
                </button>
              )}
            </>
          )}
        </main>

        {/* 右面板与编辑器之间的可拖拽分隔条 */}
        {!rightPanel.collapsed && <ResizeHandle {...rightPanel.handleProps} />}

        {/* 右面板：AI 对话 + 审查看板，宽度可拖拽 + 可折叠 */}
        {!rightPanel.collapsed ? (
          <aside
            className="flex-shrink-0 bg-bg-card/60 border border-border-subtle rounded-lg overflow-hidden flex flex-col"
            style={{ width: rightPanel.size }}
          >
            {/* AI 对话区（flex-1 自适应） */}
            <div className="flex-1 min-h-0 border-b border-border-subtle">
              <AIChatPanel
                sessionId={currentSessionId}
                onNewChat={handleNewChat}
                onSessionCreated={handleSessionCreated}
                selectedCode={selectedCode}
                activeFileName={activeFile?.name ?? null}
                activeFileLanguage={activeFile?.language ?? null}
                selectedLineRange={selectedLineRange}
                isPro={isPro}
                workspacePath={workspace?.path}
                workspaceName={workspace?.name}
                projectType={workspace?.projectType}
                activeSkills={activeSkills}
                onReviewComplete={handleReviewComplete}
                onMessageCountChange={setMessageCount}
                onToolCall={handleToolCall}
                onSendStart={handleSendStart}
                onSendEnd={handleSendEnd}
              />
            </div>
            {/* 右面板内部：审查看板分隔条 */}
            {!reviewPanel.collapsed && <ResizeHandle {...reviewPanel.handleProps} />}
            {/* 审查看板：高度可拖拽 + 可折叠 */}
            {!reviewPanel.collapsed ? (
              <div className="flex-shrink-0" style={{ height: reviewPanel.size }}>
                <ReviewBoard
                  session={reviewSession}
                  decisionLockPassed={decisionLockPassed}
                  decisionLockReason={decisionLockReason}
                  onJumpToIssue={handleJumpToIssue}
                />
              </div>
            ) : (
              <button
                onClick={() => reviewPanel.setCollapsed(false)}
                className="flex-shrink-0 py-1 border-t border-border-subtle bg-bg-deep/50 text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center justify-center gap-1"
                title="展开审查看板"
              >
                <PanelBottomOpen className="w-3 h-3" /> 审查看板
              </button>
            )}
            {/* 折叠右面板按钮 */}
            <button
              onClick={() => rightPanel.setCollapsed(true)}
              className="flex-shrink-0 py-1 border-t border-border-subtle bg-bg-deep/50 text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center justify-center gap-1"
              title="折叠右面板"
            >
              <PanelRightClose className="w-3 h-3" /> 折叠面板
            </button>
          </aside>
        ) : (
          <button
            onClick={() => rightPanel.setCollapsed(false)}
            className="flex-shrink-0 w-6 flex items-center justify-center bg-bg-card/40 border border-border-subtle rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-bg-hover"
            title="展开 AI 对话面板"
          >
            <PanelRightOpen className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 命令面板 */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        fileTree={fileTree}
        onFileOpen={handleSelectFile}
        commands={[
          { id: 'save', label: '保存文件', icon: <FolderOpen className="w-3.5 h-3.5" />, action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true })) },
          { id: 'toggle-terminal', label: '切换终端', icon: <Search className="w-3.5 h-3.5" />, action: () => { bottomPanel.setCollapsed(false); setBottomTab('terminal') } },
          { id: 'toggle-git', label: '打开源代码管理', icon: <GitBranch className="w-3.5 h-3.5" />, action: () => setSidebarTab('git') },
          { id: 'toggle-search', label: '搜索文件内容', icon: <Search className="w-3.5 h-3.5" />, action: () => setSidebarTab('search') },
        ]}
      />
    </div>
  )
}

// === 子组件 ===

function ActivityIcon({ icon: Icon, active, onClick, label, badge, badgeColor }: {
  icon: typeof Files
  active: boolean
  onClick: () => void
  label: string
  badge?: number
  badgeColor?: 'red' | 'orange'
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`relative p-2 rounded-lg transition-colors ${
        active ? 'text-accent-emerald bg-accent-emerald/10' : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      <Icon className="w-4 h-4" />
      {badge != null && badge > 0 && (
        <span className={`absolute -top-0.5 -right-0.5 text-[8px] px-1 rounded-full ${
          badgeColor === 'red' ? 'bg-red-500 text-white' : badgeColor === 'orange' ? 'bg-orange-500 text-white' : 'bg-accent-emerald text-white'
        }`}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

function BottomTabBtn({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button onClick={onClick} className={`px-2 py-0.5 text-[10px] rounded ${active ? 'bg-bg-hover text-accent-emerald' : 'text-zinc-500'}`}>
      {children}
    </button>
  )
}

function ProblemsPanel() {
  const [diags, setDiags] = useState<Map<string, Diagnostic[]>>(new Map())

  useEffect(() => {
    const dm = getDiagnosticManager()
    const unsub = dm.subscribe(d => setDiags(d))
    setDiags(dm.getAllDiagnostics())
    return unsub
  }, [])

  const allDiags = Array.from(diags.entries()).flatMap(([file, list]) => list.map(d => ({ ...d, file })))

  return (
    <div className="h-full overflow-y-auto p-2">
      {allDiags.length === 0 ? (
        <div className="text-center py-4 text-[11px] text-zinc-600">无诊断问题</div>
      ) : (
        allDiags.map((d, i) => (
          <div key={i} className="flex items-start gap-2 px-2 py-1 hover:bg-bg-hover rounded">
            <span className={`text-[10px] font-bold flex-shrink-0 ${
              d.severity === 'error' ? 'text-red-400' : d.severity === 'warning' ? 'text-orange-400' : 'text-blue-400'
            }`}>
              {d.severity === 'error' ? '✕' : d.severity === 'warning' ? '▲' : 'ℹ'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-zinc-300 truncate">{d.message}</div>
              <div className="text-[9px] text-zinc-600">{d.file}:{d.line}</div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
