<script setup lang="ts">
import type {Booking,BookingService} from '~/types/booking'
import {collectionItems} from '~/composables/useBackend'
const api=useBookingApi(),{t,path,formatDate,money}=useSiteLocale(),{auth,ensure}=usePrivatePage()
const bookings=ref<Booking[]>([]),services=ref<BookingService[]>([]),loading=ref(true),error=ref(''),now=ref(Date.now())
const upcoming=computed(()=>bookings.value.filter(b=>new Date(b.starts_at).getTime()>now.value&&!['cancelled','expired','completed'].includes(b.status)).sort((a,b)=>+new Date(a.starts_at)-+new Date(b.starts_at)))
const latestBookings=computed(()=>[...bookings.value].sort((a,b)=>+new Date(b.starts_at)-+new Date(a.starts_at)).slice(0,3))
const pendingPaymentCount=computed(()=>bookings.value.filter(b=>['held','pending_payment'].includes(b.status)).length)
const next=computed(()=>upcoming.value[0]),serviceName=(id:number)=>services.value.find(s=>s.id===id)?.title||`${t('service')} #${id}`
const countdown=computed(()=>{if(!next.value)return '';const ms=Math.max(0,+new Date(next.value.starts_at)-now.value),days=Math.floor(ms/86400000),hours=Math.floor(ms%86400000/3600000);return days?`${days} روز و ${hours} ساعت`:`${hours} ساعت`})
useSeoMeta({title:'حساب کاربری',robots:'noindex,nofollow'})
let timer:ReturnType<typeof setInterval>|undefined
onMounted(async()=>{if(!await ensure()){loading.value=false;return}try{const [list,svcs,profile]=await Promise.all([api.mine(),api.services(),api.me()]);bookings.value=list.data;services.value=collectionItems<BookingService>(svcs);auth.client.value=profile.data}catch(e){error.value=bookingMessage(e,t)}finally{loading.value=false}timer=window.setInterval(()=>now.value=Date.now(),60000)})
onUnmounted(()=>{if(timer)clearInterval(timer)})
</script>
<template>
 <div class="account-overview-page">
  <div class="account-greeting"><span class="eyebrow" style="color:#d9c4a5">حساب مراجع</span><h1>خوش آمدید، {{auth.client.value?.name||'همراه گرامی'}}</h1><p>نوبت‌های خود را از اینجا پیگیری کنید.</p></div>
  <ApiNotice v-if="error">{{error}}</ApiNotice><p v-if="loading">در حال دریافت اطلاعات حساب…</p>
  <template v-else>
   <div class="stat-row"><div class="stat-card"><small>نوبت‌های آینده</small><strong>{{upcoming.length}}</strong></div><div class="stat-card"><small>تعداد نوبت‌ها</small><strong>{{bookings.length}}</strong></div><div class="stat-card"><small>در انتظار پرداخت</small><strong>{{pendingPaymentCount}}</strong></div></div>
   <section class="overview-section"><div class="section-title"><h2>نوبت پیش رو</h2><NuxtLink :to="path('/account/appointments')">همه نوبت‌ها</NuxtLink></div>
    <NuxtLink v-if="next" class="overview-appointment-row overview-next-row" :to="path(`/account/appointments/${next.id}`)"><span class="overview-appointment-mark" aria-hidden="true"></span><span class="overview-appointment-copy"><strong>{{serviceName(next.booking_service_id)}}</strong><small>{{formatDate(next.starts_at)}} · {{next.mode==='in_person'?'حضوری':'آنلاین'}}</small></span><span class="status-pill">{{t(next.status as any)||next.status}}</span><span class="overview-countdown">{{countdown}} مانده</span><ArrowIcon direction="back"/></NuxtLink>
    <ApiNotice v-else>نوبت آینده‌ای ثبت نشده است.<NuxtLink class="more" :to="path('/appointment')"> درخواست نوبت <ArrowIcon direction="back" /></NuxtLink></ApiNotice>
   </section>
   <section v-if="latestBookings.length" class="overview-section"><div class="section-title"><h2>آخرین نوبت‌ها</h2><NuxtLink :to="path('/account/appointments')">مشاهده همه</NuxtLink></div>
    <div class="table-wrap overview-bookings-table"><table class="data-table"><caption class="sr-only">آخرین نوبت‌های شما</caption><thead><tr><th scope="col">خدمت</th><th scope="col">تاریخ</th><th scope="col">وضعیت</th><th scope="col">مانده</th><th scope="col">جزئیات</th></tr></thead><tbody><tr v-for="booking in latestBookings" :key="booking.id"><td>{{serviceName(booking.booking_service_id)}}</td><td>{{formatDate(booking.starts_at)}}</td><td><span class="status-pill" :data-status="booking.status">{{t(booking.status as any)||booking.status}}</span></td><td>{{money(booking.remaining_irr)}}</td><td><NuxtLink class="more" :to="path(`/account/appointments/${booking.id}`)">مشاهده</NuxtLink></td></tr></tbody></table></div>
    <div class="table-mobile overview-bookings-mobile"><article v-for="booking in latestBookings" :key="`overview-${booking.id}`" class="payment-card appointment-list-card"><div class="payment-card-heading"><strong>{{serviceName(booking.booking_service_id)}}</strong><span class="status-pill" :data-status="booking.status">{{t(booking.status as any)||booking.status}}</span></div><p>{{formatDate(booking.starts_at)}}</p><div class="appointment-mobile-footer"><span>مانده: {{money(booking.remaining_irr)}}</span><NuxtLink class="more" :to="path(`/account/appointments/${booking.id}`)">جزئیات <ArrowIcon direction="back"/></NuxtLink></div></article></div>
   </section>
  </template>
 </div>
</template>
