<script setup lang="ts">
import { computed } from 'vue'
import { Download, Images, RefreshCw, Rocket } from '@lucide/vue'
import { useAppStore } from '@renderer/stores/app'

const store = useAppStore()
const status = computed(() => store.updateState.status)
const checking = computed(() => status.value === 'checking')
const available = computed(() => status.value === 'available')
const downloading = computed(() => status.value === 'downloading')
const downloaded = computed(() => status.value === 'downloaded')
const hasUpdate = computed(() => available.value || downloading.value || downloaded.value)
const isMock = computed(() => /mock/i.test(store.updateState.message))
const statusText = computed(() => (isMock.value ? '' : store.updateState.message))
const platformText = computed(() => {
  const info = store.platformInfo
  if (!info) return '获取中…'
  return `${info.name} · ${info.arch}${info.canAutoUpdate ? '' : '（不支持应用内更新）'}`
})
</script>

<template>
  <section class="page">
    <article class="panel about-card">
      <div class="about-hero">
        <span class="about-logo"><Images :size="30" /></span>
        <div>
          <strong>盈盈错题库</strong>
          <small>yycuotiku · 错题收集 / 组卷 / 打印一体化</small>
        </div>
      </div>
      <dl class="about-details">
        <dt>当前版本</dt>
        <dd>v{{ store.version || '…' }}</dd>
        <dt>运行平台</dt>
        <dd>{{ platformText }}</dd>
      </dl>
      <div class="about-actions">
        <button v-if="!hasUpdate" type="button" :disabled="checking" @click="store.checkForUpdates">
          <RefreshCw :size="16" :class="{ spinning: checking }" />
          {{ checking ? '检测中…' : '检测新版本' }}
        </button>
        <template v-else>
          <span class="update-found-text">
            发现新版本{{ store.updateState.version ? ` v${store.updateState.version}` : '' }}
          </span>
          <button
            v-if="available"
            type="button"
            class="primary-button"
            @click="store.downloadUpdate"
          >
            <Download :size="16" />下载并更新
          </button>
          <button
            v-else-if="downloaded"
            type="button"
            class="primary-button"
            @click="store.installUpdate"
          >
            <Rocket :size="16" />重启并安装
          </button>
        </template>
      </div>
      <progress
        v-if="downloading && store.updateState.progress"
        max="100"
        :value="store.updateState.progress.percent"
      />
      <p v-if="downloading" class="status">
        正在下载… {{ Math.round(store.updateState.progress?.percent ?? 0) }}%
      </p>
      <p v-else-if="statusText && !hasUpdate" class="status">{{ statusText }}</p>
    </article>
  </section>
</template>
