<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, Rocket, X } from '@lucide/vue'
import { useAppStore } from '@renderer/stores/app'

const store = useAppStore()
const dismissed = ref<string | null>(null)
const status = computed(() => store.updateState.status)
const version = computed(() => store.updateState.version ?? '')
const isMock = computed(() => /mock/i.test(version.value))
const downloaded = computed(() => status.value === 'downloaded')
const downloading = computed(() => status.value === 'downloading')
const available = computed(() => status.value === 'available')
const visible = computed(() => {
  if (isMock.value) return false
  if (!['available', 'downloading', 'downloaded'].includes(status.value)) return false
  return dismissed.value !== version.value
})

function dismiss(): void {
  dismissed.value = version.value
}
function download(): void {
  void store.downloadUpdate()
}
function install(): void {
  store.installUpdate()
}
</script>

<template>
  <div v-if="visible" class="update-notice" role="status">
    <div class="update-notice-head">
      <strong>发现新版本{{ version ? ` v${version}` : '' }}</strong>
      <button class="update-notice-close" type="button" aria-label="关闭更新提示" @click="dismiss">
        <X :size="15" />
      </button>
    </div>
    <p v-if="downloading && store.updateState.progress">
      正在下载… {{ Math.round(store.updateState.progress.percent) }}%
    </p>
    <p v-else-if="downloaded">更新已下载完成，重启后安装。</p>
    <p v-else>正在准备下载…</p>
    <progress
      v-if="downloading && store.updateState.progress"
      max="100"
      :value="store.updateState.progress.percent"
    />
    <button v-if="available" class="primary-button" type="button" @click="download">
      <Download :size="16" />下载并更新
    </button>
    <button v-else-if="downloaded" class="primary-button" type="button" @click="install">
      <Rocket :size="16" />重启并安装
    </button>
  </div>
</template>
