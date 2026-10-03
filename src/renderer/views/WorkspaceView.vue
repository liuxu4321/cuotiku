<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  BookMarked,
  Crop,
  Eraser,
  FileCog,
  FileText,
  Hand,
  ImagePlus,
  Maximize,
  Minus,
  MousePointer2,
  Printer,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  ScanLine,
  Scissors,
  SlidersHorizontal,
  Trash2,
  Undo2,
  ZoomIn,
} from '@lucide/vue'
import PageHeader from '@renderer/components/PageHeader.vue'
import AppDialog from '@renderer/components/AppDialog.vue'
import AppLoading from '@renderer/components/AppLoading.vue'
import LoginDialog from '@renderer/components/LoginDialog.vue'
import PlanetDialog from '@renderer/components/PlanetDialog.vue'
import ScannerDialog from '@renderer/components/ScannerDialog.vue'
import SplitDialog from '@renderer/components/SplitDialog.vue'
import ImageCanvas from '@renderer/components/editor/ImageCanvas.vue'
import { friendlyError, useAppStore } from '@renderer/stores/app'
import { desktopAPI } from '@renderer/services/desktop-api'
import { PDF_PAGE_LIMIT, pdfErrorMessage, renderPdfPages } from '@renderer/services/pdf-import'
import { useAuthStore } from '@renderer/stores/auth'
import { useWorkspaceStore } from '@renderer/stores/workspace'
import { subjectsForGrade } from '@renderer/config/subjects'
import { THERMAL_SIZES } from '@shared/types'
import { svgToDataUrl, templateById, templates, type TemplateDefinition } from '@renderer/templates'
import type { ErrorType, SplitQuestion, Subject, Term } from '@shared/types'

const app = useAppStore()
const auth = useAuthStore()
const store = useWorkspaceStore()
const mode = ref<'select' | 'pan'>('select')
const layoutPopover = ref(false)
const canvas = ref<InstanceType<typeof ImageCanvas> | null>(null)
let refreshTimer = 0
const errorTypes: ErrorType[] = ['马虎', '不会', '概念不清', '其他']
const grade = computed(() => app.config.grade)
const term = computed(() => app.config.term)
const subject = computed(() => app.config.subject)
const gradeSubjects = computed(() => subjectsForGrade(grade.value))
const thermalLabel = computed(
  () => THERMAL_SIZES.find((size) => size.id === app.config.layout.thermalSize)?.label ?? '',
)
const templateName = computed(() => templateById(app.config.templateId).name)
const templateCards = computed(() => templateById(app.config.templateId).cardsPerPage)
const headMeta = computed(() => {
  const layout = app.config.layout
  const pages = store.pagePreview?.pages.length
  const scale =
    store.pagePreview && store.pagePreview.scalePercent < 100
      ? ` · 缩放 ${store.pagePreview.scalePercent}%`
      : ''
  const suffix = pages ? ` · ${pages} 页${scale}` : ''
  if (layout.printMode === 'thermal') return `热敏 ${thermalLabel.value} · 每题一页${suffix}`
  if (layout.printMode === 'template')
    return `模板 ${templateName.value} · 每页 ${templateCards.value} 卡${suffix}`
  const modeText =
    layout.mode === 'single'
      ? '单列'
      : layout.mode === 'double'
        ? '双列'
        : `自动 ${store.pagePreview?.columns ?? 1} 列`
  return `${layout.paper} · ${modeText}${suffix}`
})
const bookDialog = ref(false)
const pdfBusy = ref(false)
const pdfMessage = ref('')
const loadingMessage = computed(() =>
  pdfBusy.value
    ? pdfMessage.value
    : store.aiTask
      ? store.aiTaskMessage
      : store.enhancing
        ? store.enhanceMessage
        : store.eraseMessage,
)
const bookTypes = ref<ErrorType[]>([])
const bookAdded = ref(false)
const loginDialog = ref(false)
const planetDialog = ref(false)
const scannerDialog = ref(false)
const splitDialog = ref(false)
const splitQuestions = ref<SplitQuestion[]>([])
const splitPreview = ref('')
const pendingAction = ref<null | 'book' | 'save' | 'print'>(null)

function eraseGate(): void {
  if (!auth.loggedIn) {
    loginDialog.value = true
    return
  }
  void store.eraseAll()
}
function enhanceGate(): void {
  if (!auth.loggedIn) {
    loginDialog.value = true
    return
  }
  void store.enhanceAll()
}
async function splitGate(): Promise<void> {
  if (!auth.loggedIn) {
    loginDialog.value = true
    return
  }
  const result = await store.splitActive()
  if (!result) return
  if (!result.questions.length) {
    store.error = '未检测到题框，请手动框选。'
    return
  }
  openSplitDialog(result.questions)
}
async function paperGate(): Promise<void> {
  if (!auth.loggedIn) {
    loginDialog.value = true
    return
  }
  const result = await store.processPaper()
  if (!result) return
  if (!result.questions.length) {
    store.error = '试卷处理完成，但未检测到题框，请手动框选。'
    return
  }
  openSplitDialog(result.questions)
}
function openSplitDialog(questions: SplitQuestion[]): void {
  splitQuestions.value = questions
  splitPreview.value = store.activeImage?.previewDataUrl ?? ''
  splitDialog.value = true
}
function confirmSplit(pickedQuestions: SplitQuestion[]): void {
  const image = store.activeImage
  if (!image) return
  store.setSelections(
    pickedQuestions.map((question) => ({
      id: crypto.randomUUID(),
      imageId: image.id,
      x: question.nx,
      y: question.ny,
      width: question.nWidth,
      height: question.nHeight,
    })),
  )
  splitDialog.value = false
}
function runAction(action: 'book' | 'save' | 'print'): void {
  if (action === 'book') openBookDialog()
  else if (action === 'save') void store.save()
  else void store.print()
}
function gate(action: 'book' | 'save' | 'print'): void {
  if (auth.loggedIn) {
    runAction(action)
    return
  }
  if (action === 'book') {
    pendingAction.value = action
    loginDialog.value = true
    return
  }
  pendingAction.value = action
  planetDialog.value = true
}
function addToBookGate(): void {
  gate('book')
}
function saveGate(): void {
  gate('save')
}
function printGate(): void {
  gate('print')
}
function onPlanetClose(): void {
  planetDialog.value = false
  const action = pendingAction.value
  pendingAction.value = null
  if (action === 'save' || action === 'print') runAction(action)
}
function onLoginSuccess(): void {
  loginDialog.value = false
  const action = pendingAction.value
  pendingAction.value = null
  if (action === 'book') openBookDialog()
}

watch(
  () => store.revision,
  () => {
    window.clearTimeout(refreshTimer)
    refreshTimer = window.setTimeout(() => {
      void store.refreshCrops()
    }, 280)
  },
)
watch(
  [() => app.config.layout, () => app.config.templateId],
  () => {
    void store.refreshPagePreview()
  },
  { deep: true },
)
watch(grade, (value) => {
  const list = subjectsForGrade(value)
  if (!list.includes(subject.value)) void subjectInput(list[0]!)
})
onBeforeUnmount(() => window.clearTimeout(refreshTimer))

function templateThumb(tpl: TemplateDefinition): string {
  const w = 36
  const h = 50
  const margin = 3
  const gap = 3
  const rows = tpl.cardsPerPage
  const cw = w - margin * 2
  const ch = (h - margin * 2 - gap * (rows - 1)) / rows
  const cells: string[] = []
  for (let i = 0; i < rows; i += 1) {
    cells.push(
      `<rect x="${margin}" y="${margin + i * (ch + gap)}" width="${cw}" height="${ch}" rx="1" fill="none" stroke="#8a8f98" stroke-width="1"/>`,
    )
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="#ffffff" stroke="#c8ccd2" stroke-width="1"/>` +
    cells.join('') +
    `</svg>`
  return svgToDataUrl(svg)
}

const templateRows = computed(() =>
  (['B5', 'A4'] as const).map((paper) => ({
    paper,
    items: templates.filter((tpl) => tpl.paper === paper),
  })),
)

async function pickTemplate(tpl: TemplateDefinition): Promise<void> {
  layoutPopover.value = false
  if (tpl.id === app.config.templateId && app.config.layout.printMode === 'template') return
  try {
    await app.saveConfig({
      ...app.config,
      templateId: tpl.id,
      layout: { ...app.config.layout, paper: tpl.paper, printMode: 'template' },
    })
  } catch (error) {
    store.error = friendlyError(error)
  }
}

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
function scannerImport(): void {
  scannerDialog.value = true
}
async function importPdf(): Promise<void> {
  if (pdfBusy.value) return
  pdfBusy.value = true
  pdfMessage.value = '正在读取 PDF…'
  store.error = null
  try {
    const file = await desktopAPI.selectPdf()
    if (!file) return
    const { dataUrls, truncated } = await renderPdfPages(file.bytes, (index, total) => {
      pdfMessage.value = `正在解析 PDF ${index}/${total} 页…`
    })
    for (const [index, dataUrl] of dataUrls.entries()) {
      await store.addScannerImage(dataUrl, `p${index + 1}`)
    }
    if (truncated) {
      store.error = `PDF 页数超过上限 ${PDF_PAGE_LIMIT}，仅导入前 ${PDF_PAGE_LIMIT} 页。`
    }
  } catch (error) {
    store.error = pdfErrorMessage(error) ?? friendlyError(error)
  } finally {
    pdfBusy.value = false
    pdfMessage.value = ''
  }
}
function zoomIn(): void {
  canvas.value?.zoomBy(1.2)
}
function fitView(): void {
  canvas.value?.resetView()
}
async function gradeInput(event: Event): Promise<void> {
  const value = Number((event.target as HTMLSelectElement).value)
  try {
    await app.setGrade(value)
  } catch (error) {
    store.error = friendlyError(error)
  }
}
async function termInput(event: Event): Promise<void> {
  const value = Number((event.target as HTMLSelectElement).value) as Term
  try {
    await app.setTerm(value)
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
    <div
      v-if="store.enhancing || store.erasing || store.aiTask || pdfBusy"
      class="app-loading-mask"
      role="status"
    >
      <AppLoading
        class="app-loading-card"
        :title="loadingMessage"
        description="正在处理图片，请稍候，勿关闭应用。"
      />
    </div>
    <PageHeader title="集腋成裘">
      <template #title>
        <h1>集腋成裘</h1>
        <select class="inline-select" :value="grade" aria-label="年级" @change="gradeInput">
          <option v-for="item in 12" :key="item" :value="item">{{ item }}年级</option>
        </select>
        <select class="inline-select" :value="term" aria-label="学期" @change="termInput">
          <option :value="1">上学期</option>
          <option :value="2">下学期</option>
        </select>
        <span class="segmented header-subjects">
          <button
            v-for="item in gradeSubjects"
            :key="item"
            type="button"
            :class="{ active: subject === item }"
            :data-tip="item"
            :aria-label="item"
            @click="subjectInput(item)"
          >
            {{ item }}
          </button>
        </span>
      </template>
    </PageHeader>

    <div v-if="store.error" class="workspace-alert">
      <span>{{ store.error }}</span
      ><button type="button" @click="store.error = null">关闭</button>
    </div>
    <div class="editor-toolbar">
      <button
        class="primary-button icon-action"
        type="button"
        data-tip="导入本地图片"
        aria-label="导入本地图片"
        @click="store.importImages"
      >
        <ImagePlus :size="17" />
      </button>
      <button
        class="primary-button icon-action"
        type="button"
        data-tip="高拍仪导入"
        aria-label="高拍仪导入"
        @click="scannerImport"
      >
        <ScanLine :size="17" />
      </button>
      <button
        class="primary-button icon-action"
        type="button"
        data-tip="导入 PDF"
        aria-label="导入 PDF"
        :disabled="pdfBusy"
        @click="importPdf"
      >
        <FileText :size="17" />
      </button>
      <span class="toolbar-divider" />
      <div class="segmented">
        <button
          class="icon-action"
          type="button"
          :class="{ active: mode === 'select' }"
          data-tip="框选/调整"
          aria-label="框选/调整"
          @click="mode = 'select'"
        >
          <MousePointer2 :size="16" />
        </button>
        <button
          class="icon-action"
          type="button"
          :class="{ active: mode === 'pan' }"
          data-tip="移动图片"
          aria-label="移动图片"
          @click="mode = 'pan'"
        >
          <Hand :size="16" />
        </button>
      </div>
      <span class="toolbar-divider" />
      <button
        class="icon-action"
        type="button"
        :disabled="
          !store.images.length ||
          store.enhancing ||
          store.erasing ||
          store.outputBusy !== null ||
          (auth.loggedIn && !auth.aiEnabled)
        "
        :data-tip="auth.loggedIn && !auth.aiEnabled ? '当前账号未开通 AI 权限' : '切边增强'"
        aria-label="切边增强"
        @click="enhanceGate"
      >
        <RefreshCw v-if="store.enhancing" :size="17" class="spinning" />
        <Crop v-else :size="17" />
      </button>
      <button
        class="icon-action"
        type="button"
        :disabled="
          !store.images.length ||
          store.enhancing ||
          store.erasing ||
          store.outputBusy !== null ||
          (auth.loggedIn && !auth.aiEnabled)
        "
        :data-tip="auth.loggedIn && !auth.aiEnabled ? '当前账号未开通 AI 权限' : '去手写'"
        aria-label="去手写"
        @click="eraseGate"
      >
        <RefreshCw v-if="store.erasing" :size="17" class="spinning" />
        <Eraser v-else :size="17" />
      </button>
      <button
        class="icon-action"
        type="button"
        :disabled="
          !store.activeImage ||
          store.enhancing ||
          store.erasing ||
          store.aiTask !== null ||
          store.outputBusy !== null ||
          (auth.loggedIn && !auth.aiEnabled)
        "
        :data-tip="auth.loggedIn && !auth.aiEnabled ? '当前账号未开通 AI 权限' : '切题'"
        aria-label="切题"
        @click="splitGate"
      >
        <Scissors :size="17" />
      </button>
      <button
        class="icon-action"
        type="button"
        :disabled="
          !store.activeImage ||
          store.enhancing ||
          store.erasing ||
          store.aiTask !== null ||
          store.outputBusy !== null ||
          (auth.loggedIn && !auth.aiEnabled)
        "
        :data-tip="auth.loggedIn && !auth.aiEnabled ? '当前账号未开通 AI 权限' : '试卷处理'"
        aria-label="试卷处理"
        @click="paperGate"
      >
        <FileCog :size="17" />
      </button>
      <button class="icon-action" data-tip="缩小" aria-label="缩小" @click="zoomOut">
        <Minus :size="17" />
      </button>
      <button class="icon-action" data-tip="放大" aria-label="放大" @click="zoomIn">
        <ZoomIn :size="17" />
      </button>
      <button
        class="icon-action"
        data-tip="向左旋转 90°"
        aria-label="向左旋转 90°"
        @click="store.rotateQuarter(-1)"
      >
        <RotateCcw :size="17" />
      </button>
      <button
        class="icon-action"
        data-tip="向右旋转 90°"
        aria-label="向右旋转 90°"
        @click="store.rotateQuarter(1)"
      >
        <RotateCw :size="17" />
      </button>
      <button class="icon-action" data-tip="适合窗口" aria-label="适合窗口" @click="fitView">
        <Maximize :size="17" />
      </button>
      <span class="toolbar-divider" />
      <button
        class="icon-action"
        data-tip="撤销框选"
        aria-label="撤销框选"
        :disabled="!store.activeImage?.selections.length"
        @click="undoSelection"
      >
        <Undo2 :size="16" />
      </button>
      <button
        class="icon-action"
        data-tip="清空选框"
        aria-label="清空选框"
        :disabled="!store.activeImage?.selections.length"
        @click="clearSelections"
      >
        <Trash2 :size="16" />
      </button>
      <div class="toolbar-actions">
        <button
          class="solid-action icon-action"
          type="button"
          :disabled="!store.result || store.enhancing || store.erasing || store.outputBusy !== null"
          :data-tip="bookAdded ? '已加入错题集' : '加入错题集'"
          aria-label="加入错题集"
          @click="addToBookGate"
        >
          <BookMarked :size="16" />
        </button>
        <button
          class="solid-action icon-action"
          type="button"
          :disabled="!store.result || store.enhancing || store.erasing || store.outputBusy !== null"
          :data-tip="store.outputBusy === 'save' ? '正在保存…' : '保存图片'"
          aria-label="保存图片"
          @click="saveGate"
        >
          <Save :size="16" />
        </button>
        <button
          class="solid-action icon-action"
          type="button"
          :disabled="!store.result || store.enhancing || store.erasing || store.outputBusy !== null"
          :data-tip="store.outputBusy === 'print' ? '正在打印…' : '打印'"
          aria-label="打印"
          @click="printGate"
        >
          <Printer :size="16" />
        </button>
        <span class="layout-popover-host">
          <button
            class="solid-action icon-action"
            type="button"
            :data-tip="layoutPopover ? '关闭模板选择' : '排版与模板'"
            aria-label="排版与模板"
            @click="layoutPopover = !layoutPopover"
          >
            <SlidersHorizontal :size="16" />
          </button>
          <div v-if="layoutPopover" class="popover-backdrop" @click="layoutPopover = false" />
          <div v-if="layoutPopover" class="layout-popover">
            <div class="layout-popover-rows">
              <div v-for="row in templateRows" :key="row.paper" class="layout-popover-row">
                <span class="layout-row-label">{{ row.paper }}</span>
                <button
                  v-for="tpl in row.items"
                  :key="tpl.id"
                  type="button"
                  class="layout-thumb"
                  :class="{
                    active:
                      tpl.id === app.config.templateId &&
                      app.config.layout.printMode === 'template',
                  }"
                  :title="`${tpl.name} · 每页 ${tpl.cardsPerPage} 卡`"
                  @click="pickTemplate(tpl)"
                >
                  <img :src="templateThumb(tpl)" :alt="tpl.name" />
                </button>
              </div>
            </div>
          </div>
        </span>
      </div>
    </div>

    <div class="workspace-grid">
      <aside class="source-panel">
        <div class="panel-heading">
          <strong>错题照片</strong><span>{{ store.images.length }}</span>
        </div>
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
          <strong>预览</strong>
          <span class="paper-head-meta">{{ headMeta }}</span>
        </div>
        <div class="page-preview" :class="{ stale: store.resultStale }">
          <div v-if="!store.pagePreview" class="panel-empty">框选后自动生成排版预览</div>
          <template v-else>
            <img
              v-for="(page, index) in store.pagePreview.pages"
              :key="index"
              :src="page"
              :alt="`排版预览第 ${index + 1} 页`"
            />
          </template>
        </div>
      </aside>
    </div>
    <LoginDialog :open="loginDialog" @close="loginDialog = false" @success="onLoginSuccess" />
    <PlanetDialog :open="planetDialog" @close="onPlanetClose" />
    <ScannerDialog :open="scannerDialog" @close="scannerDialog = false" />
    <SplitDialog
      :open="splitDialog"
      :questions="splitQuestions"
      :preview-url="splitPreview"
      @close="splitDialog = false"
      @confirm="confirmSplit"
    />
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
