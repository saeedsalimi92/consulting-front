<script setup lang="ts">
import type {Booking} from '~/types/booking'
const {t,path,formatDate,money}=useSiteLocale(),api=useBookingApi(),{ensure}=usePrivatePage()
const {data:counselors}=await useBackend().counselors(),{data:services}=await useAsyncData('booking-services-public',()=>api.services())
const bookings=ref<Booking[]>([]),page=ref(1),lastPage=ref(1),busy=ref(true),error=ref(''),filter=ref('all'),search=ref('')
const counselorName=(id:number)=>counselors.value?.data?.find(x=>x.id===id)?.name||`${t('counselor')} #${id}`
const serviceName=(id:number)=>services.value?.data?.find(x=>x.id===id)?.title||`${t('service')} #${id}`
const visibleBookings=computed(()=>bookings.value.filter(b=>(filter.value==='all'||b.status===filter.value)&&(!search.value||`${b.id} ${counselorName(b.counselor_id)} ${serviceName(b.booking_service_id)} ${b.status}`.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()))).sort((a,b)=>{const dateA=+new Date(a.starts_at),dateB=+new Date(b.starts_at),futureA=dateA>=Date.now()&&!['cancelled','expired','completed'].includes(a.status),futureB=dateB>=Date.now()&&!['cancelled','expired','completed'].includes(b.status);return futureA!==futureB?futureA?-1:1:futureA?dateA-dateB:dateB-dateA}))
useSeoMeta({title:'نوبت‌های من',robots:'noindex,nofollow'})
async function load(number=1){busy.value=true;error.value='';try{const response=await api.mine(number);bookings.value=number===1?response.data:[...bookings.value,...response.data];page.value=response.current_page;lastPage.value=response.last_page}catch(e){error.value=bookingMessage(e,t)}finally{busy.value=false}}
onMounted(async()=>{if(await ensure())await load()})
</script>
<template>
 <section class="account-appointments-page">
  <div class="appointments-page-heading"><div><span class="eyebrow">حساب کاربری</span><h1>نوبت‌های من</h1><p>فهرست نوبت‌های آینده و گذشته</p></div><NuxtLink class="btn" :to="path('/appointment')">دریافت نوبت</NuxtLink></div>
  <ApiNotice v-if="error">{{error}}</ApiNotice>
  <div class="appointments-toolbar"><input v-model.trim="search" type="search" placeholder="جست‌وجو در نوبت‌ها" aria-label="جست‌وجوی نوبت"><select v-model="filter" aria-label="فیلتر وضعیت"><option value="all">همه وضعیت‌ها</option><option value="held">در انتظار پرداخت</option><option value="confirmed">تأییدشده</option><option value="completed">برگزارشده</option><option value="cancelled">لغوشده</option><option value="expired">منقضی‌شده</option></select></div>
  <p v-if="busy&&page===1">{{t('loading')}}</p>
  <template v-else-if="visibleBookings.length">
   <div class="table-wrap appointments-table-wrap"><table class="data-table appointments-table"><caption class="sr-only">فهرست نوبت‌های آینده و گذشته</caption><thead><tr><th scope="col">خدمت و مشاور</th><th scope="col">تاریخ و ساعت</th><th scope="col">وضعیت</th><th scope="col">مانده</th><th scope="col">جزئیات</th></tr></thead><tbody><tr v-for="booking in visibleBookings" :key="booking.id"><td><strong>{{serviceName(booking.booking_service_id)}}</strong><small>{{counselorName(booking.counselor_id)}}</small></td><td>{{formatDate(booking.starts_at)}}</td><td><span class="status-pill" :data-status="booking.status">{{t(booking.status as any)||booking.status}}</span></td><td>{{money(booking.remaining_irr)}}</td><td><NuxtLink class="more" :to="path(`/account/appointments/${booking.id}`)">مشاهده</NuxtLink></td></tr></tbody></table></div>
   <div class="table-mobile appointments-mobile-list"><article v-for="booking in visibleBookings" :key="`mobile-${booking.id}`" class="payment-card appointment-list-card"><div class="payment-card-heading"><strong>{{serviceName(booking.booking_service_id)}}</strong><span class="status-pill" :data-status="booking.status">{{t(booking.status as any)||booking.status}}</span></div><p>{{counselorName(booking.counselor_id)}}</p><p>{{formatDate(booking.starts_at)}}</p><div class="appointment-mobile-footer"><span>مانده: {{money(booking.remaining_irr)}}</span><NuxtLink class="more" :to="path(`/account/appointments/${booking.id}`)">جزئیات نوبت <ArrowIcon direction="back"/></NuxtLink></div></article></div>
  </template>
  <ApiNotice v-else-if="!busy">نوبتی با این مشخصات پیدا نشد.</ApiNotice>
  <button v-if="page<lastPage" class="btn secondary appointments-load-more" :disabled="busy" @click="load(page+1)">{{busy?t('loading'):t('next')}}</button>
 </section>
</template>
