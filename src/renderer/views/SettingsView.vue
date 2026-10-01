<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ArrowLeft, Database, Image, KeyRound, LayoutTemplate, Palette, Search } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { friendlyError, useAppStore } from '@renderer/stores/app'
import { useAuthStore } from '@renderer/stores/auth'
import { useWorkspaceStore } from '@renderer/stores/workspace'
import { desktopAPI } from '@renderer/services/desktop-api'
import LoginDialog from '@renderer/components/LoginDialog.vue'
import { svgToDataUrl, templates, type TemplateDefinition } from '@renderer/templates'
import { THERMAL_SIZES } from '@shared/types'
import type { AppConfig, PrinterInfo } from '@shared/types'

type Section = 'layout' | 'image' | 'account' | 'book' | 'appearance'
const app = useAppStore()
const auth = useAuthStore()
const workspace = useWorkspaceStore()
const router = useRouter()
const active = ref<Section>('layout')
const search = ref('')
const saved = ref(false)
const loginDialog = ref(false)
const authError = ref('')
const printers = ref<PrinterInfo[]>([])
const draft = reactive<AppConfig>(cloneConfig(app.config))
watch(
  () => app.config,
  (value) => Object.assign(draft, cloneConfig(value)),
  { deep: true },
)
const sections = [
  {
    id: 'layout' as const,
    label: '排版',
    keywords: '列 间距 页边距',
    icon: LayoutTemplate,
  },
  { id: 'image' as const, label: '图像处理', keywords: '清晰度 锐化 增强', icon: Image },
  {
    id: 'account' as const,
    label: '账号',
    keywords: '登录 服务器 知识星球 授权',
    icon: KeyRound,
  },
  {
    id: 'book' as const,
    label: '数据存储',
    keywords: '临时数据 保存位置 目录 数据库',
    icon: Database,
  },
  { id: 'appearance' as const, label: '外观', keywords: '主题 深色 浅色', icon: Palette },
]
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q
    ? sections.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(q))
    : sections
})
const title = computed(() => sections.find((item) => item.id === active.value)?.label ?? '设置')
const showSave = computed(() => active.value !== 'account')
async function save(): Promise<void> {
  await app.saveConfig(cloneConfig(draft))
  await workspace.refreshCrops()
  saved.value = true
  window.setTimeout(() => {
    saved.value = false
  }, 1600)
}
function cloneConfig(value: AppConfig): AppConfig {
  return { ...value, layout: { ...value.layout }, processing: { ...value.processing } }
}
async function chooseBookDir(): Promise<void> {
  const dir = await desktopAPI.selectDirectory()
  if (dir) draft.bookDir = dir
}
async function loadPrinters(): Promise<void> {
  try {
    printers.value = await desktopAPI.listPrinters()
  } catch {
    printers.value = []
  }
}
function templatePreview(tpl: TemplateDefinition): string {
  return svgToDataUrl(tpl.buildPages([])[0] ?? '')
}
onMounted(() => {
  void loadPrinters()
})
async function logout(): Promise<void> {
  authError.value = ''
  try {
    await auth.logout()
  } catch (error) {
    authError.value = friendlyError(error)
  }
}
</script>

<template>
  <div class="preferences-page">
    <aside class="preferences-sidebar">
      <button class="preferences-back" @click="router.push('/')">
        <ArrowLeft :size="19" />返回工作台
      </button>
      <label class="preferences-search"
        ><Search :size="17" /><input v-model="search" type="search" placeholder="搜索设置"
      /></label>
      <nav class="preferences-nav">
        <button
          v-for="item in filtered"
          :key="item.id"
          :class="{ active: active === item.id }"
          @click="active = item.id"
        >
          <component :is="item.icon" :size="18" /><span>{{ item.label }}</span>
        </button>
      </nav>
    </aside>
    <main class="preferences-main">
      <div class="preferences-main-inner">
        <div class="settings-title">
          <div>
            <h1>{{ title }}</h1>
            <p>设置保存后立即应用到错题预览和输出。</p>
          </div>
          <button v-if="showSave" class="primary-button" @click="save">
            {{ saved ? '已保存' : '保存设置' }}
          </button>
        </div>

        <section v-if="active === 'layout'" class="preference-section">
          <h2>页面排版</h2>
          <div class="preference-group">
            <label class="preference-row"
              ><span><strong>排版方式</strong><small>自动模式会根据题目形状选择列数。</small></span
              ><select v-model="draft.layout.mode">
                <option value="auto">自动</option>
                <option value="single">单列</option>
                <option value="double">双列</option>
              </select></label
            >
            <label class="preference-row"
              ><span
                ><strong>打印方式</strong
                ><small>普通纸按排版列数打印；热敏纸每题一页。</small></span
              ><select v-model="draft.layout.printMode">
                <option value="normal">普通纸</option>
                <option value="thermal">热敏纸</option>
                <option value="template">模板打印</option>
              </select></label
            >
            <label v-if="draft.layout.printMode === 'normal'" class="preference-row"
              ><span><strong>纸张大小</strong><small>普通纸排版纸张。</small></span
              ><select v-model="draft.layout.paper">
                <option value="A4">A4</option>
                <option value="B5">B5</option>
              </select></label
            >
            <label v-else-if="draft.layout.printMode === 'thermal'" class="preference-row"
              ><span><strong>热敏纸尺寸</strong><small>常用热敏纸规格，每题打印一页。</small></span
              ><select v-model="draft.layout.thermalSize">
                <option v-for="size in THERMAL_SIZES" :key="size.id" :value="size.id">
                  {{ size.label }}
                </option>
              </select></label
            >
            <template v-if="draft.layout.printMode === 'thermal'">
              <label class="preference-row"
                ><span
                  ><strong>热敏打印机</strong
                  ><small>留空则按打印机名称自动识别热敏打印机。</small></span
                ><select v-model="draft.thermalPrinter">
                  <option value="">自动识别</option>
                  <option v-for="item in printers" :key="item.name" :value="item.name">
                    {{ item.displayName || item.name }}{{ item.isDefault ? '（默认）' : '' }}
                  </option>
                </select></label
              >
              <button class="secondary-button" type="button" @click="loadPrinters">
                刷新打印机列表
              </button>
            </template>
            <label class="preference-row"
              ><span><strong>题目间距</strong><small>相邻错题之间的留白。</small></span>
              <div class="number-field">
                <input v-model.number="draft.layout.gapMm" type="number" min="2" max="20" /><span
                  >mm</span
                >
              </div></label
            >
            <label class="preference-row"
              ><span><strong>页边距</strong><small>页面四周留白。</small></span>
              <div class="number-field">
                <input v-model.number="draft.layout.marginMm" type="number" min="5" max="25" /><span
                  >mm</span
                >
              </div></label
            >
            <div v-if="draft.layout.printMode === 'template'" class="template-picker">
              <button
                v-for="tpl in templates"
                :key="tpl.id"
                type="button"
                class="template-card"
                :class="{ active: draft.templateId === tpl.id }"
                @click="draft.templateId = tpl.id"
              >
                <img :src="templatePreview(tpl)" alt="" />
                <strong>{{ tpl.name }}</strong>
                <small>{{ tpl.description }}</small>
              </button>
            </div>
          </div>
        </section>

        <section v-else-if="active === 'image'" class="preference-section">
          <h2>打印图像</h2>
          <div class="preference-group">
            <label class="preference-row"
              ><span><strong>启用清晰度增强</strong><small>轻微增强文字对比度和边缘。</small></span
              ><input v-model="draft.processing.enhance" class="switch-input" type="checkbox"
            /></label>
            <label class="preference-row preference-row-stacked"
              ><span
                ><strong>增强强度：{{ draft.processing.enhanceStrength }}</strong
                ><small>建议保持在 40–65。</small></span
              ><input
                v-model.number="draft.processing.enhanceStrength"
                type="range"
                min="0"
                max="100"
                :disabled="!draft.processing.enhance"
            /></label>
          </div>
        </section>

        <section v-else-if="active === 'account'" class="preference-section">
          <h2>账号</h2>
          <div class="preference-group preference-form">
            <div v-if="auth.session" class="account-state">
              <p>账号：{{ auth.session.phone }}</p>
              <p>会员号：{{ auth.session.memberNo || '未绑定' }}</p>
              <p>
                有效期至：{{ auth.session.tokenExpiresAt || '静默续期中（30 天内使用自动续期）' }}
              </p>
              <button class="secondary-button" type="button" @click="logout">退出登录</button>
            </div>
            <div v-else class="account-state">
              <p>
                登录后权益：会员期内免费使用 AI
                去手写与组卷打印、免费升级新版本与排版模板、免费一对一技术咨询。
              </p>
              <button class="primary-button" type="button" @click="loginDialog = true">登录</button>
            </div>
            <p v-if="authError" class="login-error">{{ authError }}</p>
          </div>
        </section>

        <section v-else-if="active === 'book'" class="preference-section">
          <h2>数据存储</h2>
          <div class="preference-group preference-form">
            <label
              ><span>临时数据存储目录</span
              ><input v-model.trim="draft.bookDir" placeholder="默认：~/.cuotiku"
            /></label>
            <button class="secondary-button" type="button" @click="chooseBookDir">选择目录…</button>
          </div>
        </section>

        <section v-else-if="active === 'appearance'" class="preference-section">
          <h2>颜色模式</h2>
          <div class="preference-group">
            <div class="preference-row preference-row-stacked">
              <span><strong>主题</strong><small>选择浅色、深色或跟随系统。</small></span>
              <div class="segmented">
                <button
                  v-for="theme in [
                    { v: 'light', l: '浅色' },
                    { v: 'dark', l: '深色' },
                    { v: 'system', l: '跟随系统' },
                  ]"
                  :key="theme.v"
                  :class="{ active: draft.theme === theme.v }"
                  @click="draft.theme = theme.v as AppConfig['theme']"
                >
                  {{ theme.l }}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
    <LoginDialog :open="loginDialog" @close="loginDialog = false" @success="loginDialog = false" />
  </div>
</template>
