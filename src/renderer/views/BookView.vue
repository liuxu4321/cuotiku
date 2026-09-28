<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Printer, Shuffle, Trash2 } from '@lucide/vue'
import PageHeader from '@renderer/components/PageHeader.vue'
import AppDialog from '@renderer/components/AppDialog.vue'
import LoginDialog from '@renderer/components/LoginDialog.vue'
import { useAuthStore } from '@renderer/stores/auth'
import { useBookStore } from '@renderer/stores/book'
import type { ErrorType, PaperSize, Subject } from '@shared/types'

const store = useBookStore()
const auth = useAuthStore()
const subjectFilter = ref<Subject | '全部'>('全部')
const errorTypeFilter = ref<ErrorType | '全部'>('全部')
const selected = ref<string[]>([])
const paper = ref<PaperSize>('A4')
const loginDialog = ref(false)
const randomDialog = ref(false)
const randomError = ref('')
const randomCounts = ref<Record<ErrorType, number>>({
  马虎: 5,
  不会: 5,
  概念不清: 5,
  其他: 5,
})
let previewTimer = 0

const subjects: Array<Subject | '全部'> = ['全部', '语文', '数学', '英语']
const errorTypes: Array<ErrorType | '全部'> = ['全部', '马虎', '不会', '概念不清', '其他']
const errorTypeOptions: ErrorType[] = ['马虎', '不会', '概念不清', '其他']

const entries = computed(() =>
  store.entries.filter(
    (entry) =>
      (subjectFilter.value === '全部' || entry.subject === subjectFilter.value) &&
      (errorTypeFilter.value === '全部' || entry.errorType === errorTypeFilter.value),
  ),
)

onMounted(() => {
  void store.refresh()
})
watch(
  () => [selected.value.slice(), paper.value, auth.loggedIn],
  () => {
    window.clearTimeout(previewTimer)
    if (!auth.loggedIn) {
      store.preview = null
      return
    }
    previewTimer = window.setTimeout(() => {
      void store.refreshPreview(selected.value.slice(), paper.value)
    }, 300)
  },
  { deep: true },
)
watch(
  () => auth.loggedIn,
  (loggedIn) => {
    if (loggedIn) void store.refresh()
  },
)
onBeforeUnmount(() => window.clearTimeout(previewTimer))

function dateLabel(value: number): string {
  return new Date(value).toLocaleDateString('zh-CN')
}
function toggleSelected(id: string): void {
  const index = selected.value.indexOf(id)
  if (index >= 0) selected.value.splice(index, 1)
  else selected.value.push(id)
}
async function removeEntry(id: string): Promise<void> {
  await store.remove(id)
  const index = selected.value.indexOf(id)
  if (index >= 0) selected.value.splice(index, 1)
}
function printNow(): void {
  void store.printBook(selected.value.slice(), paper.value).then((success) => {
    if (success) void store.refresh()
  })
}
function printGate(): void {
  if (!auth.loggedIn) {
    loginDialog.value = true
    return
  }
  printNow()
}
function openRandom(): void {
  randomError.value = ''
  randomCounts.value = { 马虎: 5, 不会: 5, 概念不清: 5, 其他: 5 }
  randomDialog.value = true
}
function availableCount(type: ErrorType): number {
  return entries.value.filter((entry) => entry.errorType === type).length
}
function confirmRandom(): void {
  const picked: string[] = []
  for (const type of errorTypeOptions) {
    const pool = entries.value.filter((entry) => entry.errorType === type).map((entry) => entry.id)
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = pool[i]!
      pool[i] = pool[j]!
      pool[j] = tmp
    }
    const need = Math.max(0, Math.min(randomCounts.value[type] ?? 0, pool.length))
    picked.push(...pool.slice(0, need))
  }
  if (!picked.length) {
    randomError.value = '当前筛选下没有可抽取的错题，请调整数量或筛选条件。'
    return
  }
  selected.value = picked
  randomDialog.value = false
}
</script>

<template>
  <section class="book-page">
    <PageHeader title="错题组卷" description="左侧勾选错题自动组卷，右侧预览并打印。" />
    <div v-if="store.error" class="workspace-alert">
      <span>{{ store.error }}</span
      ><button type="button" @click="store.error = null">关闭</button>
    </div>
    <div class="book-split">
      <div class="book-left">
        <div class="book-toolbar">
          <select v-model="subjectFilter" class="inline-select" aria-label="按科目筛选">
            <option v-for="item in subjects" :key="item" :value="item">
              {{ item === '全部' ? '全部科目' : item }}
            </option>
          </select>
          <select v-model="errorTypeFilter" class="inline-select" aria-label="按错误类型筛选">
            <option v-for="item in errorTypes" :key="item" :value="item">
              {{ item === '全部' ? '全部类型' : item }}
            </option>
          </select>
          <span class="book-count">共 {{ entries.length }} 条 · 已选 {{ selected.length }} 条</span>
          <button class="random-pick-button" type="button" @click="openRandom">
            <Shuffle :size="16" />随机抽题组卷
          </button>
        </div>
        <div v-if="!entries.length" class="panel-empty book-empty">
          {{ store.loading ? '正在加载…' : '没有符合条件的错题，去工作台框选后加入。' }}
        </div>
        <div v-else class="book-list">
          <article v-for="entry in entries" :key="entry.id" class="book-row">
            <input
              :checked="selected.includes(entry.id)"
              type="checkbox"
              aria-label="选择该错题"
              @change="toggleSelected(entry.id)"
            />
            <img :src="entry.thumbDataUrl" alt="错题" />
            <div class="book-row-meta">
              <strong>{{ entry.subject }} · {{ entry.grade }}年级</strong>
              <span>错误类型：{{ entry.errorType }}</span>
              <span>刷题 {{ entry.practiceCount }} 次</span>
              <small>{{ dateLabel(entry.createdAt) }}</small>
            </div>
            <button
              class="icon-action"
              type="button"
              title="删除该错题"
              aria-label="删除该错题"
              @click="removeEntry(entry.id)"
            >
              <Trash2 :size="15" />
            </button>
          </article>
        </div>
      </div>

      <aside class="book-right">
        <div class="book-right-head">
          <strong>组卷打印区</strong>
          <span class="book-right-actions">
            <select v-model="paper" class="inline-select" aria-label="纸张大小">
              <option value="A4">A4</option>
              <option value="B5">B5</option>
            </select>
            <button type="button" :disabled="!selected.length || store.printing" @click="printGate">
              <Printer :size="16" />{{ store.printing ? '打印中…' : '打印' }}
            </button>
          </span>
        </div>
        <div v-if="!auth.loggedIn" class="panel-empty book-empty">
          错题组卷为登录功能，登录后即可使用云端错题本。
          <span class="book-cta-actions">
            <button class="primary-button" type="button" @click="loginDialog = true">登录</button>
          </span>
        </div>
        <div v-else-if="!store.preview" class="panel-empty book-empty">
          {{ store.previewBusy ? '正在组卷…' : '在左侧勾选错题后自动组卷。' }}
        </div>
        <div v-else class="compose-doc">
          <div class="page-meta">
            {{ paper }} · {{ store.preview.columns }} 列 · {{ store.preview.pages.length }} 页<span
              v-if="store.preview.scalePercent < 100"
            >
              · 缩放 {{ store.preview.scalePercent }}%</span
            >
          </div>
          <img
            v-for="(page, index) in store.preview.pages"
            :key="index"
            :src="page"
            :alt="`组卷预览第 ${index + 1} 页`"
          />
        </div>
      </aside>
    </div>
    <LoginDialog :open="loginDialog" @close="loginDialog = false" @success="loginDialog = false" />
    <AppDialog
      :open="randomDialog"
      title="随机抽题组卷"
      description="为每种错误类型设置抽取数量，确认后随机抽取并勾选到组卷区。"
      @close="randomDialog = false"
    >
      <div class="random-pick-list">
        <label v-for="type in errorTypeOptions" :key="type" class="random-pick-row">
          <span>{{ type }}（可用 {{ availableCount(type) }} 道）</span>
          <input v-model.number="randomCounts[type]" type="number" min="0" max="99" />
        </label>
        <p v-if="randomError" class="login-error">{{ randomError }}</p>
      </div>
      <template #footer>
        <button class="secondary-button" type="button" @click="randomDialog = false">取消</button>
        <button class="primary-button" type="button" @click="confirmRandom">确认抽题</button>
      </template>
    </AppDialog>
  </section>
</template>
