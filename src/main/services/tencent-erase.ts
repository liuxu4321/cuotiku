import { createHash, createHmac, randomInt } from 'node:crypto'
import sharp from 'sharp'
import type { HandwritingEraseRequest, CropResultSet } from '@shared/types'
import { processCrops, getResultSet, storeResultSet, type StoredCrop } from './image-service'

const HOST = 'ocr.tencentcloudapi.com'
const SERVICE = 'ocr'
const API_VERSION = '2018-11-19'
const API_ACTION = 'EraseHandwrittenImageOCR'
const MAX_BASE64_SIZE = 9 * 1024 * 1024
interface Placement {
  left: number
  top: number
  width: number
  height: number
}

export async function eraseHandwriting(request: HandwritingEraseRequest): Promise<CropResultSet> {
  const secretId = normalize(request.secretId)
  const secretKey = normalize(request.secretKey)
  if (!secretId || !secretKey) throw new Error('请先在设置中填写腾讯云 SecretId 和 SecretKey。')
  const rawSet = await processCrops({
    revision: request.revision,
    images: request.images,
    processing: { enhance: false, enhanceStrength: 0 },
  })
  const crops = getResultSet(rawSet.resultSetId)
  if (!crops.length) throw new Error('没有可用于去手写的错题。')
  const { buffer, placements, width, height } = await compose(crops)
  const encoded = await encodeForApi(buffer)
  const image = await callEraseApi(encoded, secretId, secretKey)
  const erasedBuffer = Buffer.from(
    image.includes(',') ? image.slice(image.indexOf(',') + 1) : image,
    'base64',
  )
  const meta = await sharp(erasedBuffer).metadata()
  if (!meta.width || !meta.height) throw new Error('无法解析腾讯云返回的图片。')
  const sx = meta.width / width
  const sy = meta.height / height
  if (Math.abs(sx - sy) > Math.max(sx, sy) * 0.03)
    throw new Error('接口返回图片比例发生变化，无法安全拆分。')
  const results: StoredCrop[] = []
  for (let index = 0; index < placements.length; index += 1) {
    const p = placements[index]
    const source = crops[index]
    if (!p || !source) continue
    const left = Math.max(0, Math.round(p.left * sx))
    const top = Math.max(0, Math.round(p.top * sy))
    const cropWidth = Math.min(meta.width - left, Math.max(1, Math.round(p.width * sx)))
    const cropHeight = Math.min(meta.height - top, Math.max(1, Math.round(p.height * sy)))
    let pipeline = sharp(erasedBuffer)
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .resize(source.width, source.height)
    if (request.processing.enhance)
      pipeline = pipeline.sharpen({
        sigma: 0.35 + (request.processing.enhanceStrength / 100) * 0.85,
      })
    const output = await pipeline.png().toBuffer()
    results.push({ ...source, buffer: output })
  }
  return storeResultSet(request.revision, results, true)
}

async function callEraseApi(imageBase64: string, secretId: string, secretKey: string) {
  const payload = JSON.stringify({ ImageBase64: imageBase64 })
  const timestamp = Math.floor(Date.now() / 1000)
  const nonce = randomInt(1_000_000_000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const credentialScope = `${date}/${SERVICE}/tc3_request`
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${HOST}\n`
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    'content-type;host',
    sha256Hex(payload),
  ].join('\n')
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n')
  const secretDate = hmacSha256(`TC3${secretKey}`, date)
  const secretService = hmacSha256(secretDate, SERVICE)
  const secretSigning = hmacSha256(secretService, 'tc3_request')
  const signature = createHmac('sha256', secretSigning).update(stringToSign).digest('hex')
  const authorization =
    `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, ` +
    `SignedHeaders=content-type;host, Signature=${signature}`
  let response: Response
  try {
    response = await fetch(`https://${HOST}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Host: HOST,
        Authorization: authorization,
        'X-TC-Action': API_ACTION,
        'X-TC-Version': API_VERSION,
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Nonce': String(nonce),
      },
      body: payload,
      signal: AbortSignal.timeout(90_000),
    })
  } catch (error) {
    throw new Error(
      error instanceof Error && error.name === 'TimeoutError'
        ? '连接腾讯云超时，请稍后重试。'
        : '无法连接腾讯云，请检查网络。',
    )
  }
  if (!response.ok) throw new Error(`腾讯云接口 HTTP ${response.status}`)
  const body = (await response.json()) as {
    Response?: { Image?: string; Error?: { Code: string; Message: string } }
  }
  const result = body.Response
  if (result?.Error) throw new Error(tencentError(result.Error.Code, result.Error.Message))
  if (!result?.Image) throw new Error('接口成功返回，但没有擦除后的图片。')
  return result.Image
}

async function compose(
  crops: StoredCrop[],
): Promise<{ buffer: Buffer; placements: Placement[]; width: number; height: number }> {
  const gap = 32
  const maxWidth = Math.max(...crops.map((crop) => crop.width))
  const area = crops.reduce((sum, crop) => sum + (crop.width + gap) * (crop.height + gap), 0)
  const targetWidth = Math.max(maxWidth + gap * 2, Math.floor(Math.sqrt(area * 1.35)))
  const placements: Placement[] = []
  let x = gap
  let y = gap
  let rowHeight = 0
  let usedWidth = 1
  for (const crop of crops) {
    if (x > gap && x + crop.width + gap > targetWidth) {
      x = gap
      y += rowHeight + gap
      rowHeight = 0
    }
    placements.push({ left: x, top: y, width: crop.width, height: crop.height })
    x += crop.width + gap
    rowHeight = Math.max(rowHeight, crop.height)
    usedWidth = Math.max(usedWidth, x)
  }
  const height = Math.max(1, y + rowHeight + gap)
  const buffer = await sharp({
    create: { width: usedWidth, height, channels: 3, background: '#ffffff' },
  })
    .composite(
      crops.map((crop, i) => ({
        input: crop.buffer,
        left: placements[i]?.left ?? 0,
        top: placements[i]?.top ?? 0,
      })),
    )
    .jpeg({ quality: 92 })
    .toBuffer()
  return { buffer, placements, width: usedWidth, height }
}

async function encodeForApi(input: Buffer): Promise<string> {
  let work = sharp(input)
  let scale = 1
  for (let pass = 0; pass < 6; pass += 1) {
    for (const quality of [92, 85, 75, 65]) {
      const buffer = await work.jpeg({ quality }).toBuffer()
      const encoded = buffer.toString('base64')
      if (encoded.length <= MAX_BASE64_SIZE) return encoded
    }
    scale *= 0.72
    const meta = await sharp(input).metadata()
    work = sharp(input).resize({ width: Math.max(320, Math.round((meta.width ?? 1000) * scale)) })
  }
  throw new Error('合并图片压缩后仍超过接口限制，请减少本次错题数量。')
}
function hmacSha256(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest()
}
function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}
function normalize(value: string): string {
  return value.replace(/[\ufeff\u200b]/g, '').trim()
}
function tencentError(code: string, message: string): string {
  const messages: Record<string, string> = {
    'AuthFailure.SecretIdNotFound': 'SecretId 不存在，请检查腾讯云控制台密钥。',
    'AuthFailure.SignatureFailure': '签名校验失败，请确认 SecretId 和 SecretKey 来自同一密钥。',
    'AuthFailure.InvalidSecretKey': 'SecretKey 无效，请检查腾讯云控制台密钥。',
    'FailedOperation.EngineRecognizeTimeout': '擦除引擎处理超时，请稍后重试。',
    'FailedOperation.ImageDecodeFailed': '图片解码失败，请重新框选后再试。',
    'FailedOperation.DownLoadError': '图片处理失败，请重试。',
    'LimitExceeded.TooLargeFileError': '图片过大，请减少本次错题数量。',
    'InvalidParameterValue.InvalidParameterValueLimit': '请求参数有误，请重试。',
    UnauthorizedOperation: '当前账号未开通文字识别服务或无权限调用。',
  }
  return `腾讯云错误 ${code || '未知'}：${(messages[code] ?? message) || '服务调用失败'}`
}
