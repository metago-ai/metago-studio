/**
 * 元构信用等级体系（5 级）
 *
 * 等级阈值与云函数 behaviorBank/index.js 中的 CREDIT_LEVELS 必须保持一致。
 * 修改此处时请同步修改云函数。
 */
import type { CreditLevel, CreditLevelId } from '../types'

export const CREDIT_LEVELS: CreditLevel[] = [
  {
    id: 'apprentice',
    name: '元构学徒',
    minScore: 0,
    maxScore: 99,
    icon: 'Sprout',
    color: 'text-zinc-400',
    description: '初入元构生态，正在学习决策锁与元进化的基础规范',
    privileges: [
      'Free 档位 10万 tokens/天',
      '使用 39 个元构技能',
      '基础决策锁软校验',
    ],
  },
  {
    id: 'artisan',
    name: '元构匠人',
    minScore: 100,
    maxScore: 299,
    icon: 'Hammer',
    color: 'text-accent-teal',
    description: '已掌握元构方法论基础，能稳定产出合规内容',
    privileges: [
      '元构匠人徽章',
      '决策锁硬校验（问题即阻断）',
      '行为记录云端持久化',
      '优先工单支持',
    ],
  },
  {
    id: 'expert',
    name: '元构专家',
    minScore: 300,
    maxScore: 599,
    icon: 'Award',
    color: 'text-accent-emerald',
    description: '深度践行元构范式，可作为社区意见领袖',
    privileges: [
      '元构专家徽章',
      '元进化五阶段循环可视化',
      '行为价值面板高级视图',
      '社区帖子优先推荐',
      'Pro+ 档位可用',
    ],
  },
  {
    id: 'master',
    name: '元构大师',
    minScore: 600,
    maxScore: 999,
    icon: 'Crown',
    color: 'text-accent-amber',
    description: '元构范式的标杆实践者，受邀参与产品共建',
    privileges: [
      '元构大师徽章',
      '受邀加入元构产品顾问委员会',
      'Enterprise 档位优先体验',
      '专属对接通道',
      '案例故事收录资格',
    ],
  },
  {
    id: 'grandmaster',
    name: '元构宗师',
    minScore: 1000,
    maxScore: Number.MAX_SAFE_INTEGER,
    icon: 'Sparkle',
    color: 'text-accent-rose',
    description: '元构生态的奠基级贡献者，与产品共创历史',
    privileges: [
      '元构宗师徽章',
      '永久免费使用所有付费档位',
      '产品路线图共同决策权',
      '年度 MetaGO Summit 受邀演讲',
      '元构认证委员会席位',
    ],
  },
]

/** 根据 score 获取当前等级 */
export function getLevelByScore(score: number): CreditLevel {
  for (const level of CREDIT_LEVELS) {
    if (score >= level.minScore && score <= level.maxScore) {
      return level
    }
  }
  // 兜底：分数低于 0 也按学徒处理
  return CREDIT_LEVELS[0]
}

/** 根据 id 获取等级 */
export function getLevelById(id: CreditLevelId): CreditLevel {
  return CREDIT_LEVELS.find(l => l.id === id) ?? CREDIT_LEVELS[0]
}

/** 获取下一等级（已是最高则返回 null） */
export function getNextLevel(currentId: CreditLevelId): CreditLevel | null {
  const idx = CREDIT_LEVELS.findIndex(l => l.id === currentId)
  if (idx < 0 || idx === CREDIT_LEVELS.length - 1) return null
  return CREDIT_LEVELS[idx + 1]
}

/** 计算当前等级进度百分比（0-100） */
export function calcProgressPercent(score: number, level: CreditLevel): number {
  if (level.id === 'grandmaster') return 100
  const span = level.maxScore - level.minScore + 1
  const progress = (score - level.minScore) / span
  return Math.max(0, Math.min(100, Math.round(progress * 100)))
}
