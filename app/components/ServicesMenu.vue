<script setup lang="ts">
import type { ApiCollection, Specialty } from '~/types/api'
import type { CmsEntry } from '~/composables/useBackend'

const props = withDefaults(defineProps<{ mobile?: boolean }>(), { mobile: false })
const route = useRoute()
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const open = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | undefined
const backend = useBackend()
const { data, pending, error } = await useAsyncData('public-header-services', async () => {
  const [specialties, pages] = await Promise.all([
    backend.request<ApiCollection<Specialty>>('/specialties').then(value => ({ value, failed: false })).catch(() => ({ value: null, failed: true })),
    backend.request<ApiCollection<CmsEntry>>('/content/services', { query: { per_page: 30 } }).then(value => ({ value, failed: false })).catch(() => ({ value: null, failed: true })),
  ])
  return { specialties: specialties.value?.data || [], pages: pages.value?.data || [], failed: specialties.failed || pages.failed }
})
const specialties = computed(() => {
  const seen = new Set<string>()
  return (data.value?.specialties || []).filter(item => {
    const key = item.slug || item.title.trim().toLocaleLowerCase('fa')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
})
const pages = computed(() => data.value?.pages || [])
const hasPartialError = computed(() => data.value?.failed)
function pageDescription(item: Specialty) {
  const page = pages.value.find(entry => entry.slug === item.slug || entry.title === item.title)
  return (page?.body || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
}
function cancelClose() { if (closeTimer) clearTimeout(closeTimer) }
function scheduleClose() { cancelClose(); closeTimer = setTimeout(() => { open.value = false }, 180) }
function close(restoreFocus = false) { cancelClose(); open.value = false; if (restoreFocus) nextTick(() => trigger.value?.focus()) }
function focusFirst(event: KeyboardEvent) {
  event.preventDefault(); open.value = true
  nextTick(() => panel.value?.querySelector<HTMLElement>('.mega-specialty-link, .mega-all-link')?.focus())
}
function isInside(target: Node | null) { return !!target && !!(root.value?.contains(target) || panel.value?.contains(target)) }
function onOutside(event: PointerEvent) { if (open.value && !isInside(event.target as Node | null)) close() }
function onFocusOut() { window.setTimeout(() => { if (!isInside(document.activeElement)) close() }, 0) }
watch(() => route.fullPath, () => close())
onMounted(() => document.addEventListener('pointerdown', onOutside))
onBeforeUnmount(() => { cancelClose(); if (import.meta.client) document.removeEventListener('pointerdown', onOutside) })
</script>

<template>
  <div v-if="!mobile" ref="root" class="services-nav-item" @pointerenter="cancelClose();open=true" @pointerleave="scheduleClose" @focusout="onFocusOut">
    <button ref="trigger" class="services-menu-trigger" :class="{'router-link-active':route.path.startsWith('/service')}" type="button" :aria-expanded="open" aria-controls="services-mega-menu" @click="open=true" @focus="open=true" @keydown.down="focusFirst" @keydown.esc.prevent="close(true)">
      خدمات <svg class="menu-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
    </button>
    <Teleport to="body">
      <Transition name="mega">
      <section v-if="open" id="services-mega-menu" ref="panel" class="services-mega-panel" aria-label="خدمات و تخصص‌ها" @pointerenter="cancelClose" @pointerleave="scheduleClose" @focusout="onFocusOut" @keydown.esc.stop.prevent="close(true)">
        <div class="mega-intro"><span class="eyebrow">کلینیک پرواز</span><h2>خدمات مرکز</h2><p>با خدمات و حوزه‌های تخصصی مرکز آشنا شوید.</p><NuxtLink class="mega-all-link" to="/service" @click="close()">مشاهده همه خدمات <span aria-hidden="true"><ArrowIcon direction="back" /></span></NuxtLink></div>
        <div class="mega-content">
          <h3>حوزه‌های تخصصی</h3>
          <p v-if="pending" class="mega-state">در حال دریافت اطلاعات خدمات…</p>
          <div v-else-if="specialties.length" class="mega-specialty-grid">
            <NuxtLink v-for="item in specialties" :key="item.id" class="mega-specialty-link" :to="`/service/${item.slug}`" @click="close()">
              <SpecialtyIcon :name="item.title"/><span><strong>{{ item.title }}</strong><small v-if="pageDescription(item)">{{ pageDescription(item) }}</small></span><span class="mega-link-arrow" aria-hidden="true"><ArrowIcon direction="external" /></span>
            </NuxtLink>
          </div>
          <p v-else-if="error || hasPartialError" class="mega-state">دریافت تخصص‌ها در حال حاضر ممکن نیست. لطفاً دوباره تلاش کنید یا فهرست خدمات را ببینید.</p>
          <p v-else class="mega-state">در حال حاضر حوزه تخصصی عمومی برای نمایش ثبت نشده است.</p>
        </div>
      </section>
      </Transition>
    </Teleport>
  </div>

  <details v-else class="mobile-services-accordion">
    <summary>خدمات <svg class="menu-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg></summary>
    <div class="mobile-services-links">
      <NuxtLink v-for="item in specialties" :key="item.id" :to="`/service/${item.slug}`"><SpecialtyIcon :name="item.title"/><span>{{item.title}}</span></NuxtLink>
      <p v-if="pending" class="mega-state">در حال دریافت خدمات…</p>
      <p v-else-if="!specialties.length" class="mega-state">{{error||hasPartialError?'دریافت فهرست خدمات ممکن نیست.':'حوزه‌ای برای نمایش ثبت نشده است.'}}</p>
      <NuxtLink class="mobile-all-services" to="/service">همه خدمات مرکز <span aria-hidden="true"><ArrowIcon direction="back" /></span></NuxtLink>
    </div>
  </details>
</template>
