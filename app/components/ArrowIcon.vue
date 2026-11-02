<script setup lang="ts">
withDefaults(defineProps<{ direction?: 'back' | 'forward' | 'external' }>(), { direction: 'back' })
</script>

<template>
  <svg class="icon-arrow" :class="`icon-arrow--${direction}`" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path v-if="direction==='external'" d="M8 16 16 8M8.5 8H16v7.5" />
    <path v-else-if="direction==='forward'" d="M5 12h14m-6-6 6 6-6 6" />
    <path v-else d="M19 12H5m6-6-6 6 6 6" />
  </svg>
</template>
