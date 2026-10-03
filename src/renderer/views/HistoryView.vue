<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Trash2 } from '@lucide/vue'
import PageHeader from '@renderer/components/PageHeader.vue'
import AppDialog from '@renderer/components/AppDialog.vue'
import AppLoading from '@renderer/components/AppLoading.vue'
import LoginDialog from '@renderer/components/LoginDialog.vue'
import { useAuthStore } from '@renderer/stores/auth'
import { useBookStore } from '@renderer/stores/book'
import { friendlyError, useAppStore } from '@renderer/stores/app'
import { ALL_SUBJECTS } from '@renderer/config/subjects'
import type { CollectionEntry, ErrorType, Subject, Term } from '@shared/types'

const store = useBookStore()
const auth = useAuthStore()
const app = useAppStore()
const subjectFilter = ref<Subject | '全部'>('全部')
const errorTypeFilter = ref<ErrorType | '全部'>('全部')
const startDate = ref('')
const endDate = ref('')
const detail = ref<CollectionEntry | null>(null)
const selected = ref<string[]>([])
const editing = ref<CollectionEntry | null>(null)
const practicing = ref<CollectionEntry | null>(null)
const practicePhase = ref<'answer' | 'review'>('answer')
const practiceAnswer = ref('')
const practiceBusy = ref(false)
const editForm = ref({
  grade: 1,
  term: 1 as Term,
  subject: '数学' as Subject,
  errorType: '马虎' as ErrorType,
  answer: '',
  remark: '',
})
const editBusy = ref(false)
const pendingDelete = ref<string[]>([])
const deleteBusy = ref(false)
const loginDialog = ref(false)

const subjects: Array<Subject | '全部'> = ['全部', ...ALL_SUBJECTS]
const errorTypes: Array<ErrorType | '全部'> = ['全部', '马虎', '不会', '概念不清', '其他']
const errorTypeOptions: ErrorType[] = ['马虎', '不会', '概念不清', '其他']

onMounted(() => {
  if (auth.loggedIn) void store.refresh()
})
watch(
  () => auth.loggedIn,
  (loggedIn) => {
    if (loggedIn) void store.refresh()
  },
)

const entries = computed(() => {
  const from = startDate.value ? new Date(`${startDate.value}T00:00:00`).getTime() : null
  const to = endDate.value ? new Date(`${endDate.value}T23:59:59.999`).getTime() : null
  return store.entries.filter(
    (entry) =>
      entry.grade === app.config.grade &&
      entry.term === app.config.term &&
      (subjectFilter.value === '全部' || entry.subject === subjectFilter.value) &&
      (errorTypeFilter.value === '全部' || entry.errorType === errorTypeFilter.value) &&
      (from === null || entry.createdAt >= from) &&
      (to === null || entry.createdAt <= to),
  )
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

function toggleSelected(id: string): void {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((item) => item !== id)
    : [...selected.value, id]
}

const allSelected = computed(
  () =>
    entries.value.length > 0 && entries.value.every((entry) => selected.value.includes(entry.id)),
)
function toggleSelectAll(): void {
  selected.value = allSelected.value ? [] : entries.value.map((entry) => entry.id)
}

function openPractice(entry: CollectionEntry): void {
  practicing.value = entry
  practicePhase.value = 'answer'
  practiceAnswer.value = ''
}
function startPracticeFromDetail(): void {
  const entry = detail.value
  detail.value = null
  if (entry) openPractice(entry)
}
async function submitPractice(correct: boolean): Promise<void> {
  if (!practicing.value || practiceBusy.value) return
  practiceBusy.value = true
  try {
    await store.addPractice(practicing.value.id, {
      correct,
      answerContent: practiceAnswer.value.trim() ? practiceAnswer.value : null,
      practicedAt: Date.now(),
    })
    practicing.value = null
  } finally {
    practiceBusy.value = false
  }
}

function openEdit(entry: CollectionEntry): void {
  editing.value = entry
  editForm.value = {
    grade: entry.grade,
    term: entry.term ?? app.config.term,
    subject: entry.subject,
    errorType: entry.errorType,
    answer: entry.answer ?? '',
    remark: entry.remark ?? '',
  }
}
async function saveEdit(): Promise<void> {
  if (!editing.value || editBusy.value) return
  editBusy.value = true
  try {
    await store.update(editing.value.id, {
      grade: editForm.value.grade,
      term: editForm.value.term,
      subject: editForm.value.subject,
      errorType: editForm.value.errorType,
      answer: editForm.value.answer,
      remark: editForm.value.remark,
    })
    editing.value = null
  } finally {
    editBusy.value = false
  }
}

function askDelete(ids: string[]): void {
  if (!ids.length) return
  pendingDelete.value = ids
}
async function confirmDelete(): Promise<void> {
  if (deleteBusy.value) return
  deleteBusy.value = true
  try {
    await store.removeMany(pendingDelete.value)
    selected.value = selected.value.filter((id) => !pendingDelete.value.includes(id))
    pendingDelete.value = []
  } finally {
    deleteBusy.value = false
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
  <PageHeader title="前车之鉴" />
  <div v-if="store.error" class="workspace-alert">
    <span>{{ store.error }}</span
    ><button type="button" @click="store.error = null">关闭</button>
  </div>
  <div class="history-page">
    <div class="book-toolbar">
      <select
        class="inline-select"
        aria-label="年级"
        :value="app.config.grade"
        @change="gradeChange"
      >
        <option v-for="item in 12" :key="item" :value="item">{{ item }}年级</option>
      </select>
      <select class="inline-select" aria-label="学期" :value="app.config.term" @change="termChange">
        <option :value="1">上学期</option>
        <option :value="2">下学期</option>
      </select>
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
      <input v-model="startDate" type="date" class="inline-select" aria-label="开始日期" />
      <input v-model="endDate" type="date" class="inline-select" aria-label="结束日期" />
      <span class="book-toolbar-actions">
        <small
          >共 {{ entries.length }} 道{{
            selected.length ? ` · 已选 ${selected.length}` : ''
          }}</small
        >
        <label class="history-select-all">
          <input
            type="checkbox"
            :checked="allSelected"
            aria-label="全选"
            :disabled="!entries.length"
            @change="toggleSelectAll"
          />全选
        </label>
        <button
          class="danger-button"
          type="button"
          :disabled="!selected.length"
          @click="askDelete(selected.slice())"
        >
          <Trash2 :size="16" />删除
        </button>
      </span>
    </div>
    <div v-if="!auth.loggedIn" class="panel-empty book-empty">
      <p>前车之鉴为登录功能，登录后查看错题列表。</p>
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
        class="book-row history-row"
        role="button"
        tabindex="0"
        @click="detail = entry"
        @keydown.enter.prevent="detail = entry"
        @keydown.space.prevent="detail = entry"
      >
        <input
          :checked="selected.includes(entry.id)"
          type="checkbox"
          aria-label="选择该错题"
          @click.stop
          @change="toggleSelected(entry.id)"
        />
        <img :src="entry.thumbDataUrl" alt="错题缩略图" />
        <div class="book-row-meta">
          <strong
            >{{ entry.subject }} · {{ entry.grade }}年级{{
              entry.term === 1 ? '上' : entry.term === 2 ? '下' : ''
            }}
            · {{ entry.errorType }} · 刷题 {{ entry.practiceCount }} 次{{
              entry.recordCount
                ? ` · 正确率 ${entry.accuracy ?? 0}%（${entry.correctCount}/${entry.recordCount}）`
                : ''
            }}</strong
          >
          <span class="history-line">答案：{{ entry.answer || '—' }}</span>
          <span class="history-line">备注：{{ entry.remark || '—' }}</span>
          <small>{{ dateLabel(entry.createdAt) }}</small>
        </div>
        <span class="history-row-actions">
          <button class="row-text-action" type="button" @click.stop="openPractice(entry)">
            做题
          </button>
          <button class="row-text-action" type="button" @click.stop="openEdit(entry)">修改</button>
          <button class="row-text-action danger" type="button" @click.stop="askDelete([entry.id])">
            删除
          </button>
        </span>
      </article>
    </div>
  </div>
  <AppDialog
    :open="detail !== null"
    :title="detail ? `${detail.subject} · ${detail.errorType}` : ''"
    :description="detail ? dateLabel(detail.createdAt) : ''"
    wide
    @close="detail = null"
  >
    <div v-if="detail" class="history-detail">
      <img :src="detail.thumbDataUrl" alt="错题大图" />
      <dl class="history-detail-meta">
        <dt>科目</dt>
        <dd>{{ detail.subject }}</dd>
        <dt>年级 / 学期</dt>
        <dd>
          {{ detail.grade }}年级{{
            detail.term === 1 ? '上学期' : detail.term === 2 ? '下学期' : ''
          }}
        </dd>
        <dt>错误类型</dt>
        <dd>{{ detail.errorType }}</dd>
        <dt>刷题次数</dt>
        <dd>{{ detail.practiceCount }} 次</dd>
        <dt>尺寸</dt>
        <dd>{{ detail.width }} × {{ detail.height }}</dd>
      </dl>
    </div>
    <template #footer>
      <button class="secondary-button" type="button" @click="detail = null">关闭</button>
      <button class="primary-button" type="button" @click="startPracticeFromDetail">做题</button>
    </template>
  </AppDialog>
  <AppDialog :open="practicing !== null" title="做题" @close="practicing = null">
    <div v-if="practicing" class="practice-dialog">
      <img :src="practicing.thumbDataUrl" alt="错题" class="practice-dialog-image" />
      <label v-if="practicePhase === 'answer'" class="history-edit-form"
        >我的答案（{{ practiceAnswer.length }}/2000）
        <textarea
          v-model="practiceAnswer"
          maxlength="2000"
          rows="5"
          placeholder="写下你的答案与思路…"
        />
      </label>
      <div v-else class="practice-review">
        <div>
          <strong>我的答案</strong>
          <pre>{{ practiceAnswer.trim() || '（未填写）' }}</pre>
        </div>
        <div>
          <strong>参考答案</strong>
          <pre>{{ practicing.answer || '（未设置答案）' }}</pre>
        </div>
      </div>
    </div>
    <template #footer>
      <template v-if="practicePhase === 'answer'">
        <button class="secondary-button" type="button" @click="practicing = null">取消</button>
        <button class="primary-button" type="button" @click="practicePhase = 'review'">
          完成答题
        </button>
      </template>
      <template v-else>
        <button
          class="secondary-button"
          type="button"
          :disabled="practiceBusy"
          @click="practicePhase = 'answer'"
        >
          返回修改
        </button>
        <button
          class="danger-button"
          type="button"
          :disabled="practiceBusy"
          @click="submitPractice(false)"
        >
          做错了
        </button>
        <button
          class="primary-button"
          type="button"
          :disabled="practiceBusy"
          @click="submitPractice(true)"
        >
          做对了
        </button>
      </template>
    </template>
  </AppDialog>
  <AppDialog :open="editing !== null" title="修改错题" @close="editing = null">
    <div class="history-edit-form">
      <div class="history-edit-row">
        <label
          >年级
          <select v-model="editForm.grade" class="inline-select">
            <option v-for="item in 12" :key="item" :value="item">{{ item }}年级</option>
          </select>
        </label>
        <label
          >学期
          <select v-model="editForm.term" class="inline-select">
            <option :value="1">上学期</option>
            <option :value="2">下学期</option>
          </select>
        </label>
      </div>
      <div class="history-edit-row">
        <label
          >科目
          <select v-model="editForm.subject" class="inline-select">
            <option v-for="item in ALL_SUBJECTS" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>
        <label
          >错误类型
          <select v-model="editForm.errorType" class="inline-select">
            <option v-for="item in errorTypeOptions" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>
      </div>
      <label
        >答案（{{ editForm.answer.length }}/1000）
        <textarea v-model="editForm.answer" maxlength="1000" rows="4" placeholder="填写答案…" />
      </label>
      <label
        >备注（{{ editForm.remark.length }}/1000）
        <textarea v-model="editForm.remark" maxlength="1000" rows="4" placeholder="填写备注…" />
      </label>
    </div>
    <template #footer>
      <button class="secondary-button" type="button" @click="editing = null">取消</button>
      <button class="primary-button" type="button" :disabled="editBusy" @click="saveEdit">
        保存
      </button>
    </template>
  </AppDialog>
  <AppDialog
    :open="pendingDelete.length > 0"
    title="删除错题"
    :description="`将从服务器删除 ${pendingDelete.length} 道错题，不可恢复。`"
    @close="pendingDelete = []"
  >
    <template #footer>
      <button class="secondary-button" type="button" @click="pendingDelete = []">取消</button>
      <button class="danger-button" type="button" :disabled="deleteBusy" @click="confirmDelete">
        删除
      </button>
    </template>
  </AppDialog>
  <LoginDialog :open="loginDialog" @close="loginDialog = false" @success="loginDialog = false" />
</template>
