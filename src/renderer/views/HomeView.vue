<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RefreshCw } from '@lucide/vue'
import PageHeader from '@renderer/components/PageHeader.vue'
import AbilityRadar from '@renderer/components/AbilityRadar.vue'
import LoginDialog from '@renderer/components/LoginDialog.vue'
import { useAppStore } from '@renderer/stores/app'
import { useAuthStore } from '@renderer/stores/auth'
import { useAbilityStore } from '@renderer/stores/ability'
import type { Subject } from '@shared/types'

const app = useAppStore()
const auth = useAuthStore()
const store = useAbilityStore()
const grade = ref<number>(app.config.grade)
const term = ref<number>(app.config.term)
const subject = ref<Subject | '全部'>('全部')
const start = ref('')
const end = ref('')
const loginDialog = ref(false)
const activeTab = ref('overall')

const subjects: Array<Subject | '全部'> = ['全部', '语文', '数学', '英语']
const tabs = computed(() => {
  if (!store.data) return [] as Array<{ key: string; label: string }>
  return [
    { key: 'overall', label: '综合' },
    ...store.data.subjects.map((item) => ({ key: item.subject ?? '', label: item.subject ?? '' })),
  ]
})
const activeModel = computed(() => {
  if (!store.data) return null
  if (activeTab.value === 'overall') return store.data.overall
  return store.data.subjects.find((item) => item.subject === activeTab.value) ?? store.data.overall
})

function buildRequest() {
  return {
    grade: grade.value,
    term: term.value,
    ...(subject.value === '全部' ? {} : { subject: subject.value }),
    ...(start.value ? { start: start.value } : {}),
    ...(end.value ? { end: end.value } : {}),
  }
}
function load(): void {
  if (!auth.loggedIn) {
    store.data = null
    return
  }
  void store.fetch(buildRequest())
}
onMounted(load)
watch([grade, term, subject, start, end], load)
watch(
  () => auth.loggedIn,
  (loggedIn) => {
    if (loggedIn) load()
  },
)
</script>

<template>
  <section class="page home-page">
    <PageHeader title="首页" description="个人能力模型：五维雷达图与明细。" />
    <div v-if="store.error" class="workspace-alert">
      <span>{{ store.error }}</span
      ><button type="button" @click="store.error = null">关闭</button>
    </div>
    <div v-if="!auth.loggedIn" class="panel-empty book-empty">
      登录后查看个人能力模型。
      <span class="book-cta-actions">
        <button class="primary-button" type="button" @click="loginDialog = true">登录</button>
      </span>
    </div>
    <template v-else>
      <div class="home-filters">
        <select v-model="grade" class="inline-select" aria-label="年级">
          <option v-for="item in 9" :key="item" :value="item">{{ item }}年级</option>
        </select>
        <select v-model="term" class="inline-select" aria-label="学期">
          <option :value="1">上学期</option>
          <option :value="2">下学期</option>
        </select>
        <select v-model="subject" class="inline-select" aria-label="科目">
          <option v-for="item in subjects" :key="item" :value="item">
            {{ item === '全部' ? '全部科目' : item }}
          </option>
        </select>
        <input v-model="start" type="date" class="inline-select" aria-label="开始日期" />
        <input v-model="end" type="date" class="inline-select" aria-label="结束日期" />
        <button type="button" :disabled="store.loading" @click="load">
          <RefreshCw :size="16" :class="{ spinning: store.loading }" />刷新
        </button>
      </div>
      <div v-if="store.data" class="ability-layout">
        <article class="panel ability-card">
          <div class="ability-tabs">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              type="button"
              :class="{ active: activeTab === tab.key }"
              @click="activeTab = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>
          <AbilityRadar v-if="activeModel" :model="activeModel" />
          <p v-if="activeModel" class="ability-overall">
            综合得分 {{ activeModel.overall ?? '—' }} · 样本 {{ activeModel.sampleSize }} 条
          </p>
        </article>
        <article v-if="activeModel" class="panel ability-details">
          <div v-for="dimension in activeModel.dimensions" :key="dimension.key" class="ability-row">
            <strong>{{ dimension.label }}</strong>
            <span>得分 {{ dimension.score ?? '—' }}</span>
            <span>错题 {{ dimension.totalCount }}</span>
            <span>刷题 {{ dimension.practiceCount }}</span>
            <span>加权 {{ dimension.weightedCount.toFixed(1) }}</span>
          </div>
        </article>
      </div>
      <div v-else-if="!store.loading" class="panel-empty book-empty">暂无能力模型数据。</div>
    </template>
    <LoginDialog :open="loginDialog" @close="loginDialog = false" @success="loginDialog = false" />
  </section>
</template>
