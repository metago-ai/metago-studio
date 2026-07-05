/**
 * Git IPC handlers（Electron 主进程）
 *
 * 使用 isomorphic-git + Node fs 提供完整的 Git 操作。
 */

import { ipcMain } from 'electron'
import * as path from 'path'
import { promises as fsp } from 'fs'

// isomorphic-git 懒加载
let _git: any = null

async function ensureGit(): Promise<any> {
  if (_git) return _git
  _git = await import('isomorphic-git')
  return _git
}

// 使用 Node fs 构建 isomorphic-git 需要的 promiseFs
async function getGitFs(rootPath: string) {
  const promiseFs = {
    promises: {
      readFile: async (filepath: string) => {
        const full = filepath.startsWith('.') ? path.join(rootPath, filepath) : filepath
        const buf = await fsp.readFile(full)
        return new Uint8Array(buf)
      },
      writeFile: async (filepath: string, data: Uint8Array) => {
        const full = filepath.startsWith('.') ? path.join(rootPath, filepath) : filepath
        await fsp.writeFile(full, data)
      },
      mkdir: async (filepath: string) => {
        const full = filepath.startsWith('.') ? path.join(rootPath, filepath) : filepath
        await fsp.mkdir(full, { recursive: true })
      },
      rmdir: async (filepath: string) => {
        const full = filepath.startsWith('.') ? path.join(rootPath, filepath) : filepath
        await fsp.rmdir(full)
      },
      unlink: async (filepath: string) => {
        const full = filepath.startsWith('.') ? path.join(rootPath, filepath) : filepath
        await fsp.unlink(full)
      },
      stat: async (filepath: string) => {
        const full = filepath.startsWith('.') ? path.join(rootPath, filepath) : filepath
        return fsp.stat(full)
      },
      readdir: async (filepath: string) => {
        const full = filepath.startsWith('.') ? path.join(rootPath, filepath) : filepath
        return fsp.readdir(full)
      },
    },
  }
  return promiseFs
}

export function registerGitHandlers(): void {
  ipcMain.handle('git:status', async (_event, rootPath: string) => {
    try {
      const git = await ensureGit()
      const fs = await getGitFs(rootPath)

      const branch = await git.currentBranch({ fs, dir: rootPath, fullname: false }).catch(() => null)
      if (!branch) return null

      const matrix = await git.statusMatrix({
        fs,
        dir: rootPath,
        filter: (f: string) => !f.startsWith('node_modules/') && !f.startsWith('.git/'),
      })

      const changes = matrix
        .filter(([, head, workdir, stage]: number[]) => !(head === 1 && workdir === 1 && stage === 1))
        .map(([filepath, head, workdir, stage]: number[]) => {
          let status: string, staged = false
          if (head === 0 && workdir === 2) { status = 'added'; staged = stage >= 2 }
          else if (head === 1 && workdir === 0) { status = 'deleted'; staged = stage === 0 }
          else if (head === 1 && workdir === 2) { status = 'modified'; staged = stage >= 2 }
          else { status = 'modified'; staged = stage >= 2 }
          return { path: filepath, status, staged }
        })

      return { branch, changes, aheadCount: 0, behindCount: 0 }
    } catch (e) {
      return null
    }
  })

  ipcMain.handle('git:stage', async (_event, rootPath: string, filePath: string) => {
    const git = await ensureGit()
    const fs = await getGitFs(rootPath)
    await git.add({ fs, dir: rootPath, filepath: filePath })
  })

  ipcMain.handle('git:unstage', async (_event, rootPath: string, filePath: string) => {
    const git = await ensureGit()
    const fs = await getGitFs(rootPath)
    await git.remove({ fs, dir: rootPath, filepath: filePath })
  })

  ipcMain.handle('git:commit', async (_event, rootPath: string, message: string) => {
    const git = await ensureGit()
    const fs = await getGitFs(rootPath)
    return git.commit({
      fs, dir: rootPath, message,
      author: { name: 'MetaGO Agent', email: 'agent@metago.ai' },
    })
  })

  ipcMain.handle('git:log', async (_event, rootPath: string, depth: number) => {
    try {
      const git = await ensureGit()
      const fs = await getGitFs(rootPath)
      return await git.log({ fs, dir: rootPath, depth })
    } catch { return [] }
  })

  ipcMain.handle('git:diff', async (_event, rootPath: string, filePath: string) => {
    try {
      const git = await ensureGit()
      const fs = await getGitFs(rootPath)

      const headCommit = await git.resolveRef({ fs, dir: rootPath, ref: 'HEAD' }).catch(() => null)
      let oldContent = ''
      if (headCommit) {
        const blob = await git.readBlob({ fs, dir: rootPath, oid: headCommit, filepath: filePath }).catch(() => null)
        if (blob) oldContent = new TextDecoder().decode(blob.blob)
      }

      const fullNewPath = path.join(rootPath, filePath)
      const newContent = await fsp.readFile(fullNewPath, 'utf-8').catch(() => '')

      return { oldContent, newContent, oldPath: filePath, newPath: filePath }
    } catch { return null }
  })
}
