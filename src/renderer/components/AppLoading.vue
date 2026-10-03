<template>
  <div class="page-loading" :class="{ compact }" role="status" aria-live="polite">
    <div class="loading-visual" aria-hidden="true">
      <img class="loading-icon" :src="loadingIcon" alt="" />
      <div class="loading-shadow" />
    </div>
    <p class="loading-title">{{ title }}</p>
    <p v-if="description" class="loading-description">{{ description }}</p>
    <div class="loading-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  </div>
</template>

<script setup lang="ts">
import loadingIcon from '@renderer/assets/loading.png'

withDefaults(
  defineProps<{
    title?: string
    description?: string
    compact?: boolean
  }>(),
  {
    title: '正在整理书页…',
    description: '让每一次订正，都成为进步。',
    compact: false,
  },
)
</script>

<style scoped>
.page-loading {
  align-items: center;
  background: radial-gradient(
    ellipse at center,
    color-mix(in srgb, var(--primary) 10%, Canvas) 0%,
    color-mix(in srgb, var(--primary) 4%, Canvas) 48%,
    Canvas 80%
  );
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 360px;
  padding: 40px 24px;
}
.page-loading.compact {
  min-height: 200px;
  padding: 24px 16px;
}
.page-loading.compact .loading-visual {
  height: 92px;
  width: 72px;
}
.page-loading.compact .loading-icon {
  height: 72px;
  width: 72px;
}
.page-loading.compact .loading-shadow {
  bottom: 6px;
  height: 9px;
  left: 10px;
  width: 52px;
}
.page-loading.compact .loading-title {
  font-size: 13px;
  margin-top: 14px;
}
.page-loading.compact .loading-dots {
  margin-top: 14px;
}
.loading-visual {
  height: 140px;
  position: relative;
  width: 112px;
}
.loading-icon {
  animation: book-float 2.4s ease-in-out infinite;
  display: block;
  height: 112px;
  object-fit: contain;
  position: relative;
  width: 112px;
  z-index: 1;
}
.loading-shadow {
  animation: shadow-breathe 2.4s ease-in-out infinite;
  background: color-mix(in srgb, var(--primary) 16%, transparent);
  border-radius: 50%;
  bottom: 8px;
  filter: blur(6px);
  height: 12px;
  left: 16px;
  position: absolute;
  width: 80px;
}
.loading-title {
  color: color-mix(in srgb, CanvasText 78%, transparent);
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 1px;
  margin: 20px 0 0;
}
.loading-description {
  color: color-mix(in srgb, CanvasText 52%, transparent);
  font-size: 12px;
  line-height: 1.6;
  margin: 10px 0 0;
  text-align: center;
}
.loading-dots {
  display: flex;
  gap: 7px;
  margin-top: 22px;
}
.loading-dots span {
  animation: dot-breathe 1.5s ease-in-out infinite;
  background: var(--primary);
  border-radius: 50%;
  height: 5px;
  opacity: 0.3;
  width: 5px;
}
.loading-dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.loading-dots span:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes book-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}
@keyframes shadow-breathe {
  0%,
  100% {
    opacity: 0.8;
    transform: scaleX(1);
  }
  50% {
    opacity: 0.45;
    transform: scaleX(0.85);
  }
}
@keyframes dot-breathe {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-3px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .loading-icon,
  .loading-shadow,
  .loading-dots span {
    animation: none;
  }
}
</style>
