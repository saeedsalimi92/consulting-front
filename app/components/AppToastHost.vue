<script setup lang="ts">
const toast=useAppToast()
const toastItems=computed(()=>toast.items.value)
const host=ref<HTMLElement|null>(null)
function raiseAboveDialogs(){
 const element=host.value as (HTMLElement & {showPopover?:()=>void;hidePopover?:()=>void})|null
 if(!element||!element.showPopover)return
 try{if(element.matches(':popover-open'))element.hidePopover();element.showPopover()}catch{/* Popover is unavailable in older browsers. */}
}
onMounted(()=>nextTick(raiseAboveDialogs))
watch(toastItems,()=>nextTick(raiseAboveDialogs),{flush:'post'})
onBeforeUnmount(()=>{try{(host.value as any)?.hidePopover?.()}catch{/* Already closed. */}})
</script>
<template>
 <div ref="host" class="app-toast-host" popover="manual" aria-label="پیام‌های سامانه">
  <TransitionGroup name="toast" tag="div" class="app-toast-stack">
   <section v-for="item in toastItems" :key="item.id" class="app-toast" :class="`is-${item.kind}`" role="status" :aria-live="item.kind==='error'?'assertive':'polite'">
    <span class="app-toast-icon" aria-hidden="true"><svg v-if="item.kind==='success'" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg><svg v-else-if="item.kind==='error'" viewBox="0 0 24 24"><path d="M12 8v5m0 3h.01M10.3 3.8 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3l-7.8-14.2a2 2 0 0 0-3.4 0Z"/></svg><svg v-else-if="item.kind==='warning'" viewBox="0 0 24 24"><path d="M12 8v5m0 3h.01M10.3 3.8 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3l-7.8-14.2a2 2 0 0 0-3.4 0Z"/></svg><svg v-else viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg></span>
    <p>{{item.message}}</p><button type="button" aria-label="بستن پیام" @click="toast.dismiss(item.id)"><CloseIcon/></button>
   </section>
  </TransitionGroup>
 </div>
</template>
