<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Printer, Shuffle, Trash2 } from '@lucide/vue'
import PageHeader from '@renderer/components/PageHeader.vue'
import AppDialog from '@renderer/components/AppDialog.vue'
import AppLoading from '@renderer/components/AppLoading.vue'
import LoginDialog from '@renderer/components/LoginDialog.vue'
import { useAuthStore } from '@renderer/stores/auth'
import { useBookStore } from '@renderer/stores/book'
import { ALL_SUBJECTS } from '@renderer/config/subjects'
import type { ErrorType, PaperSize, Subject, Term } from '@shared/types'
import { desktopAPI } from '@renderer/services/desktop-api'
import { friendlyError, useAppStore } from '@renderer/stores/app'

const store = useBookStore()
const auth = useAuthStore()
const app = useAppStore()
const subjectFilter = ref<Subject | '全部'>('全部')
const errorTypeFilter = ref<ErrorType | '全部'>('全部')
const selected = ref<string[]>([])
const composed = ref<string[]>([])
const deleteDialog = ref(false)
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

const subjects: Array<Subject | '全部'> = ['全部', ...ALL_SUBJECTS]
const errorTypes: Array<ErrorType | '全部'> = ['全部', '马虎', '不会', '概念不清', '其他']
const errorTypeOptions: ErrorType[] = ['马虎', '不会', '概念不清', '其他']

const entries = computed(() =>
  store.entries.filter(
    (entry) =>
      entry.grade === app.config.grade &&
      entry.term === app.config.term &&
      (subjectFilter.value === '全部' || entry.subject === subjectFilter.value) &&
      (errorTypeFilter.value === '全部' || entry.errorType === errorTypeFilter.value),
  ),
)

onMounted(() => {
  void store.refresh()
})
async function gradeChange(event: Event): Promise<void> {
  try {
    await app.setGrade(Number((event.target as HTMLSelectElement).value))
  } catch (error) {
    store.error = friendlyError(error)
  }
}
async function termChange(event: Event): Promise<void> {
  try {
    await app.setTerm(Number((event.target as HTMLSelectElement).value) as Term)
  } catch (error) {
    store.error = friendlyError(error)
  }
}
watch(
  () => [composed.value.slice(), paper.value, auth.loggedIn],
  () => {
    window.clearTimeout(previewTimer)
    if (!auth.loggedIn || !composed.value.length) {
      store.preview = null
      return
    }
    previewTimer = window.setTimeout(() => {
      void store.refreshPreview(pageRequest())
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
function pageRequest() {
  return {
    entryIds: composed.value.slice(),
    paper: paper.value,
    mode: 'normal' as const,
    thermalSize: '80x60' as const,
  }
}
function printNow(): void {
  void store.printBook(pageRequest()).then((success) => {
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
function composeSelection(): void {
  if (!selected.value.length) return
  composed.value = selected.value.slice()
  void store.bumpPractice(composed.value)
}
function clearComposed(): void {
  composed.value = []
  store.preview = null
}
function openDeleteDialog(): void {
  if (selected.value.length) deleteDialog.value = true
}
async function confirmDelete(): Promise<void> {
  deleteDialog.value = false
  const ids = selected.value.slice()
  for (const id of ids) await store.remove(id)
  selected.value = []
  composed.value = composed.value.filter((id) => !ids.includes(id))
}
function openRandom(): void {
  randomError.value = ''
  randomCounts.value = { 马虎: 5, 不会: 5, 概念不清: 5, 其他: 5 }
  randomDialog.value = true
}
function availableCount(type: ErrorType): number {
  return entries.value.filter((entry) => entry.errorType === type).length
}
async function confirmRandom(): Promise<void> {
  randomError.value = ''
  const counts: Partial<Record<ErrorType, number>> = {}
  for (const type of errorTypeOptions) {
    if (errorTypeFilter.value !== '全部' && type !== errorTypeFilter.value) continue
    const value = Math.max(0, randomCounts.value[type] ?? 0)
    if (value > 0) counts[type] = value
  }
  if (!Object.keys(counts).length) {
    randomError.value = '请至少为一种错误类型设置大于 0 的抽取数量。'
    return
  }
  try {
    const result = await desktopAPI.randomBookEntries({
      grade: app.config.grade,
      term: app.config.term,
      subject: subjectFilter.value === '全部' ? null : subjectFilter.value,
      counts,
    })
    if (!result.selected) {
      randomError.value = '当前筛选下没有可抽取的错题，请调整数量或筛选条件。'
      return
    }
    const picked = result.items.map((item) => item.id)
    selected.value = picked
    composed.value = picked.slice()
    randomDialog.value = false
    void store.bumpPractice(picked)
  } catch (error) {
    randomError.value = friendlyError(error)
  }
}
</script>

<template>
  <section class="book-page">
    <PageHeader title="温故知新" />
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
          <select
            class="inline-select"
            aria-label="年级"
            :value="app.config.grade"
            @change="gradeChange"
          >
            <option v-for="item in 12" :key="item" :value="item">{{ item }}年级</option>
          </select>
          <select
            class="inline-select"
            aria-label="学期"
            :value="app.config.term"
            @change="termChange"
          >
            <option :value="1">上学期</option>
            <option :value="2">下学期</option>
          </select>
          <select v-model="errorTypeFilter" class="inline-select" aria-label="按错误类型筛选">
            <option v-for="item in errorTypes" :key="item" :value="item">
              {{ item === '全部' ? '全部类型' : item }}
            </option>
          </select>
          <span class="book-toolbar-actions">
            <button type="button" :disabled="!selected.length" @click="composeSelection">
              组卷
            </button>
            <button
              class="random-pick-button"
              type="button"
              title="随机抽题组卷"
              @click="openRandom"
            >
              <Shuffle :size="16" />随机
            </button>
            <button
              class="danger-button"
              type="button"
              :disabled="!selected.length"
              @click="openDeleteDialog"
            >
              <Trash2 :size="16" />删除
            </button>
          </span>
        </div>
        <AppLoading
          v-if="store.loading && !entries.length"
          compact
          title="正在加载错题…"
          description=""
        />
        <div v-else-if="!entries.length" class="panel-empty book-empty">
          没有符合条件的错题，去工作台框选后加入。
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
              <strong
                >{{ entry.subject }} · {{ entry.grade }}年级{{
                  entry.term === 1 ? '上' : entry.term === 2 ? '下' : ''
                }}</strong
              >
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
            <button type="button" @click="clearComposed">清空</button>
            <select v-model="paper" class="inline-select" aria-label="纸张大小">
              <option value="A4">A4</option>
              <option value="B5">B5</option>
            </select>
            <button type="button" :disabled="!composed.length || store.printing" @click="printGate">
              <Printer :size="16" />{{ store.printing ? '打印中…' : '打印' }}
            </button>
          </span>
        </div>
        <div v-if="!auth.loggedIn" class="panel-empty book-empty">
          温故知新为登录功能，登录后即可使用云端错题本。
          <span class="book-cta-actions">
            <button class="primary-button" type="button" @click="loginDialog = true">登录</button>
          </span>
        </div>
        <div v-else-if="!store.preview" class="panel-empty book-empty">
          {{ store.previewBusy ? '正在组卷…' : '点击「组卷」将勾选的错题放入组卷区。' }}
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
      :open="deleteDialog"
      title="删除错题"
      description="删除后服务器与本地列表同步移除，不可恢复。"
      @close="deleteDialog = false"
    >
      <p class="delete-confirm-text">确认删除选中的 {{ selected.length }} 道错题？</p>
      <template #footer>
        <button class="secondary-button" type="button" @click="deleteDialog = false">取消</button>
        <button class="danger-button" type="button" @click="confirmDelete">删除</button>
      </template>
    </AppDialog>
    <AppDialog
      :open="randomDialog"
      title="随机抽题组卷"
      description="为每种错误类型设置抽取数量，服务端按「最少练习优先」公平抽题：练习次数最少的错题优先入选，保证题库全覆盖轮转。"
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
