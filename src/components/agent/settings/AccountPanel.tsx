import { useStore } from '../../../store/useStore'
import { clearLicense } from '../../../lib/proGate'
import { Section, PrimaryButton, GhostButton, DangerButton } from './_shared'

/** 账号面板 */
export function AccountPanel() {
  const license = useStore(s => s.license)
  const tier = useStore(s => s.tier)

  const handleLogout = () => {
    clearLicense()
    try { localStorage.removeItem('metago_user_id') } catch { /* */ }
    try { localStorage.removeItem('metago_auth_token') } catch { /* */ }
    window.location.href = '/'
  }

  return (
    <div>
      <Section title="账户信息" description="当前登录的账号信息">
        {license ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-bg-deep/50 rounded-lg border border-border-subtle">
              <div className="w-10 h-10 rounded-full bg-accent-emerald/20 flex items-center justify-center text-accent-emerald text-sm font-bold">
                {(license.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-zinc-200 truncate">{license.email || '已登录用户'}</div>
                <div className="text-[10px] text-zinc-500 truncate">授权码：{license.licenseKey?.slice(0, 12)}...</div>
              </div>
              <span className="px-2 py-0.5 text-[10px] rounded bg-accent-emerald/15 text-accent-emerald">{tier?.toUpperCase()}</span>
            </div>
            <div className="flex gap-2">
              <PrimaryButton onClick={() => window.location.href = '/profile'}>管理账号</PrimaryButton>
              <GhostButton onClick={() => {
                const data = { license, settings: localStorage.getItem('metago_settings_general') }
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'metago-user-data.json'
                a.click()
                URL.revokeObjectURL(url)
              }}>导出用户数据</GhostButton>
            </div>
          </div>
        ) : (
          <div className="text-xs text-zinc-500 py-4 text-center border border-dashed border-border-subtle rounded-lg">
            未登录，部分功能受限
          </div>
        )}
      </Section>

      <Section title="退出登录">
        <DangerButton onClick={handleLogout}>退出当前账号</DangerButton>
      </Section>
    </div>
  )
}
