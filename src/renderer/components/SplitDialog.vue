<script setup lang="ts">
import { ref, watch } from 'vue'
import AppDialog from './AppDialog.vue'
import type { SplitQuestion } from '@shared/types'

const props = defineProps<{ open: boolean; questions: SplitQuestion[]; previewUrl: string }>()
const emit = defineEmits<{ close: []; confirm: [selected: SplitQuestion[]] }>()

const picked = ref<number[]>([])

watch(
  () => props.open,
  (open) => {
    if (open) picked.value = props.questions.map((question) => question.index)
  },
)

function toggle(index: number): void {
  const position = picked.value.indexOf(index)
  if (position >= 0) picked.value.splice(position, 1)
  else picked.value.push(index)
}
function confirm(): void {
  emit(
    'confirm',
    props.questions.filter((question) => picked.value.includes(question.index)),
  )
}
</script>

<template>
  <AppDialog
    :open="open"
    wide
    title="切题结果"
    description="点击题框或编号切换选中，确认后替换为当前选框。"
    @close="emit('close')"
  >
    <div class="split-canvas">
      <img :src="previewUrl" alt="切题预览" />
      <button
        v-for="question in questions"
        :key="question.index"
        type="button"
        class="split-box"
        :class="{ on: picked.includes(question.index) }"
        :style="{
          left: `${question.nx * 100}%`,
          top: `${question.ny * 100}%`,
          width: `${question.nWidth * 100}%`,
          height: `${question.nHeight * 100}%`,
        }"
        :aria-label="`题 ${question.index}`"
        @click="toggle(question.index)"
      >
        <span>{{ question.index }}</span>
      </button>
    </div>
    <div class="split-chips">
      <button
        v-for="question in questions"
        :key="question.index"
        type="button"
        class="split-chip"
        :class="{ on: picked.includes(question.index) }"
        @click="toggle(question.index)"
      >
        题{{ question.index }}
      </button>
    </div>
    <template #footer>
      <button class="secondary-button" type="button" @click="emit('close')">取消</button>
      <button class="primary-button" type="button" :disabled="!picked.length" @click="confirm">
        确认加入选框（{{ picked.length }}）
      </button>
    </template>
  </AppDialog>
</template>
