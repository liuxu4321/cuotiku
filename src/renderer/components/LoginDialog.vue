<script setup lang="ts">
import { ref, watch } from 'vue'
import { ExternalLink, RefreshCw } from '@lucide/vue'
import AppDialog from './AppDialog.vue'
import { friendlyError, useAppStore } from '@renderer/stores/app'
import { useAuthStore } from '@renderer/stores/auth'
import { desktopAPI } from '@renderer/services/desktop-api'
import planetQr from '@renderer/assets/planet-qr.jpg'
import type { CaptchaInfo } from '@shared/types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; success: [] }>()

const app = useAppStore()
const auth = useAuthStore()
const phone = ref('')
const password = ref('')
const captchaCode = ref('')
const captcha = ref<CaptchaInfo | null>(null)
const error = ref('')
const busy = ref(false)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    error.value = ''
    captchaCode.value = ''
    void reloadCaptcha()
  },
)

async function reloadCaptcha(): Promise<void> {
  captcha.value = null
  try {
    captcha.value = await desktopAPI.getCaptcha()
  } catch (caught) {
    error.value = friendlyError(caught)
  }
}
async function submit(): Promise<void> {
  if (!captcha.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await auth.login({
      phone: phone.value.trim(),
      password: password.value,
      captchaId: captcha.value.captchaId,
      captchaCode: captchaCode.value.trim(),
    })
    emit('success')
    emit('close')
  } catch (caught) {
    error.value = friendlyError(caught)
    captchaCode.value = ''
    await reloadCaptcha()
  } finally {
    busy.value = false
  }
}
function openPlanet(): void {
  const url = app.runtimeConfig?.planetUrl.trim() ?? ''
  if (url) void desktopAPI.openExternal(url)
}
</script>

<template>
  <AppDialog
    :open="open"
    wide
    title="登录拾星错题本"
    description="AI 去手写与组卷打印为星球会员权益，登录后可用。"
    @close="emit('close')"
  >
    <div class="login-split">
      <div class="login-promo">
        <img class="login-qr" :src="planetQr" alt="知识星球二维码" />
        <p>软件基础功能免费；加入知识星球后由管理员开通账号。</p>
        <ol>
          <li>加入知识星球「拾星错题本」。</li>
          <li>在星球内私信管理员你的手机号。</li>
          <li>管理员开通后，用手机号和密码登录。</li>
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
      <form class="login-form" @submit.prevent="submit">
        <label
          ><span>手机号</span><input v-model.trim="phone" maxlength="11" placeholder="11 位手机号"
        /></label>
        <label
          ><span>密码</span><input v-model="password" type="password" placeholder="6-64 位密码"
        /></label>
        <label
          ><span>验证码</span>
          <span class="login-captcha">
            <input v-model.trim="captchaCode" maxlength="4" placeholder="4 位验证码" />
            <button
              type="button"
              class="login-captcha-img"
              title="点击刷新验证码"
              aria-label="点击刷新验证码"
              @click="reloadCaptcha"
            >
              <img v-if="captcha" :src="captcha.imageBase64" alt="点击刷新验证码" />
              <RefreshCw v-else :size="18" />
            </button>
          </span>
        </label>
        <p v-if="error" class="login-error">{{ error }}</p>
        <button
          class="primary-button"
          type="submit"
          :disabled="busy || !phone || !password || !captchaCode"
        >
          {{ busy ? '登录中…' : '登录' }}
        </button>
      </form>
    </div>
  </AppDialog>
</template>
