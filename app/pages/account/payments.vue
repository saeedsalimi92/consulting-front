<script setup lang="ts">
import type {Booking,BookingPayment,BookingReceipt} from '~/types/booking'
const route=useRoute(),api=useBookingApi(),{ensure}=usePrivatePage(),{t,path,money,formatDate}=useSiteLocale()
type PaymentRow={booking:Booking;payment:BookingPayment;receipt:BookingReceipt|null}
const rows=ref<PaymentRow[]>([]),loading=ref(true),error=ref(''),selectedReceipt=ref<{receipt:BookingReceipt;bookingId:number}|null>(null)
const requestedPaymentId=computed(()=>{const value=Number(route.query.payment_id);return Number.isSafeInteger(value)&&value>0?value:null})
const visibleRows=computed(()=>requestedPaymentId.value?rows.value.filter(row=>row.payment.id===requestedPaymentId.value):rows.value)
function showReceipt(row:PaymentRow){if(row.receipt)selectedReceipt.value={receipt:row.receipt,bookingId:row.booking.id}}
useSeoMeta({title:'پرداخت‌های من',robots:'noindex,nofollow'})
onMounted(async()=>{if(!await ensure()){loading.value=false;return}try{let page=1,last=1;const bookings:Booking[]=[];do{const data=await api.mine(page);bookings.push(...data.data);last=data.last_page;page++}while(page<=last);const grouped=await Promise.all(bookings.map(async booking=>{const [paymentResponse,receiptResponse]=await Promise.all([api.payments(booking.id),api.receipts(booking.id)]);return{booking,payments:paymentResponse.data,receipts:receiptResponse.data}}));rows.value=grouped.flatMap(group=>group.payments.map(payment=>({booking:group.booking,payment,receipt:group.receipts.find(receipt=>receipt.payment_id===payment.id)||null}))).sort((a,b)=>+new Date(b.payment.created_at)-+new Date(a.payment.created_at))}catch(e){error.value=bookingMessage(e,t)}finally{loading.value=false}})
</script>
<template>
 <section class="account-payments-page">
  <span class="eyebrow">تراکنش‌های حساب</span><h1>پرداخت‌های من</h1><p class="muted">سوابق پرداخت نوبت‌های شما.</p>
  <div v-if="requestedPaymentId&&!loading&&!error" class="selected-payment-notice"><span>نمایش تراکنش شماره {{requestedPaymentId}}</span><NuxtLink :to="path('/account/payments')">نمایش همه پرداخت‌ها</NuxtLink></div>
  <p v-if="loading">در حال دریافت پرداخت‌ها…</p><ApiNotice v-if="error">{{error}}</ApiNotice>
  <template v-else-if="visibleRows.length">
   <div class="table-wrap"><table class="data-table"><caption class="sr-only">فهرست پرداخت‌ها</caption><thead><tr><th scope="col">مبلغ</th><th scope="col">وضعیت</th><th scope="col">نوبت</th><th scope="col">روش پرداخت</th><th scope="col">تاریخ</th><th scope="col">شناسه پیگیری</th><th scope="col">جزئیات</th><th scope="col">رسید</th></tr></thead><tbody><tr v-for="row in visibleRows" :key="row.payment.id" :class="{'selected-payment-row':requestedPaymentId===row.payment.id}"><td>{{money(row.payment.amount_irr)}}</td><td><span class="status-pill" :data-status="row.payment.status">{{t(row.payment.status as any)||row.payment.status}}</span></td><td>{{row.booking.id}}</td><td>{{row.payment.provider}}</td><td>{{formatDate(row.payment.created_at)}}</td><td><bdi dir="ltr">{{row.payment.provider_reference||'—'}}</bdi></td><td><NuxtLink class="more" :to="path(`/account/appointments/${row.booking.id}`)">جزئیات نوبت</NuxtLink></td><td><button v-if="row.receipt" class="more receipt-view-button" type="button" @click="showReceipt(row)">مشاهده رسید</button><span v-else class="muted">—</span></td></tr></tbody></table></div>
   <div class="table-mobile"><article v-for="row in visibleRows" :key="`mobile-${row.payment.id}`" class="payment-card" :class="{'selected-payment-row':requestedPaymentId===row.payment.id}"><div class="payment-card-heading"><strong>{{money(row.payment.amount_irr)}}</strong><span class="status-pill" :data-status="row.payment.status">{{t(row.payment.status as any)||row.payment.status}}</span></div><p>نوبت {{row.booking.id}} · {{row.payment.provider}}</p><p>{{formatDate(row.payment.created_at)}}</p><p v-if="row.payment.provider_reference">شناسه پیگیری: <bdi dir="ltr">{{row.payment.provider_reference}}</bdi></p><div class="account-actions payment-card-actions"><NuxtLink class="btn secondary" :to="path(`/account/appointments/${row.booking.id}`)">جزئیات نوبت</NuxtLink><button v-if="row.receipt" class="btn secondary" type="button" @click="showReceipt(row)">مشاهده رسید</button><NuxtLink v-if="row.payment.status==='failed'" class="btn" :to="path(`/account/appointments/${row.booking.id}`)">تلاش دوباره</NuxtLink></div></article></div>
  </template>
  <ApiNotice v-else-if="!loading">{{requestedPaymentId?'این تراکنش در فهرست پرداخت‌های شما پیدا نشد.':'تراکنشی در حساب شما ثبت نشده است.'}}</ApiNotice>
  <PaymentReceiptDialog v-if="selectedReceipt" :receipt="selectedReceipt.receipt" :booking-id="selectedReceipt.bookingId" @close="selectedReceipt=null"/>
 </section>
</template>
