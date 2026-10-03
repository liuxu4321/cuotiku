<script setup lang="ts">
import { computed, onMounted, ref, toRaw, watch } from 'vue'
import { BookOpenText, Download, Lightbulb, Printer } from '@lucide/vue'
import PageHeader from '@renderer/components/PageHeader.vue'
import AppLoading from '@renderer/components/AppLoading.vue'
import LoginDialog from '@renderer/components/LoginDialog.vue'
import { useAuthStore } from '@renderer/stores/auth'
import { useBookStore } from '@renderer/stores/book'
import { ALL_SUBJECTS } from '@renderer/config/subjects'
import { desktopAPI } from '@renderer/services/desktop-api'
import { friendlyError, useAppStore } from '@renderer/stores/app'
import { svgToDataUrl, buildAnalogyPages } from '@renderer/templates'
import type { AgentExplainResult, ErrorType, Subject, Term } from '@shared/types'

const store = useBookStore()
const auth = useAuthStore()
const app = useAppStore()
const subjectFilter = ref<Subject | '全部'>('全部')
const errorTypeFilter = ref<ErrorType | '全部'>('全部')
const selectedId = ref<string | null>(null)
const busy = ref(false)
const activeResult = ref<null | 'lecture' | 'analogy'>(null)
const lecture = ref('')
const analogySvgs = ref<string[]>([])
const loginDialog = ref(false)

const subjects: Array<Subject | '全部'> = ['全部', ...ALL_SUBJECTS]
const errorTypes: Array<ErrorType | '全部'> = ['全部', '马虎', '不会', '概念不清', '其他']

onMounted(() => {
  if (auth.loggedIn) void store.refresh()
})
watch(
  () => auth.loggedIn,
  (loggedIn) => {
    if (loggedIn) void store.refresh()
  },
)

const entries = computed(() =>
  store.entries.filter(
    (entry) =>
      entry.grade === app.config.grade &&
      entry.term === app.config.term &&
      (subjectFilter.value === '全部' || entry.subject === subjectFilter.value) &&
      (errorTypeFilter.value === '全部' || entry.errorType === errorTypeFilter.value),
  ),
)

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

const selectedEntry = computed(
  () => store.entries.find((entry) => entry.id === selectedId.value) ?? null,
)
const analogyPreview = computed(() => analogySvgs.value.map(svgToDataUrl))

function selectEntry(id: string): void {
  selectedId.value = selectedId.value === id ? null : id
}

async function runLecture(): Promise<void> {
  if (!selectedEntry.value || busy.value) return
  busy.value = true
  try {
    const result = await desktopAPI.agentExplain({ entryId: selectedEntry.value.id })
    lecture.value = formatExplain(result)
    activeResult.value = 'lecture'
  } catch (error) {
    store.error = friendlyError(error)
  } finally {
    busy.value = false
  }
}

function formatExplain(result: AgentExplainResult): string {
  const lines: string[] = []
  if (result.analysis) lines.push('【整体思路】', result.analysis, '')
  if (result.steps?.length) {
    lines.push('【分步讲解】')
    result.steps.forEach((step, index) => {
      lines.push(`${index + 1}. ${step.title}`, `　${step.content}`)
    })
    lines.push('')
  }
  if (result.knowledgePoints?.length) {
    lines.push('【知识点】', ...result.knowledgePoints.map((item) => `· ${item}`), '')
  }
  if (result.commonMistakes?.length) {
    lines.push('【易错提醒】', ...result.commonMistakes.map((item) => `· ${item}`), '')
  }
  if (result.summary) lines.push('【总结】', result.summary)
  return lines.join('\n').trim()
}

async function runAnalogy(): Promise<void> {
  if (!selectedEntry.value || busy.value) return
  busy.value = true
  try {
    const result = await desktopAPI.agentAnalogy({ entryId: selectedEntry.value.id, count: 3 })
    analogySvgs.value = buildAnalogyPages(result.items)
    activeResult.value = 'analogy'
  } catch (error) {
    store.error = friendlyError(error)
  } finally {
    busy.value = false
  }
}

function plainSvgs(): string[] {
  return toRaw(analogySvgs.value).map((svg) => String(svg))
}

async function printAnalogy(): Promise<void> {
  if (!analogySvgs.value.length) return
  try {
    await desktopAPI.printSvgPages({ svgs: plainSvgs(), paper: 'B5' })
  } catch (error) {
    store.error = friendlyError(error)
  }
}

async function saveAnalogy(): Promise<void> {
  if (!analogySvgs.value.length) return
  try {
    await desktopAPI.saveSvgPages({ svgs: plainSvgs(), paper: 'B5' })
  } catch (error) {
    store.error = friendlyError(error)
  }
}

function dateLabel(value: number): string {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <PageHeader title="千锤百炼" />
  <div v-if="store.error" class="workspace-alert">
    <span>{{ store.error }}</span
    ><button type="button" @click="store.error = null">关闭</button>
  </div>
  <div class="book-split">
    <div class="book-left">
      <div class="book-toolbar practice-toolbar">
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
          <button
            type="button"
            data-tip="知识精讲"
            aria-label="知识精讲"
            :disabled="!selectedEntry || busy"
            @click="runLecture"
          >
            <BookOpenText :size="16" />
          </button>
          <button
            class="primary-button"
            type="button"
            data-tip="举一反三"
            aria-label="举一反三"
            :disabled="!selectedEntry || busy"
            @click="runAnalogy"
          >
            <Lightbulb :size="16" />
          </button>
        </span>
      </div>
      <div v-if="!auth.loggedIn" class="panel-empty book-empty">
        <p>千锤百炼为会员功能，请先登录。</p>
        <button type="button" class="primary-button" @click="loginDialog = true">立即登录</button>
      </div>
      <AppLoading
        v-else-if="store.loading && !entries.length"
        compact
        title="正在加载错题…"
        description=""
      />
      <div v-else-if="!entries.length" class="panel-empty book-empty">
        没有符合条件的错题，去工作台框选后加入。
      </div>
      <div v-else class="book-list">
        <article
          v-for="entry in entries"
          :key="entry.id"
          class="book-row practice-row"
          :class="{ active: entry.id === selectedId }"
          role="button"
          tabindex="0"
          @click="selectEntry(entry.id)"
          @keydown.enter.prevent="selectEntry(entry.id)"
          @keydown.space.prevent="selectEntry(entry.id)"
        >
          <span class="practice-radio" aria-hidden="true" />
          <img :src="entry.thumbDataUrl" alt="错题" />
          <div class="book-row-meta">
            <strong
              >{{ entry.subject }} · {{ entry.grade }}年级{{
                entry.term === 1 ? '上' : entry.term === 2 ? '下' : ''
              }}</strong
            >
            <span>错误类型：{{ entry.errorType }}</span>
            <small>{{ dateLabel(entry.createdAt) }}</small>
          </div>
        </article>
      </div>
    </div>

    <aside class="book-right">
      <div class="book-right-head">
        <strong>{{
          activeResult === 'lecture'
            ? '知识精讲'
            : activeResult === 'analogy'
              ? '举一反三（B5 · 每页两题）'
              : '练习结果'
        }}</strong>
        <span class="book-right-actions">
          <button
            v-if="activeResult === 'analogy' && analogySvgs.length"
            type="button"
            @click="saveAnalogy"
          >
            <Download :size="16" />保存
          </button>
          <button
            v-if="activeResult === 'analogy' && analogySvgs.length"
            type="button"
            @click="printAnalogy"
          >
            <Printer :size="16" />打印
          </button>
        </span>
      </div>
      <div v-if="!auth.loggedIn" class="panel-empty book-empty">登录后可使用。</div>
      <AppLoading
        v-else-if="busy"
        compact
        title="正在生成…"
        description="AI 正在分析错题，结果稍后呈现。"
      />
      <div v-else-if="!activeResult" class="panel-empty book-empty">
        在左侧选择一道错题（仅可单选），然后点击「知识精讲」或「举一反三」。
      </div>
      <pre v-else-if="activeResult === 'lecture'" class="lecture-box">{{ lecture }}</pre>
      <div v-else class="compose-doc">
        <img v-for="(page, index) in analogyPreview" :key="index" :src="page" alt="举一反三页面" />
      </div>
    </aside>
  </div>
  <LoginDialog :open="loginDialog" @close="loginDialog = false" @success="loginDialog = false" />
</template>
