<script setup lang="ts">
import type {BookingReceipt} from '~/types/booking'
defineProps<{receipt:BookingReceipt;bookingId:number}>()
const emit=defineEmits<{close:[]}>()
const {money,formatDate}=useSiteLocale(),dialog=ref<HTMLDialogElement|null>(null),printable=ref<HTMLElement|null>(null)
onMounted(()=>dialog.value?.showModal())
function close(){emit('close')}
function printReceipt(){const element=printable.value;if(!element)return;element.classList.add('print-target');window.addEventListener('afterprint',()=>element.classList.remove('print-target'),{once:true});window.print()}
</script>
<template>
 <dialog ref="dialog" class="receipt-dialog" aria-labelledby="receipt-dialog-title" @click.self="close" @cancel.prevent="close">
  <button class="receipt-dialog-close" type="button" aria-label="بستن رسید" @click="close"><CloseIcon/></button>
  <div class="receipt-dialog-brand"><img src="/images/logo.png" alt="" width="36" height="36"><span><strong>کلینیک پرواز</strong><small>مرکز مشاوره و روان‌شناختی پرواز</small></span></div>
  <div ref="printable" class="receipt receipt-dialog-paper">
   <h2 id="receipt-dialog-title">رسید پرداخت</h2>
   <div class="receipt-row"><span>شماره رسید</span><strong>{{receipt.receipt_number}}</strong></div>
   <div class="receipt-row"><span>شماره نوبت</span><strong>{{bookingId}}</strong></div>
   <div class="receipt-row"><span>مبلغ پرداخت</span><strong>{{money(receipt.amount_irr)}}</strong></div>
   <div class="receipt-row"><span>تاریخ پرداخت</span><strong>{{formatDate(receipt.paid_at||receipt.created_at||'')}}</strong></div>
   <div v-if="receipt.provider_reference" class="receipt-row"><span>شناسه پیگیری</span><strong><bdi dir="ltr">{{receipt.provider_reference}}</bdi></strong></div>
  </div>
  <div class="receipt-dialog-actions no-print"><button class="btn" type="button" @click="printReceipt">چاپ رسید</button><button class="btn secondary" type="button" @click="close">بستن</button></div>
 </dialog>
</template>
