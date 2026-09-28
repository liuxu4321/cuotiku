<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  ArrowLeft,
  BookMarked,
  ExternalLink,
  Image,
  KeyRound,
  LayoutTemplate,
  Palette,
  Search,
  Wrench,
} from '@lucide/vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@renderer/stores/app'
import { useWorkspaceStore } from '@renderer/stores/workspace'
import { desktopAPI } from '@renderer/services/desktop-api'
import type { AppConfig } from '@shared/types'

type Section = 'layout' | 'image' | 'tencent' | 'book' | 'appearance' | 'advanced'
const app = useAppStore()
const workspace = useWorkspaceStore()
const router = useRouter()
const active = ref<Section>('layout')
const search = ref('')
const showSecret = ref(false)
const saved = ref(false)
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
  { id: 'tencent' as const, label: '腾讯云', keywords: '去手写 密钥 SecretId API', icon: KeyRound },
  { id: 'book' as const, label: '错题集', keywords: '保存位置 目录 数据库', icon: BookMarked },
  { id: 'appearance' as const, label: '外观', keywords: '主题 深色 浅色', icon: Palette },
  { id: 'advanced' as const, label: '高级', keywords: '日志 版本 更新', icon: Wrench },
]
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q
    ? sections.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(q))
    : sections
})
const title = computed(() => sections.find((item) => item.id === active.value)?.label ?? '设置')
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
          <button class="primary-button" @click="save">{{ saved ? '已保存' : '保存设置' }}</button>
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

        <section v-else-if="active === 'tencent'" class="preference-section">
          <h2>试卷手写擦除</h2>
          <div class="preference-group preference-form">
            <label
              ><span>SecretId</span
              ><input v-model.trim="draft.tencentSecretId" placeholder="腾讯云 API 密钥 ID"
            /></label>
            <label
              ><span>SecretKey</span
              ><input
                v-model="draft.tencentSecretKey"
                :type="showSecret ? 'text' : 'password'"
                placeholder="与 SecretId 配对的密钥"
            /></label>
            <label class="inline-check"
              ><input v-model="showSecret" type="checkbox" />显示密钥</label
            >
            <label class="preference-row"
              ><span
                ><strong>记住 SecretKey</strong><small>使用操作系统安全存储加密保存。</small></span
              ><input v-model="draft.rememberTencentSecretKey" class="switch-input" type="checkbox"
            /></label>
            <button
              class="doc-link"
              @click="
                desktopAPI.openExternal('https://cloud.tencent.com/document/product/866/133907')
              "
            >
              <ExternalLink :size="16" />查看腾讯云官方文档
            </button>
          </div>
        </section>

        <section v-else-if="active === 'book'" class="preference-section">
          <h2>错题集存储</h2>
          <div class="preference-group preference-form">
            <label
              ><span>保存位置</span
              ><input v-model.trim="draft.bookDir" placeholder="默认：~/.cuotiku"
            /></label>
            <button class="secondary-button" type="button" @click="chooseBookDir">选择目录…</button>
            <p class="preference-hint">
              错题图片与 SQLite 数据库（cuotiku.db）保存在该目录；未指定时使用 home
              目录下的隐藏文件夹 .cuotiku，旧的 index.json
              数据首次运行自动迁移，修改位置后仅影响新加入的错题。
            </p>
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

        <section v-else class="preference-section">
          <h2>诊断</h2>
          <div class="preference-group">
            <div class="preference-row">
              <span><strong>应用日志</strong><small>打开日志目录以便排查问题。</small></span
              ><button @click="desktopAPI.openLogDirectory">打开日志目录</button>
            </div>
            <dl class="runtime-details">
              <dt>版本</dt>
              <dd>{{ app.version }}</dd>
              <dt>平台</dt>
              <dd>{{ app.platformInfo?.name }} {{ app.platformInfo?.arch }}</dd>
              <dt>Electron</dt>
              <dd>{{ app.platformInfo?.versions.electron }}</dd>
            </dl>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
