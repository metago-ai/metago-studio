/**
 * 前端支付服务
 *
 * 封装 payment 云函数的所有调用，提供类型安全的接口。
 * 与 cloudfunctions/payment/index.js 的 action 完全对齐。
 *
 * 支持的支付方式：
 *   - wechat：微信 Native 支付（返回 codeUrl 二维码链接）
 *   - alipay：支付宝网页支付（返回 payUrl 跳转链接）
 *
 * 开发测试：支付密钥未配置时，云函数返回 mock 数据（mock: true），
 *           前端可调用 mockPaySuccess 模拟支付完成。
 */

import { callFunction } from './cloudFunctions'

/** 订阅计划 ID（与云函数 PLANS 定义对齐） */
export type PlanId = 'pro' | 'pro_year' | 'pro_plus' | 'pro_plus_year' | 'team' | 'team_year' | 'enterprise'

/** 支付方式 */
export type PaymentMethod = 'wechat' | 'alipay'

/** 订单状态 */
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'expired'

/** 创建订单返回的数据 */
export interface PaymentOrder {
  orderId: string
  amount: number  // 单位：分
  planName: string
  planId: PlanId
}

/** 调用支付接口返回的数据 */
export interface PaymentResult {
  codeUrl?: string  // 微信二维码链接
  payUrl?: string   // 支付宝支付链接
  orderId?: string
  amount?: number
  mock?: boolean    // mock=true 表示开发环境模拟数据
  message?: string
}

/** 订单状态查询返回 */
export interface OrderStatusInfo {
  status: OrderStatus
  orderId: string
  amount: number
  planId: PlanId
}

/**
 * 创建订单
 * @param planId 订阅计划 ID
 * @param paymentMethod 支付方式
 * @param userId 可选，留空时云函数从 _clientUid 自动识别
 */
export async function createOrder(
  planId: PlanId,
  paymentMethod: PaymentMethod,
  userId?: string,
): Promise<PaymentOrder> {
  const res = await callFunction<PaymentOrder>('payment', {
    action: 'createOrder',
    planId,
    paymentMethod,
    ...(userId ? { userId } : {}),
  })
  if (res.code !== 0 || !res.data) throw new Error(res.message || '创建订单失败')
  return res.data
}

/**
 * 获取微信支付二维码（Native 扫码）
 */
export async function getWechatQrCode(orderId: string): Promise<PaymentResult> {
  const res = await callFunction<PaymentResult>('payment', { action: 'wechatNativePay', orderId })
  if (res.code !== 0 || !res.data) throw new Error(res.message || '获取微信支付二维码失败')
  return res.data
}

/**
 * 获取支付宝支付链接
 */
export async function getAlipayUrl(orderId: string): Promise<PaymentResult> {
  const res = await callFunction<PaymentResult>('payment', { action: 'alipayPagePay', orderId })
  if (res.code !== 0 || !res.data) throw new Error(res.message || '获取支付宝支付链接失败')
  return res.data
}

/**
 * 查询订单状态（轻量，用于轮询）
 */
export async function getOrderStatus(orderId: string): Promise<OrderStatusInfo> {
  const res = await callFunction<OrderStatusInfo>('payment', { action: 'getOrderStatus', orderId })
  if (res.code !== 0 || !res.data) throw new Error(res.message || '查询订单状态失败')
  return res.data
}

/**
 * 模拟支付成功（开发测试用，云函数必须未配置真实支付密钥）
 */
export async function mockPaySuccess(orderId: string): Promise<void> {
  const res = await callFunction<{ message: string }>('payment', { action: 'mockPaySuccess', orderId })
  if (res.code !== 0) throw new Error(res.message || '模拟支付失败')
}

/**
 * 轮询订单状态
 *
 * @param orderId 订单号
 * @param onPaid 支付成功回调
 * @param onStatusChange 状态变化回调（可选）
 * @param timeout 超时时间（毫秒），默认 5 分钟
 * @param interval 轮询间隔（毫秒），默认 3 秒
 * @returns 取消函数，调用后停止轮询
 */
export function pollOrderStatus(
  orderId: string,
  onPaid: () => void,
  options?: {
    timeout?: number
    interval?: number
    onStatusChange?: (status: OrderStatus) => void
  },
): () => void {
  const timeout = options?.timeout ?? 300000
  const interval = options?.interval ?? 3000
  const start = Date.now()
  let cancelled = false

  const poll = async () => {
    if (cancelled) return
    if (Date.now() - start > timeout) return

    try {
      const { status } = await getOrderStatus(orderId)
      options?.onStatusChange?.(status)
      if (status === 'paid') {
        onPaid()
        return
      }
    } catch {
      // 忽略单次查询失败，继续轮询
    }

    setTimeout(poll, interval)
  }

  poll()

  return () => { cancelled = true }
}
