import type {
  AbilityRequest,
  AbilityResponse,
  AuthSession,
  BookEntryDto,
  BookRandomResult,
  CaptchaInfo,
  LoginRequest,
} from '@shared/types'
import { clearAuthTokens, getAuthToken, getRefreshToken, setAuthTokens } from './config'
import { getRuntimeConfig } from './runtime-config'

export class ApiError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}

export interface AiEraseResult {
  imageBase64: string
  requestId?: string | undefined
  traceId?: string | undefined
}

interface ApiEnvelope<T> {
  code: number
  message: string
  data?: T
}
interface TokenPair {
  token: string
  expiresIn: number
  refreshToken: string
  refreshExpiresIn: number
}
interface BookPageDto {
  items: BookEntryDto[]
  total: number
  page: number
  size: number
}

const tokenClearedListeners = new Set<(reason: string) => void>()
export function onTokenCleared(listener: (reason: string) => void): () => void {
  tokenClearedListeners.add(listener)
  return () => {
    tokenClearedListeners.delete(listener)
  }
}
function notifyTokenCleared(reason: string): void {
  clearAuthTokens()
  tokenClearedListeners.forEach((listener) => listener(reason))
}

let refreshPromise: Promise<boolean> | null = null
function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  const refreshToken = getRefreshToken()
  if (!refreshToken) return Promise.resolve(false)
  refreshPromise = (async () => {
    try {
      const data = await request<TokenPair>('/api/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
      })
      setAuthTokens(data.token, data.refreshToken)
      return true
    } catch {
      notifyTokenCleared('登录已过期，请重新登录。')
      return false
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

function baseUrl(): string {
  const url = getRuntimeConfig().serverUrl
  if (!url)
    throw new ApiError(4000, '未配置服务器地址，请在 yycuotiku.config.json 中设置 serverUrl。')
  if (!/^https?:\/\//i.test(url))
    throw new ApiError(4000, '服务器地址需以 http:// 或 https:// 开头（yycuotiku.config.json）。')
  return url.replace(/\/+$/, '')
}

async function request<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
    auth?: boolean
    retried?: boolean
    timeoutMs?: number
  } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' }
  if (options.auth) {
    const token = getAuthToken()
    if (!token) throw new ApiError(4010, '请先登录后再使用该功能。')
    headers.Authorization = `Bearer ${token}`
  }
  let response: Response
  try {
    const init: RequestInit = {
      method: options.method ?? 'GET',
      headers,
      signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
    }
    if (options.body !== undefined) init.body = JSON.stringify(options.body)
    response = await fetch(baseUrl() + path, init)
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError')
      throw new ApiError(5040, '连接服务器超时，请稍后重试。')
    throw new ApiError(5000, '无法连接服务器，请检查网络或服务器地址设置。')
  }
  let envelope: ApiEnvelope<T>
  try {
    envelope = (await response.json()) as ApiEnvelope<T>
  } catch {
    throw new ApiError(response.status, `服务器返回异常（HTTP ${response.status}）。`)
  }
  if (envelope.code === 4011) {
    notifyTokenCleared(envelope.message)
    throw new ApiError(envelope.code, envelope.message)
  }
  if (envelope.code === 401 && options.auth) {
    if (!options.retried && (await tryRefresh())) {
      return request<T>(path, { ...options, retried: true })
    }
    notifyTokenCleared(envelope.message)
    throw new ApiError(envelope.code, envelope.message)
  }
  if (envelope.code !== 0) throw new ApiError(envelope.code, envelope.message)
  return envelope.data as T
}

export function getCaptcha(): Promise<CaptchaInfo> {
  return request<CaptchaInfo>('/api/auth/captcha')
}

export async function login(requestBody: LoginRequest): Promise<AuthSession> {
  const data = await request<TokenPair & { user: AuthUserDto }>('/api/auth/login', {
    method: 'POST',
    body: { ...requestBody, clientLabel: requestBody.clientLabel ?? '拾星错题本桌面端' },
  })
  setAuthTokens(data.token, data.refreshToken)
  return toSession(data.user)
}

export async function logout(): Promise<void> {
  try {
    await request<null>('/api/auth/logout', { method: 'POST', auth: true })
  } finally {
    notifyTokenCleared('已退出登录。')
  }
}

export async function me(): Promise<AuthSession | null> {
  if (!getAuthToken() && !(await tryRefresh())) return null
  const data = await request<AuthSessionDto>('/api/auth/me', { auth: true })
  return {
    phone: data.phone,
    memberNo: data.memberNo,
    role: data.role,
    aiEnabled: data.aiEnabled,
    tokenExpiresAt: data.tokenExpiresAt,
  }
}

export async function aiErase(imageBase64: string): Promise<AiEraseResult> {
  const data = await request<{ imageBase64: string; requestId?: string; traceId?: string }>(
    '/api/ai/erase',
    {
      method: 'POST',
      body: { imageBase64 },
      auth: true,
      timeoutMs: 120_000,
    },
  )
  if (!data?.imageBase64) throw new ApiError(500, '接口成功返回，但没有擦除后的图片。')
  return { imageBase64: data.imageBase64, requestId: data.requestId, traceId: data.traceId }
}

export interface CropEnhanceResult {
  imageBase64: string | null
  width: number | null
  height: number | null
  position: number[] | null
  angle: number | null
  requestId?: string | undefined
  traceId?: string | undefined
}

export function cropEnhance(body: {
  imageBase64: string
  enhanceType?: number
  adjustOrientation?: boolean
}): Promise<CropEnhanceResult> {
  return request<CropEnhanceResult>('/api/ai/crop-enhance', {
    method: 'POST',
    body,
    auth: true,
    timeoutMs: 120_000,
  })
}

export function getAbility(params: AbilityRequest): Promise<AbilityResponse> {
  const query = new URLSearchParams()
  if (params.grade !== undefined) query.set('grade', String(params.grade))
  if (params.term !== undefined) query.set('term', String(params.term))
  if (params.subject) query.set('subject', params.subject)
  if (params.start) query.set('start', params.start)
  if (params.end) query.set('end', params.end)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return request<AbilityResponse>(`/api/user/ability${suffix}`, { auth: true })
}

export function bookAddEntry(body: {
  grade: number
  term: number
  subject: BookEntryDto['subject']
  errorType: BookEntryDto['errorType']
  imageBase64: string
}): Promise<BookEntryDto> {
  return request<BookEntryDto>('/api/book/entries', {
    method: 'POST',
    body,
    auth: true,
    timeoutMs: 60_000,
  })
}

export function bookList(page: number, size: number): Promise<BookPageDto> {
  return request<BookPageDto>(`/api/book/entries?page=${page}&size=${size}`, {
    auth: true,
    timeoutMs: 30_000,
  })
}

export function bookRandom(body: {
  grade?: number | null
  term?: number | null
  subject?: string | null
  counts: Record<string, number>
}): Promise<BookRandomResult> {
  return request<BookRandomResult>('/api/book/entries/random', {
    method: 'POST',
    body,
    auth: true,
    timeoutMs: 30_000,
  })
}

export async function bookEntryImage(id: string, kind: 'original' | 'thumb'): Promise<Buffer> {
  return requestBinary(`/api/book/entries/${encodeURIComponent(id)}/image?kind=${kind}`, {
    auth: true,
    timeoutMs: 60_000,
  })
}

export function bookImagesBatch(
  ids: string[],
  kind: 'original' | 'thumb',
): Promise<Array<{ id: string; contentType: string; imageBase64: string }>> {
  return request<Array<{ id: string; contentType: string; imageBase64: string }>>(
    '/api/book/entries/images',
    { method: 'POST', body: { ids, kind }, auth: true, timeoutMs: 120_000 },
  )
}

export function bookPractice(ids: string[]): Promise<{ updated: number }> {
  return request<{ updated: number }>('/api/book/entries/practice', {
    method: 'POST',
    body: { ids },
    auth: true,
  })
}

export async function bookDelete(id: string): Promise<void> {
  try {
    await request<null>(`/api/book/entries/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      auth: true,
    })
  } catch (error) {
    if (error instanceof ApiError && error.code === 404) return
    throw error
  }
}

async function requestBinary(
  path: string,
  options: { auth?: boolean; retried?: boolean; timeoutMs?: number } = {},
): Promise<Buffer> {
  const headers: Record<string, string> = {}
  if (options.auth) {
    const token = getAuthToken()
    if (!token) throw new ApiError(4010, '请先登录后再使用该功能。')
    headers.Authorization = `Bearer ${token}`
  }
  let response: Response
  try {
    response = await fetch(baseUrl() + path, {
      headers,
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError')
      throw new ApiError(5040, '连接服务器超时，请稍后重试。')
    throw new ApiError(5000, '无法连接服务器，请检查网络或服务器地址设置。')
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const envelope = (await response.json()) as ApiEnvelope<null>
    if (envelope.code === 4011) {
      notifyTokenCleared(envelope.message)
      throw new ApiError(envelope.code, envelope.message)
    }
    if (envelope.code === 401 && options.auth && !options.retried && (await tryRefresh())) {
      return requestBinary(path, { ...options, retried: true })
    }
    if (envelope.code === 401 && options.auth) notifyTokenCleared(envelope.message)
    throw new ApiError(envelope.code, envelope.message)
  }
  if (!response.ok)
    throw new ApiError(response.status, `服务器返回异常（HTTP ${response.status}）。`)
  return Buffer.from(await response.arrayBuffer())
}

interface AuthUserDto {
  id: number
  phone: string
  memberNo: string | null
  role: 'USER' | 'ADMIN'
  aiEnabled: boolean
  enabled: boolean
  clientLabel: string | null
  lastLoginAt: string | null
  createdAt: string | null
}
interface AuthSessionDto {
  phone: string
  memberNo: string | null
  role: 'USER' | 'ADMIN'
  aiEnabled: boolean
  tokenExpiresAt: string | null
}
function toSession(user: AuthUserDto): AuthSession {
  return {
    phone: user.phone,
    memberNo: user.memberNo,
    role: user.role,
    aiEnabled: user.aiEnabled,
    tokenExpiresAt: null,
  }
}
