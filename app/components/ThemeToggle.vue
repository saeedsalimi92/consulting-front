<script setup lang="ts">
const { appearance, apply } = useAppearance()
const root = ref<HTMLDetailsElement | null>(null)
const open = ref(false)
const label = computed(() => appearance.value === 'system' ? 'تغییر پوسته؛ حالت خودکار' : appearance.value === 'dark' ? 'تغییر پوسته؛ تیره' : 'تغییر پوسته؛ روشن')
function outside(event: PointerEvent) {
  if (root.value?.open && !root.value.contains(event.target as Node)) {
    root.value.open = false
    open.value = false
  }
}
function escape(event: KeyboardEvent) {
  if (event.key === 'Escape' && root.value?.open) {
    root.value.open = false
    open.value = false
    root.value.querySelector('summary')?.focus()
  }
}
onMounted(() => { document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape) })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) })
function choose(mode: 'light' | 'dark' | 'system') {
  apply(mode)
  if (root.value) root.value.open = false
  open.value = false
  nextTick(() => root.value?.querySelector('summary')?.focus())
}
</script>

<template>
  <details ref="root" class="theme-control" @toggle="open = ($event.target as HTMLDetailsElement).open">
    <summary class="theme-toggle" :aria-label="label" :title="label" aria-haspopup="menu" :aria-expanded="open">
      <svg v-if="appearance==='dark'" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.2A8.6 8.6 0 0 1 8.8 3.8 8.7 8.7 0 1 0 20.2 15.2Z"/><path d="M16.8 3.2v3.6M15 5h3.6"/></svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.7"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>
    </summary>
    <div class="theme-popover" role="group" aria-label="انتخاب پوسته">
      <button type="button" :aria-pressed="appearance==='light'" @click="choose('light')"><span aria-hidden="true">☼</span> روشن</button>
      <button type="button" :aria-pressed="appearance==='dark'" @click="choose('dark')"><span aria-hidden="true">☾</span> تیره</button>
      <button type="button" :aria-pressed="appearance==='system'" @click="choose('system')"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></svg> خودکار</button>
    </div>
  </details>
</template>
