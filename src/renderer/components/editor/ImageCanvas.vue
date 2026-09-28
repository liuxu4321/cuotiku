<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { SelectionRegion } from '@shared/types'
import type { WorkspaceImage } from '@renderer/stores/workspace'

const props = defineProps<{ image: WorkspaceImage | null; mode: 'select' | 'pan' }>()
const emit = defineEmits<{ 'update:selections': [regions: SelectionRegion[]] }>()
const canvas = ref<HTMLCanvasElement | null>(null)
let context: CanvasRenderingContext2D | null = null
let resizeObserver: ResizeObserver | null = null
let raster: HTMLCanvasElement | null = null
let zoom = 1
let panX = 0
let panY = 0
let frame = 0
let activeId: string | null = null
let gesture: null | {
  kind: 'pan' | 'new' | 'move' | 'resize'
  startX: number
  startY: number
  origin?: SelectionRegion
  handle?: string
  panX?: number
  panY?: number
} = null
const HANDLE = 8

watch(
  () => [props.image?.id, props.image?.quarterTurns, props.image?.fineAngle],
  () => {
    void rebuildRaster()
    resetView()
  },
)
watch(() => props.image?.selections, scheduleDraw, { deep: true })
watch(
  () => props.mode,
  () => {
    gesture = null
    scheduleDraw()
  },
)

onMounted(() => {
  context = canvas.value?.getContext('2d') ?? null
  resizeObserver = new ResizeObserver(resizeCanvas)
  if (canvas.value) resizeObserver.observe(canvas.value)
  void rebuildRaster()
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  cancelAnimationFrame(frame)
})

async function rebuildRaster(): Promise<void> {
  if (!props.image) {
    raster = null
    scheduleDraw()
    return
  }
  const imageId = props.image.id
  const img = new Image()
  img.src = props.image.previewDataUrl
  await img.decode()
  if (props.image?.id !== imageId) return
  const angle = (((props.image.quarterTurns % 4) + 4) % 4) * 90 + props.image.fineAngle
  const radians = Math.abs((angle * Math.PI) / 180)
  const width = Math.ceil(
    Math.abs(img.width * Math.cos(radians)) + Math.abs(img.height * Math.sin(radians)),
  )
  const height = Math.ceil(
    Math.abs(img.width * Math.sin(radians)) + Math.abs(img.height * Math.cos(radians)),
  )
  const offscreen = document.createElement('canvas')
  offscreen.width = width
  offscreen.height = height
  const ctx = offscreen.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.translate(width / 2, height / 2)
  ctx.rotate((angle * Math.PI) / 180)
  ctx.drawImage(img, -img.width / 2, -img.height / 2)
  raster = offscreen
  scheduleDraw()
}

function resizeCanvas(): void {
  const element = canvas.value
  if (!element) return
  const rect = element.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  element.width = Math.max(1, Math.round(rect.width * dpr))
  element.height = Math.max(1, Math.round(rect.height * dpr))
  context = element.getContext('2d')
  context?.setTransform(dpr, 0, 0, dpr, 0, 0)
  scheduleDraw()
}
function resetView(): void {
  zoom = 1
  panX = 0
  panY = 0
  scheduleDraw()
}
function zoomBy(factor: number): void {
  zoom = clamp(zoom * factor, 0.2, 8)
  scheduleDraw()
}
defineExpose({ resetView, zoomBy })

function viewMetrics(): {
  left: number
  top: number
  scale: number
  width: number
  height: number
} | null {
  const element = canvas.value
  if (!element || !raster) return null
  const rect = element.getBoundingClientRect()
  const fit = Math.min((rect.width - 36) / raster.width, (rect.height - 36) / raster.height)
  const scale = Math.max(0.0001, fit * zoom)
  const width = raster.width * scale
  const height = raster.height * scale
  return {
    left: rect.width / 2 + panX - width / 2,
    top: rect.height / 2 + panY - height / 2,
    scale,
    width,
    height,
  }
}
function toImage(clientX: number, clientY: number): { x: number; y: number } | null {
  const element = canvas.value
  const metrics = viewMetrics()
  if (!element || !metrics) return null
  const bounds = element.getBoundingClientRect()
  return {
    x: clamp((clientX - bounds.left - metrics.left) / metrics.width, 0, 1),
    y: clamp((clientY - bounds.top - metrics.top) / metrics.height, 0, 1),
  }
}

function pointerDown(event: PointerEvent): void {
  const point = toImage(event.clientX, event.clientY)
  if (!point || !props.image) return
  canvas.value?.setPointerCapture(event.pointerId)
  if (props.mode === 'pan' || event.button === 1 || event.button === 2) {
    gesture = { kind: 'pan', startX: event.clientX, startY: event.clientY, panX, panY }
    return
  }
  const hit = hitTest(point.x, point.y)
  if (hit) {
    activeId = hit.region.id
    gesture = hit.handle
      ? {
          kind: 'resize',
          startX: point.x,
          startY: point.y,
          origin: { ...hit.region },
          handle: hit.handle,
        }
      : { kind: 'move', startX: point.x, startY: point.y, origin: { ...hit.region } }
  } else {
    const region: SelectionRegion = {
      id: crypto.randomUUID(),
      imageId: props.image.id,
      x: point.x,
      y: point.y,
      width: 0.001,
      height: 0.001,
    }
    activeId = region.id
    emitRegions([...props.image.selections, region])
    gesture = { kind: 'new', startX: point.x, startY: point.y, origin: { ...region } }
  }
  scheduleDraw()
}
function pointerMove(event: PointerEvent): void {
  if (!gesture || !props.image) return
  if (gesture.kind === 'pan') {
    panX = (gesture.panX ?? 0) + event.clientX - gesture.startX
    panY = (gesture.panY ?? 0) + event.clientY - gesture.startY
    scheduleDraw()
    return
  }
  const point = toImage(event.clientX, event.clientY)
  const origin = gesture.origin
  if (!point || !origin) return
  let next = { ...origin }
  if (gesture.kind === 'new')
    next = normalizedRect(gesture.startX, gesture.startY, point.x, point.y, origin)
  if (gesture.kind === 'move') {
    next.x = clamp(origin.x + point.x - gesture.startX, 0, 1 - origin.width)
    next.y = clamp(origin.y + point.y - gesture.startY, 0, 1 - origin.height)
  }
  if (gesture.kind === 'resize')
    next = resizeRegion(
      origin,
      gesture.handle ?? 'se',
      point.x - gesture.startX,
      point.y - gesture.startY,
    )
  emitRegions(props.image.selections.map((region) => (region.id === origin.id ? next : region)))
}
function pointerUp(): void {
  if (props.image && activeId) {
    const region = props.image.selections.find((item) => item.id === activeId)
    if (region && (region.width < 0.008 || region.height < 0.008))
      emitRegions(props.image.selections.filter((item) => item.id !== activeId))
  }
  gesture = null
  scheduleDraw()
}
function wheel(event: WheelEvent): void {
  event.preventDefault()
  zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12)
}
function keyDown(event: KeyboardEvent): void {
  if ((event.key === 'Delete' || event.key === 'Backspace') && activeId && props.image) {
    emitRegions(props.image.selections.filter((region) => region.id !== activeId))
    activeId = null
  }
}
function emitRegions(regions: SelectionRegion[]): void {
  emit('update:selections', regions)
}

function hitTest(x: number, y: number): { region: SelectionRegion; handle?: string } | null {
  const metrics = viewMetrics()
  if (!props.image || !metrics) return null
  const toleranceX = HANDLE / metrics.width
  const toleranceY = HANDLE / metrics.height
  for (const region of [...props.image.selections].reverse()) {
    for (const [handle, hx, hy] of handlePoints(region))
      if (Math.abs(x - hx) <= toleranceX && Math.abs(y - hy) <= toleranceY)
        return { region, handle }
    if (
      x >= region.x &&
      x <= region.x + region.width &&
      y >= region.y &&
      y <= region.y + region.height
    )
      return { region }
  }
  return null
}
function handlePoints(r: SelectionRegion): Array<[string, number, number]> {
  const cx = r.x + r.width / 2
  const cy = r.y + r.height / 2
  return [
    ['nw', r.x, r.y],
    ['n', cx, r.y],
    ['ne', r.x + r.width, r.y],
    ['e', r.x + r.width, cy],
    ['se', r.x + r.width, r.y + r.height],
    ['s', cx, r.y + r.height],
    ['sw', r.x, r.y + r.height],
    ['w', r.x, cy],
  ]
}
function normalizedRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  base: SelectionRegion,
): SelectionRegion {
  return {
    ...base,
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}
function resizeRegion(r: SelectionRegion, handle: string, dx: number, dy: number): SelectionRegion {
  let left = r.x
  let top = r.y
  let right = r.x + r.width
  let bottom = r.y + r.height
  if (handle.includes('w')) left += dx
  if (handle.includes('e')) right += dx
  if (handle.includes('n')) top += dy
  if (handle.includes('s')) bottom += dy
  if (handle === 'n' || handle === 's') {
    /* vertical only */
  } else if (handle === 'e' || handle === 'w') {
    /* horizontal only */
  }
  left = clamp(left, 0, right - 0.005)
  right = clamp(right, left + 0.005, 1)
  top = clamp(top, 0, bottom - 0.005)
  bottom = clamp(bottom, top + 0.005, 1)
  return { ...r, x: left, y: top, width: right - left, height: bottom - top }
}

function scheduleDraw(): void {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(draw)
}
function draw(): void {
  const element = canvas.value
  const ctx = context
  if (!element || !ctx) return
  const rect = element.getBoundingClientRect()
  ctx.clearRect(0, 0, rect.width, rect.height)
  ctx.fillStyle = '#eef1f4'
  ctx.fillRect(0, 0, rect.width, rect.height)
  const metrics = viewMetrics()
  if (!raster || !metrics) {
    ctx.fillStyle = '#727b85'
    ctx.font = '15px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('导入图片后开始框选错题', rect.width / 2, rect.height / 2)
    return
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(raster, metrics.left, metrics.top, metrics.width, metrics.height)
  for (const region of props.image?.selections ?? []) {
    const x = metrics.left + region.x * metrics.width
    const y = metrics.top + region.y * metrics.height
    const w = region.width * metrics.width
    const h = region.height * metrics.height
    ctx.fillStyle = region.id === activeId ? 'rgba(34,111,238,.16)' : 'rgba(34,111,238,.10)'
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = '#226fee'
    ctx.lineWidth = region.id === activeId ? 2 : 1.5
    ctx.strokeRect(x, y, w, h)
    if (region.id === activeId)
      for (const [, hx, hy] of handlePoints(region)) {
        ctx.fillStyle = '#fff'
        ctx.strokeStyle = '#226fee'
        ctx.lineWidth = 2
        ctx.fillRect(
          metrics.left + hx * metrics.width - 4,
          metrics.top + hy * metrics.height - 4,
          8,
          8,
        )
        ctx.strokeRect(
          metrics.left + hx * metrics.width - 4,
          metrics.top + hy * metrics.height - 4,
          8,
          8,
        )
      }
  }
}
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
</script>

<template>
  <canvas
    ref="canvas"
    class="image-canvas"
    tabindex="0"
    @pointerdown="pointerDown"
    @pointermove="pointerMove"
    @pointerup="pointerUp"
    @pointercancel="pointerUp"
    @wheel="wheel"
    @keydown="keyDown"
    @contextmenu.prevent
  />
</template>
