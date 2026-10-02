<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import { Camera } from '@lucide/vue'
import AppDialog from './AppDialog.vue'
import { friendlyError } from '@renderer/stores/app'
import { useWorkspaceStore } from '@renderer/stores/workspace'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useWorkspaceStore()
const devices = ref<MediaDeviceInfo[]>([])
const deviceId = ref('')
const video = ref<HTMLVideoElement | null>(null)
const previewWrap = ref<HTMLElement | null>(null)
const stream = ref<MediaStream | null>(null)
const error = ref('')
const busy = ref(false)
const capturedCount = ref(0)
const resolution = ref('auto')
const guideStyle = ref<CSSProperties>({})

const resolutions = [
  { value: 'auto', label: '自动（设备最大）', width: 0, height: 0 },
  { value: '1080p', label: '1080P（1920×1080）', width: 1920, height: 1080 },
  { value: '2k', label: '2K（2560×1440）', width: 2560, height: 1440 },
  { value: '5mp', label: '500万（2592×1944）', width: 2592, height: 1944 },
  { value: '8mp', label: '800万（3264×2448）', width: 3264, height: 2448 },
  { value: '12mp', label: '1200万（4000×3000）', width: 4000, height: 3000 },
]
const GUIDE_RATIO = 297 / 210

interface GuideRect {
  offsetX: number
  offsetY: number
  scale: number
  left: number
  top: number
  width: number
  height: number
}
let guideRect: GuideRect | null = null
let resizeObserver: ResizeObserver | null = null

watch(
  () => props.open,
  async (open) => {
    if (open) {
      error.value = ''
      capturedCount.value = 0
      await listDevices()
      await startPreview()
    } else {
      stopPreview()
    }
  },
)
onMounted(() => {
  resizeObserver = new ResizeObserver(() => updateGuide())
  if (previewWrap.value) resizeObserver.observe(previewWrap.value)
  window.addEventListener('resize', updateGuide)
})
onBeforeUnmount(() => {
  stopPreview()
  resizeObserver?.disconnect()
  window.removeEventListener('resize', updateGuide)
})

async function listDevices(): Promise<void> {
  try {
    const temp = await navigator.mediaDevices.getUserMedia({ video: true })
    temp.getTracks().forEach((track) => track.stop())
    const all = await navigator.mediaDevices.enumerateDevices()
    devices.value = all.filter((device) => device.kind === 'videoinput')
    const preferred = devices.value.find((device) => /GP-2000|COMET|科密/i.test(device.label))
    deviceId.value = (preferred ?? devices.value[0])?.deviceId ?? ''
    if (!deviceId.value) error.value = '未检测到高拍仪或摄像头设备。'
  } catch (caught) {
    error.value = cameraError(caught)
  }
}

async function startPreview(): Promise<void> {
  stopPreview()
  error.value = ''
  if (!deviceId.value) return
  try {
    const preset = resolutions.find((item) => item.value === resolution.value)
    const constraints: MediaTrackConstraints = { deviceId: { exact: deviceId.value } }
    if (preset && preset.width) {
      constraints.width = { ideal: preset.width }
      constraints.height = { ideal: preset.height }
    } else {
      constraints.width = { ideal: 4096 }
      constraints.height = { ideal: 3072 }
    }
    const media = await navigator.mediaDevices.getUserMedia({ video: constraints })
    stream.value = media
    await nextTick()
    if (video.value) {
      video.value.srcObject = media
      await video.value.play()
    }
    updateGuide()
  } catch (caught) {
    error.value = cameraError(caught)
  }
}

function stopPreview(): void {
  stream.value?.getTracks().forEach((track) => track.stop())
  stream.value = null
  guideRect = null
  guideStyle.value = {}
}

function updateGuide(): void {
  const element = video.value
  if (!element || !element.videoWidth || !element.videoHeight) return
  const ew = element.clientWidth
  const eh = element.clientHeight
  if (!ew || !eh) return
  const scale = Math.min(ew / element.videoWidth, eh / element.videoHeight)
  const cw = element.videoWidth * scale
  const ch = element.videoHeight * scale
  const ox = (ew - cw) / 2
  const oy = (eh - ch) / 2
  let gh = ch * 0.94
  let gw = gh * GUIDE_RATIO
  if (gw > cw * 0.94) {
    gw = cw * 0.94
    gh = gw / GUIDE_RATIO
  }
  const left = ox + (cw - gw) / 2
  const top = oy + (ch - gh) / 2
  guideRect = { offsetX: ox, offsetY: oy, scale, left, top, width: gw, height: gh }
  guideStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    width: `${gw}px`,
    height: `${gh}px`,
  }
}

async function capture(): Promise<void> {
  const element = video.value
  if (!element || !element.videoWidth || busy.value || !guideRect) return
  busy.value = true
  error.value = ''
  try {
    const sx = (guideRect.left - guideRect.offsetX) / guideRect.scale
    const sy = (guideRect.top - guideRect.offsetY) / guideRect.scale
    const sw = guideRect.width / guideRect.scale
    const sh = guideRect.height / guideRect.scale
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(sh)
    canvas.height = Math.round(sw)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建画布。')
    context.translate(canvas.width, 0)
    context.rotate(Math.PI / 2)
    context.drawImage(element, sx, sy, sw, sh, 0, 0, sw, sh)
    await store.addScannerImage(canvas.toDataURL('image/jpeg', 0.92))
    capturedCount.value += 1
  } catch (caught) {
    error.value = friendlyError(caught)
  } finally {
    busy.value = false
  }
}

function cameraError(caught: unknown): string {
  const name = caught instanceof DOMException ? caught.name : ''
  if (name === 'NotAllowedError') return '相机权限被拒绝，请在系统设置中允许本应用访问相机。'
  if (name === 'NotFoundError') return '未检测到高拍仪或摄像头设备。'
  return friendlyError(caught)
}
</script>

<template>
  <AppDialog
    :open="open"
    wide
    title="高拍仪导入"
    description="选择设备与分辨率后实时预览，拍摄即按 A4 比例虚线框裁切加入错题照片列表。"
    @close="emit('close')"
  >
    <div class="scanner-layout">
      <div ref="previewWrap" class="scanner-preview">
        <video ref="video" muted playsinline @loadedmetadata="updateGuide"></video>
        <div class="scanner-guide" :style="guideStyle" aria-hidden="true"></div>
      </div>
      <div class="scanner-side">
        <label class="scanner-device">
          <span>设备</span>
          <select v-model="deviceId" @change="startPreview">
            <option v-for="device in devices" :key="device.deviceId" :value="device.deviceId">
              {{ device.label || `摄像头 ${device.deviceId.slice(0, 4)}` }}
            </option>
          </select>
        </label>
        <label class="scanner-device">
          <span>分辨率</span>
          <select v-model="resolution" @change="startPreview">
            <option v-for="item in resolutions" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </label>
        <button class="primary-button" type="button" :disabled="!stream || busy" @click="capture">
          <Camera :size="16" />{{ busy ? '处理中…' : '拍摄' }}
        </button>
        <p class="scanner-count">本次已拍摄 {{ capturedCount }} 张</p>
        <p v-if="error" class="login-error">{{ error }}</p>
      </div>
    </div>
    <p class="scanner-hint">卷纸放到虚线框内，拍摄即裁剪。</p>
  </AppDialog>
</template>
