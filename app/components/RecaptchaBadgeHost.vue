<script setup lang="ts">
const host = ref<HTMLElement | null>(null)
let observer: MutationObserver | undefined

function bringBadgeForward() {
  const target = host.value
  if (!target || typeof document === 'undefined' || typeof target.showPopover !== 'function') return
  const badge = document.querySelector<HTMLElement>('.grecaptcha-badge')
  if (badge && badge.parentElement !== target) target.appendChild(badge)
  if (badge && !target.matches(':popover-open')) {
    try { target.showPopover() } catch { /* Older browsers keep the page-level badge in the body. */ }
  }
}

function refreshLayer() {
  const target = host.value
  if (!target || typeof target.hidePopover !== 'function') return
  if (target.matches(':popover-open')) target.hidePopover()
  requestAnimationFrame(bringBadgeForward)
}

onMounted(() => {
  bringBadgeForward()
  observer = new MutationObserver(bringBadgeForward)
  observer.observe(document.body, {childList: true, subtree: true})
  window.addEventListener('recaptcha-badge-front', refreshLayer)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('recaptcha-badge-front', refreshLayer)
  const badge = host.value?.querySelector<HTMLElement>('.grecaptcha-badge')
  if (badge) document.body.appendChild(badge)
})
</script>

<template>
  <div ref="host" class="recaptcha-badge-host" popover="manual" aria-label="نشان reCAPTCHA"></div>
</template>
