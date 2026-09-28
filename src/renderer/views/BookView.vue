<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Printer, Trash2 } from '@lucide/vue'
import PageHeader from '@renderer/components/PageHeader.vue'
import { useBookStore } from '@renderer/stores/book'
import type { ErrorType, PaperSize, Subject } from '@shared/types'

const store = useBookStore()
const subjectFilter = ref<Subject | '全部'>('全部')
const errorTypeFilter = ref<ErrorType | '全部'>('全部')
const selected = ref<string[]>([])
const paper = ref<PaperSize>('A4')
let previewTimer = 0

const subjects: Array<Subject | '全部'> = ['全部', '语文', '数学', '英语']
const errorTypes: Array<ErrorType | '全部'> = ['全部', '马虎', '不会', '概念不清', '其他']

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
  () => [selected.value.slice(), paper.value],
  () => {
    window.clearTimeout(previewTimer)
    previewTimer = window.setTimeout(() => {
      void store.refreshPreview(selected.value, paper.value)
    }, 300)
  },
  { deep: true },
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
function printBook(): void {
  void store.printBook(selected.value, paper.value)
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
            <button type="button" :disabled="!selected.length || store.printing" @click="printBook">
              <Printer :size="16" />{{ store.printing ? '打印中…' : '打印' }}
            </button>
          </span>
        </div>
        <div v-if="!store.preview" class="panel-empty book-empty">
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
  </section>
</template>
