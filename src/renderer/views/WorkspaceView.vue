<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  BookMarked,
  BookOpen,
  Calculator,
  Eraser,
  Hand,
  ImagePlus,
  Languages,
  Maximize,
  Minus,
  MousePointer2,
  Printer,
  RotateCcw,
  RotateCw,
  Save,
  Trash2,
  Undo2,
  ZoomIn,
} from '@lucide/vue'
import PageHeader from '@renderer/components/PageHeader.vue'
import AppDialog from '@renderer/components/AppDialog.vue'
import ImageCanvas from '@renderer/components/editor/ImageCanvas.vue'
import { friendlyError, useAppStore } from '@renderer/stores/app'
import { useWorkspaceStore } from '@renderer/stores/workspace'
import type { ErrorType, Subject } from '@shared/types'

const app = useAppStore()
const store = useWorkspaceStore()
const mode = ref<'select' | 'pan'>('select')
const canvas = ref<InstanceType<typeof ImageCanvas> | null>(null)
let refreshTimer = 0
const errorTypes: ErrorType[] = ['马虎', '不会', '概念不清', '其他']
const eraseLabel = computed(() =>
  store.busy ? '正在去手写…' : store.isErased ? '已去手写' : '去手写',
)
const grade = computed(() => app.config.grade)
const subject = computed(() => app.config.subject)
const bookDialog = ref(false)
const bookTypes = ref<ErrorType[]>([])
const bookAdded = ref(false)

watch(
  () => store.revision,
  () => {
    window.clearTimeout(refreshTimer)
    refreshTimer = window.setTimeout(() => {
      void store.refreshCrops()
    }, 280)
  },
)
onBeforeUnmount(() => window.clearTimeout(refreshTimer))

function undoSelection(): void {
  if (!store.activeImage) return
  store.setSelections(store.activeImage.selections.slice(0, -1))
}
function clearSelections(): void {
  if (store.activeImage) store.setSelections([])
}
function angleInput(event: Event): void {
  store.setFineAngle(Number((event.target as HTMLInputElement).value))
}
function zoomOut(): void {
  canvas.value?.zoomBy(1 / 1.2)
}
function zoomIn(): void {
  canvas.value?.zoomBy(1.2)
}
function fitView(): void {
  canvas.value?.resetView()
}
async function gradeInput(event: Event): Promise<void> {
  const value = Number((event.target as HTMLSelectElement).value)
  if (value === grade.value) return
  try {
    await app.saveConfig({ ...app.config, grade: value })
  } catch (error) {
    store.error = friendlyError(error)
  }
}
async function subjectInput(value: Subject): Promise<void> {
  if (value === subject.value) return
  try {
    await app.saveConfig({ ...app.config, subject: value })
  } catch (error) {
    store.error = friendlyError(error)
  }
}
function openBookDialog(): void {
  if (!store.result) return
  bookTypes.value = store.result.crops.map(() => '马虎')
  bookDialog.value = true
}
async function confirmAddToBook(): Promise<void> {
  try {
    await store.addToBook(bookTypes.value)
    bookDialog.value = false
    bookAdded.value = true
    window.setTimeout(() => {
      bookAdded.value = false
    }, 1600)
  } catch (error) {
    store.error = friendlyError(error)
  }
}
</script>

<template>
  <section class="workspace-page">
    <PageHeader title="错题收集" description="导入照片，旋转校正后框选错题">
      <template #title>
        <h1>错题收集</h1>
        <select class="inline-select" :value="grade" aria-label="年级" @change="gradeInput">
          <option v-for="item in 9" :key="item" :value="item">{{ item }}年级</option>
        </select>
      </template>
    </PageHeader>

    <div v-if="store.error" class="workspace-alert">
      <span>{{ store.error }}</span
      ><button type="button" @click="store.error = null">关闭</button>
    </div>
    <div class="editor-toolbar">
      <div class="segmented">
        <button
          type="button"
          :class="{ active: subject === '语文' }"
          title="语文"
          aria-label="语文"
          @click="subjectInput('语文')"
        >
          <BookOpen :size="16" />语文
        </button>
        <button
          type="button"
          :class="{ active: subject === '数学' }"
          title="数学"
          aria-label="数学"
          @click="subjectInput('数学')"
        >
          <Calculator :size="16" />数学
        </button>
        <button
          type="button"
          :class="{ active: subject === '英语' }"
          title="英语"
          aria-label="英语"
          @click="subjectInput('英语')"
        >
          <Languages :size="16" />英语
        </button>
      </div>
      <span class="toolbar-divider" />
      <button
        class="primary-button icon-action"
        type="button"
        title="导入图片"
        aria-label="导入图片"
        @click="store.importImages"
      >
        <ImagePlus :size="17" />
      </button>
      <span class="toolbar-divider" />
      <div class="segmented">
        <button
          type="button"
          :class="{ active: mode === 'select' }"
          title="框选/调整"
          aria-label="框选/调整"
          @click="mode = 'select'"
        >
          <MousePointer2 :size="16" />
        </button>
        <button
          type="button"
          :class="{ active: mode === 'pan' }"
          title="移动图片"
          aria-label="移动图片"
          @click="mode = 'pan'"
        >
          <Hand :size="16" />
        </button>
      </div>
      <span class="toolbar-divider" />
      <button class="icon-action" title="缩小" @click="zoomOut"><Minus :size="17" /></button>
      <button class="icon-action" title="放大" @click="zoomIn"><ZoomIn :size="17" /></button>
      <button class="icon-action" title="向左旋转 90°" @click="store.rotateQuarter(-1)">
        <RotateCcw :size="17" />
      </button>
      <button class="icon-action" title="向右旋转 90°" @click="store.rotateQuarter(1)">
        <RotateCw :size="17" />
      </button>
      <button class="icon-action" title="适合窗口" aria-label="适合窗口" @click="fitView">
        <Maximize :size="17" />
      </button>
      <span class="toolbar-divider" />
      <button
        class="icon-action"
        title="撤销框选"
        aria-label="撤销框选"
        :disabled="!store.activeImage?.selections.length"
        @click="undoSelection"
      >
        <Undo2 :size="16" />
      </button>
      <button
        class="icon-action"
        title="清空选框"
        aria-label="清空选框"
        :disabled="!store.activeImage?.selections.length"
        @click="clearSelections"
      >
        <Trash2 :size="16" />
      </button>
      <div class="toolbar-actions">
        <button
          class="solid-action"
          type="button"
          :disabled="!store.questionCount || store.busy || store.isErased"
          @click="store.erase"
        >
          <Eraser :size="17" />{{ eraseLabel }}
        </button>
        <button
          class="solid-action"
          type="button"
          :disabled="!store.result || store.busy || store.outputBusy !== null"
          @click="openBookDialog"
        >
          <BookMarked :size="17" />{{ bookAdded ? '已加入' : '加入错题集' }}
        </button>
        <button
          class="solid-action"
          type="button"
          :disabled="!store.result || store.busy || store.outputBusy !== null"
          @click="store.save"
        >
          <Save :size="17" />{{ store.outputBusy === 'save' ? '正在保存…' : '保存图片' }}
        </button>
        <button
          class="solid-action"
          type="button"
          :disabled="!store.result || store.busy || store.outputBusy !== null"
          @click="store.print"
        >
          <Printer :size="17" />{{ store.outputBusy === 'print' ? '正在打印…' : '打印' }}
        </button>
      </div>
    </div>

    <div class="workspace-grid">
      <aside class="source-panel">
        <div class="panel-heading">
          <strong>错题照片</strong><span>{{ store.images.length }}</span>
        </div>
        <button
          v-if="!store.images.length"
          class="empty-import"
          type="button"
          @click="store.importImages"
        >
          <ImagePlus :size="24" /><span>导入图片</span>
        </button>
        <button
          v-for="image in store.images"
          :key="image.id"
          class="source-item"
          :class="{ active: image.id === store.activeImageId }"
          type="button"
          @click="store.activeImageId = image.id"
        >
          <img :src="image.previewDataUrl" alt="" /><span
            ><strong>{{ image.name }}</strong
            ><small>{{ image.selections.length }} 个选框</small></span
          >
          <Trash2 class="source-remove" :size="15" @click.stop="store.removeImage(image.id)" />
        </button>
      </aside>

      <main class="canvas-panel">
        <ImageCanvas
          ref="canvas"
          :image="store.activeImage"
          :mode="mode"
          @update:selections="store.setSelections"
        />
        <div class="rotation-control" :class="{ disabled: !store.activeImage }">
          <span>−45°</span
          ><input
            :value="store.activeImage?.fineAngle ?? 0"
            type="range"
            min="-45"
            max="45"
            step="1"
            :disabled="!store.activeImage"
            @input="angleInput"
          />
          <span>+45°</span><output>{{ store.activeImage?.fineAngle ?? 0 }}°</output>
          <button type="button" :disabled="!store.activeImage" @click="store.setFineAngle(0)">
            归零
          </button>
        </div>
      </main>

      <aside class="preview-panel">
        <div class="panel-heading paper-heading">
          <strong>纸张预览</strong>
        </div>
        <div class="page-preview" :class="{ stale: store.resultStale }">
          <div v-if="!store.pagePreview" class="panel-empty">框选后自动生成排版预览</div>
          <template v-else
            ><div class="page-meta">
              {{ store.pagePreview.columns }} 列 · {{ store.pagePreview.pages.length }} 页<span
                v-if="store.pagePreview.scalePercent < 100"
              >
                · 缩放 {{ store.pagePreview.scalePercent }}%</span
              >
            </div>
            <img
              v-for="(page, index) in store.pagePreview.pages"
              :key="index"
              :src="page"
              :alt="`排版预览第 ${index + 1} 页`"
          /></template>
        </div>
      </aside>
    </div>
    <AppDialog
      :open="bookDialog"
      title="加入错题集"
      description="为每个错题选择错误类型，保存后可在错题集中筛选。"
      @close="bookDialog = false"
    >
      <div class="book-pick-list">
        <div v-for="(crop, index) in store.result?.crops ?? []" :key="crop.id" class="book-pick">
          <img :src="crop.dataUrl" alt="错题预览" />
          <label class="book-pick-label">
            <span>错误类型</span>
            <select v-model="bookTypes[index]" aria-label="错误类型">
              <option v-for="item in errorTypes" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>
        </div>
      </div>
      <template #footer>
        <button class="secondary-button" type="button" @click="bookDialog = false">取消</button>
        <button class="primary-button" type="button" @click="confirmAddToBook">保存</button>
      </template>
    </AppDialog>
  </section>
</template>
