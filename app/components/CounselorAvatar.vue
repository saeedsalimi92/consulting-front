<script setup lang="ts">
const props = withDefaults(defineProps<{ src?: string | null; name: string; decorative?: boolean; size?: 'card' | 'choice' | 'summary' | 'profile' }>(), { src: null, decorative: false, size: 'card' })
const mediaUrl = useMediaUrl()
const failed = ref(false)
const resolvedSrc = computed(() => mediaUrl(props.src))
const initial = computed(() => props.name.trim().slice(0, 1) || 'م')
watch(resolvedSrc, () => { failed.value = false })
</script>

<template>
  <span class="counselor-avatar" :class="`counselor-avatar--${size}`">
    <img v-if="resolvedSrc && !failed" class="counselor-avatar-img" :src="resolvedSrc" :alt="decorative ? '' : `تصویر ${name}`" :aria-hidden="decorative ? 'true' : undefined" loading="lazy" decoding="async" @error="failed=true">
    <span v-else class="counselor-avatar-fallback" aria-hidden="true">{{initial}}</span>
  </span>
</template>
