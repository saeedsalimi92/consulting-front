<script setup lang="ts">
const dialog=ref<HTMLDialogElement|null>(null)
const redirectTo=ref('/account/appointments')
const route=useRoute()
const rendered=ref(false)
async function open(destination='/account/appointments'){
 redirectTo.value=destination
 rendered.value=true
 await nextTick()
 if(import.meta.client&&dialog.value&&!dialog.value.open){dialog.value.showModal();document.documentElement.classList.add('auth-modal-open');window.dispatchEvent(new Event('recaptcha-badge-front'))}
}
function close(){
 if(dialog.value?.open)dialog.value.close()
 else onClose()
}
function onClose(){
 if(import.meta.client)document.documentElement.classList.remove('auth-modal-open')
 rendered.value=false
}
watch(()=>route.fullPath,close)
defineExpose({open,close})
</script>
<template>
 <dialog v-if="rendered" ref="dialog" class="auth-dialog unified-auth-dialog" aria-labelledby="unified-login-title" @click.self="close" @cancel="close" @close="onClose">
  <button class="auth-dialog-close" type="button" aria-label="بستن پنجره ورود" @click="close"><CloseIcon/></button>
  <OtpLoginFlow :redirect-to="redirectTo" @authenticated="close"/>
 </dialog>
</template>
