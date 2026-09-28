<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { Images, PanelLeftClose, PanelLeftOpen, Settings } from '@lucide/vue'
import SidebarMenuItem from './SidebarMenuItem.vue'
import { sidebarMenuItems } from '@renderer/config/navigation'
import { useAppStore } from '@renderer/stores/app'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const collapsed = ref(false)
const settingsRoute = computed(() => route.name === 'settings')
</script>

<template>
  <RouterView v-if="settingsRoute" />
  <div v-else class="app-shell" :class="{ 'sidebar-collapsed': collapsed }">
    <aside class="sidebar">
      <div class="sidebar-heading">
        <div class="app-identity">
          <Images :size="22" /><span
            ><strong>盈盈错题库</strong><small>v{{ store.version || '…' }}</small></span
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
        <button class="settings-entry" title="设置" @click="router.push('/settings')">
          <Settings :size="18" /><span v-if="!collapsed">设置</span>
        </button>
      </div>
    </aside>
    <main class="content"><RouterView /></main>
  </div>
</template>
