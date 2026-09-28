<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import AppShell from '@renderer/components/AppShell.vue'
import { desktopAPI } from '@renderer/services/desktop-api'
import { useAppStore } from '@renderer/stores/app'
import { useAuthStore } from '@renderer/stores/auth'
import { router } from '@renderer/router'

const store = useAppStore()
const auth = useAuthStore()
let stopNavigationListener: (() => void) | undefined

onMounted(() => {
  stopNavigationListener = desktopAPI.onNavigate((route) => {
    void router.push(route)
  })
  void store.initialize()
  void auth.refresh()
})

onBeforeUnmount(() => {
  stopNavigationListener?.()
})
</script>

<template>
  <AppShell />
</template>
