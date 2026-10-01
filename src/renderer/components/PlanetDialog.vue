<script setup lang="ts">
import { BadgeCheck, ExternalLink } from '@lucide/vue'
import AppDialog from './AppDialog.vue'
import { useAppStore } from '@renderer/stores/app'
import { desktopAPI } from '@renderer/services/desktop-api'
import planetQr from '@renderer/assets/planet-qr.jpg'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const app = useAppStore()
const benefits = [
  '会员期内免费使用 AI 去手写与组卷打印',
  '会员期内免费升级新版本与排版模板',
  '免费一对一技术咨询与使用指导',
  '专属错题资料与新功能优先体验',
]

function openPlanet(): void {
  const url = app.runtimeConfig?.planetUrl.trim() ?? ''
  if (url) void desktopAPI.openExternal(url)
}
</script>

<template>
  <AppDialog
    :open="open"
    wide
    title="加入知识星球「拾星错题本」"
    description="基础功能免费；加入星球开通会员后即可使用完整功能。"
    @close="emit('close')"
  >
    <div class="login-split">
      <div class="login-promo">
        <strong>扫码加入知识星球</strong>
        <img class="login-qr" :src="planetQr" alt="知识星球二维码" />
        <ol>
          <li>扫码或搜索「拾星错题本」加入知识星球。</li>
          <li>在星球内私信管理员你的手机号。</li>
          <li>管理员开通账号后，在桌面端登录使用会员功能。</li>
        </ol>
        <button
          v-if="app.runtimeConfig?.planetUrl"
          type="button"
          class="primary-button"
          @click="openPlanet"
        >
          <ExternalLink :size="16" />打开知识星球
        </button>
      </div>
      <div class="login-benefits">
        <strong>会员权益</strong>
        <ul>
          <li v-for="(item, index) in benefits" :key="index">
            <BadgeCheck :size="17" />{{ item }}
          </li>
        </ul>
      </div>
    </div>
  </AppDialog>
</template>
