<script setup lang="ts">
import { Construction } from '@lucide/vue'
import PageHeader from '@renderer/components/PageHeader.vue'

defineProps<{ title: string; description: string }>()
</script>

<template>
  <section class="page coming-soon-page">
    <PageHeader :title="title" :description="description" />
    <article class="panel coming-soon-card">
      <Construction :size="34" />
      <strong>功能开发中</strong>
      <small>该功能正在紧锣密鼓开发，敬请期待。</small>
    </article>
  </section>
</template>
