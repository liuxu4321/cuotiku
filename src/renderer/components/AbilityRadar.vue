<script setup lang="ts">
import { computed } from 'vue'
import type { AbilityModel } from '@shared/types'

const props = defineProps<{ model: AbilityModel }>()

const size = 320
const center = size / 2
const radius = 108
const angles = [0, 1, 2, 3, 4].map((index) => ((-90 + index * 72) * Math.PI) / 180)
const rings = [20, 40, 60, 80, 100]

function point(index: number, value: number): { x: number; y: number } {
  const r = (radius * value) / 100
  const angle = angles[index] ?? 0
  return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) }
}
function ringPoints(value: number): string {
  return angles
    .map((_, index) => {
      const p = point(index, value)
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    })
    .join(' ')
}
const hasData = computed(() => props.model.sampleSize > 0)
const polygon = computed(() =>
  props.model.dimensions
    .map((dimension, index) => {
      const p = point(index, dimension.score ?? 0)
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    })
    .join(' '),
)
const labels = computed(() =>
  props.model.dimensions.map((dimension, index) => {
    const p = point(index, 132)
    return { x: p.x, y: p.y, label: dimension.label, score: dimension.score }
  }),
)
</script>

<template>
  <svg :width="size" :height="size" class="ability-radar" role="img" aria-label="能力五边形雷达图">
    <polygon v-for="ring in rings" :key="ring" :points="ringPoints(ring)" class="radar-ring" />
    <line
      v-for="(angle, index) in angles"
      :key="index"
      :x1="center"
      :y1="center"
      :x2="point(index, 100).x"
      :y2="point(index, 100).y"
      class="radar-axis"
    />
    <template v-if="hasData">
      <polygon :points="polygon" class="radar-area" />
      <circle
        v-for="(dimension, index) in props.model.dimensions"
        :key="dimension.key"
        :cx="point(index, dimension.score ?? 0).x"
        :cy="point(index, dimension.score ?? 0).y"
        r="3.5"
        class="radar-dot"
      />
    </template>
    <text
      v-for="(item, index) in labels"
      :key="index"
      :x="item.x"
      :y="item.y"
      class="radar-label"
      text-anchor="middle"
    >
      {{ item.label }}{{ item.score === null ? '' : ` ${item.score}` }}
    </text>
    <text v-if="!hasData" :x="center" :y="center" class="radar-empty" text-anchor="middle">
      暂无错题数据
    </text>
  </svg>
</template>
