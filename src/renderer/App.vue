<script setup lang="ts">
import { onMounted } from 'vue'
import AppShell from '@renderer/components/AppShell.vue'
import { useAppStore } from '@renderer/stores/app'
import { useAuthStore } from '@renderer/stores/auth'

const store = useAppStore()
const auth = useAuthStore()

onMounted(() => {
  void store.initialize()
  void auth.refresh()
})
</script>

<template>
  <AppShell />
</template>
