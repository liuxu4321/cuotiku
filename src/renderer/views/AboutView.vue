<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@renderer/components/PageHeader.vue'
import { useAppStore } from '@renderer/stores/app'
import { desktopAPI } from '@renderer/services/desktop-api'

const store = useAppStore()
const autoUpdateText = computed(() =>
  store.platformInfo?.canAutoUpdate ? '当前平台支持应用内更新。' : '当前平台请通过安装包更新。',
)

function openWebsite(): void {
  void desktopAPI.openExternal('https://github.com/')
}
</script>

<template>
  <section class="page">
    <PageHeader title="关于盈盈错题库" :description="`版本 ${store.version}`">
      <template #actions>
        <button type="button" @click="openWebsite">项目主页</button>
      </template>
    </PageHeader>

    <article class="panel">
      <h2>应用更新</h2>
      <p>{{ autoUpdateText }}</p>
      <div class="update-row">
        <button
          type="button"
          :disabled="['checking', 'downloading'].includes(store.updateState.status)"
          @click="store.checkForUpdates"
        >
          检查更新
        </button>
        <button
          v-if="store.updateState.status === 'downloaded'"
          type="button"
          @click="store.installUpdate"
        >
          重启并安装
        </button>
      </div>
      <p class="status">{{ store.updateState.message }}</p>
      <progress
        v-if="store.updateState.progress"
        max="100"
        :value="store.updateState.progress.percent"
      />
    </article>
  </section>
</template>
