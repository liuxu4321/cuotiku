<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { Images, PanelLeftClose, PanelLeftOpen, Settings, UserRound } from '@lucide/vue'
import SidebarMenuItem from './SidebarMenuItem.vue'
import LoginDialog from './LoginDialog.vue'
import UpdateNotice from './UpdateNotice.vue'
import { sidebarMenuItems } from '@renderer/config/navigation'
import { useAppStore } from '@renderer/stores/app'
import { useAuthStore } from '@renderer/stores/auth'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const auth = useAuthStore()
const collapsed = ref(false)
const loginDialog = ref(false)
const popover = ref(false)
const authWrap = ref<HTMLElement | null>(null)
const settingsRoute = computed(() => route.name === 'settings')

function onDocumentClick(event: MouseEvent): void {
  if (!popover.value) return
  if (authWrap.value && !authWrap.value.contains(event.target as Node)) popover.value = false
}
onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))

async function logout(): Promise<void> {
  popover.value = false
  try {
    await auth.logout()
  } catch {
    popover.value = false
  }
}
</script>

<template>
  <UpdateNotice />
  <RouterView v-if="settingsRoute" />
  <div v-else class="app-shell" :class="{ 'sidebar-collapsed': collapsed }">
    <aside class="sidebar">
      <div class="sidebar-heading">
        <div class="app-identity">
          <Images :size="22" /><span
            ><strong>拾星错题本</strong><small>v{{ store.version || '…' }}</small></span
          >
        </div>
        <button
          class="icon-button"
          :title="collapsed ? '展开侧栏' : '收起侧栏'"
          @click="collapsed = !collapsed"
        >
          <PanelLeftOpen v-if="collapsed" :size="18" /><PanelLeftClose v-else :size="18" />
        </button>
      </div>
      <section class="sidebar-main">
        <nav aria-label="主导航">
          <SidebarMenuItem
            v-for="item in sidebarMenuItems"
            :key="item.id"
            :item="item"
            :collapsed="collapsed"
            @request-expand="collapsed = false"
          />
        </nav>
      </section>
      <div class="sidebar-bottom">
        <div ref="authWrap" class="auth-entry-wrap">
          <button v-if="!auth.loggedIn" class="auth-entry" title="登录" @click="loginDialog = true">
            <UserRound v-if="collapsed" :size="18" /><span v-else>登录</span>
          </button>
          <button
            v-else
            class="auth-entry"
            :title="auth.session?.phone"
            @click="popover = !popover"
          >
            <UserRound v-if="collapsed" :size="18" /><span v-else>{{ auth.session?.phone }}</span>
          </button>
          <div v-if="popover" class="auth-popover" role="dialog" aria-label="账号信息">
            <strong>{{ auth.session?.phone }}</strong>
            <dl>
              <dt>会员号</dt>
              <dd>{{ auth.session?.memberNo || '未绑定' }}</dd>
              <dt>AI 权限</dt>
              <dd>{{ auth.session?.aiEnabled ? '已开通' : '未开通' }}</dd>
              <dt>会员有效期</dt>
              <dd>{{ auth.session?.tokenExpiresAt || '静默续期中' }}</dd>
            </dl>
            <button class="danger-button" type="button" @click="logout">退出登录</button>
          </div>
        </div>
        <button
          class="settings-entry"
          title="设置"
          aria-label="设置"
          @click="router.push('/settings')"
        >
          <Settings :size="18" />
        </button>
      </div>
    </aside>
    <main class="content"><RouterView /></main>
    <LoginDialog :open="loginDialog" @close="loginDialog = false" @success="loginDialog = false" />
  </div>
</template>
