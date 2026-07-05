/**
 * Git 操作封装（基于 isomorphic-git）
 *
 * 纯 JS 实现，Web 端和桌面端共享。
 * Web 端通过 File System Access API 的 handle 提供 fs。
 * 桌面端通过 Node fs（Phase 4）。
 */

import git from 'isomorphic-git'
import type { FSProvider } from '../fs/fsInterface'

// ============ 类型 ============

export type GitFileStatus =
  | 'unmodified'    // 未修改
  | 'modified'      // 已修改
  | 'added'         // 新增（已暂存）
  | 'deleted'       // 已删除
  | 'untracked'     // 未跟踪
  | 'renamed'       // 重命名

export interface GitFileChange {
  path: string
  status: GitFileStatus
  staged: boolean
}

export interface GitStatus {
  branch: string
  changes: GitFileChange[]
  aheadCount: number
  behindCount: number
}

export interface GitLogEntry {
  oid: string
  message: string
  author: { name: string; email: string; timestamp: number }
  parents: string[]
}

export interface DiffResult {
  oldContent: string
  newContent: string
  oldPath: string
  newPath: string
}

// ============ 轻量 fs 适配（isomorphic-git 需要） ============

/** 将 FSProvider 包装为 isomorphic-git 需要的 fs 格式 */
async function createGitFs(fsProvider: FSProvider) {
  const promiseFs = {
    promises: {
      readFile: async (filepath: string, _opts?: any) => {
        const content = await fsProvider.readFile(filepath)
        return new TextEncoder().encode(content)
      },
      writeFile: async (filepath: string, data: Uint8Array) => {
        await fsProvider.writeFile(filepath, new TextDecoder().decode(data))
      },
      mkdir: async (filepath: string) => {
        await fsProvider.createDir(filepath).catch(() => {})
      },
      rmdir: async (filepath: string) => {
        await fsProvider.deleteFile(filepath).catch(() => {})
      },
      unlink: async (filepath: string) => {
        await fsProvider.deleteFile(filepath).catch(() => {})
      },
      stat: async (filepath: string) => {
        const exists = await fsProvider.exists(filepath)
        if (!exists) throw new Error(`ENOENT: ${filepath}`)
        return { isDirectory: () => false, mtime: new Date(), size: 0 }
      },
      readdir: async (filepath: string) => {
        const entries = await fsProvider.readDir(filepath)
        return entries.map(e => e.name)
      },
    },
  }
  return promiseFs
}

// ============ Git 操作 ============

/** 获取 Git 状态 */
export async function getGitStatus(fsProvider: FSProvider): Promise<GitStatus | null> {
  try {
    const gitFs = await createGitFs(fsProvider)

    const branchInfo = await git.currentBranch({ fs: gitFs as any, dir: '.', fullname: false }).catch(() => null)
    if (!branchInfo) return null

    // statusMatrix 返回 [filepath, HEAD, WORKDIR, STAGE]
    const matrix = await git.statusMatrix({
      fs: gitFs as any,
      dir: '.',
      filter: (f: string) => !f.startsWith('node_modules/') && !f.startsWith('.git/'),
    })

    const changes: GitFileChange[] = matrix
      .filter(([, head, workdir, stage]) => !(head === 1 && workdir === 1 && stage === 1))
      .map(([filepath, head, workdir, stage]) => {
        let status: GitFileStatus
        let staged = false

        if (head === 0 && workdir === 2) {
          status = 'added'
          staged = stage === 2 || stage === 3
        } else if (head === 1 && workdir === 0) {
          status = 'deleted'
          staged = stage === 0
        } else if (head === 1 && workdir === 2) {
          status = 'modified'
          staged = stage === 2 || stage === 3
        } else if (head === 0 && workdir === 2 && stage === 0) {
          status = 'untracked'
        } else {
          status = 'modified'
          staged = stage === 2 || stage === 3
        }

        return { path: filepath as string, status, staged }
      })

    return {
      branch: branchInfo,
      changes,
      aheadCount: 0,
      behindCount: 0,
    }
  } catch (e) {
    console.warn('[git] 获取状态失败', e)
    return null
  }
}

/** 暂存文件 */
export async function stageFile(fsProvider: FSProvider, filepath: string): Promise<void> {
  const gitFs = await createGitFs(fsProvider)
  await git.add({ fs: gitFs as any, dir: '.', filepath })
}

/** 取消暂存 */
export async function unstageFile(fsProvider: FSProvider, filepath: string): Promise<void> {
  const gitFs = await createGitFs(fsProvider)
  await git.remove({ fs: gitFs as any, dir: '.', filepath })
}

/** 提交 */
export async function commit(
  fsProvider: FSProvider,
  message: string,
  author?: { name: string; email: string },
): Promise<string> {
  const gitFs = await createGitFs(fsProvider)
  const oid = await git.commit({
    fs: gitFs as any,
    dir: '.',
    message,
    author: author ?? { name: 'MetaGO Agent', email: 'agent@metago.ai' },
  })
  return oid
}

/** 获取提交历史 */
export async function getLog(fsProvider: FSProvider, depth = 20): Promise<GitLogEntry[]> {
  try {
    const gitFs = await createGitFs(fsProvider)
    const logs = await git.log({ fs: gitFs as any, dir: '.', depth })
    return logs.map(({ oid, commit }) => ({
      oid,
      message: commit.message,
      author: {
        name: commit.author.name,
        email: commit.author.email,
        timestamp: commit.author.timestamp,
      },
      parents: commit.parent,
    }))
  } catch {
    return []
  }
}

/** 生成 AI 提交消息 */
export async function generateCommitMessage(
  _fsProvider: FSProvider,
  changes: GitFileChange[],
  generateText: (prompt: string) => Promise<string>,
): Promise<string> {
  void _fsProvider
  const changeSummary = changes
    .map(c => `${c.status}: ${c.path}`)
    .join('\n')
  const prompt = `基于以下 Git 变更，生成一条简洁的提交消息（不超过 50 字，中文）：

${changeSummary}

格式要求：type: 简述（type 可选 feat/fix/docs/refactor/test/chore）`
  return generateText(prompt)
}

/** 获取文件 diff（对比工作区和 HEAD） */
export async function getFileDiff(
  fsProvider: FSProvider,
  filepath: string,
): Promise<DiffResult | null> {
  try {
    const gitFs = await createGitFs(fsProvider)

    // HEAD 版本
    const headCommit = await git.resolveRef({ fs: gitFs as any, dir: '.', ref: 'HEAD' }).catch(() => null)
    let oldContent = ''
    if (headCommit) {
      const blob = await git.readBlob({
        fs: gitFs as any,
        dir: '.',
        oid: headCommit,
        filepath,
      }).catch(() => null)
      if (blob) {
        oldContent = new TextDecoder().decode(blob.blob)
      }
    }

    // 工作区版本
    const newContent = await fsProvider.readFile(filepath).catch(() => '')

    return {
      oldContent,
      newContent,
      oldPath: filepath,
      newPath: filepath,
    }
  } catch {
    return null
  }
}
