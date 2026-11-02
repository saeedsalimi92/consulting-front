<script setup lang="ts">
import type {BookingService} from '~/types/booking'
const props=defineProps<{counselorId:number}>()
const {t,path,money}=useSiteLocale(),api=useBookingApi()
const services=ref<BookingService[]>([]),busy=ref(true),error=ref('')
async function load(){busy.value=true;error.value='';try{const response=await api.counselorServices(props.counselorId);services.value=(response.data||[]).map(item=>({...item,id:item.service_id}))}catch(e){error.value=bookingMessage(e,t)}finally{busy.value=false}}
onMounted(load);watch(()=>props.counselorId,load)
</script>
<template><section class="booking-services"><h2>{{t('book')}}</h2><p v-if="busy">{{t('loading')}}</p><ApiNotice v-else-if="error">{{error}}</ApiNotice><div v-else-if="services.length" class="cards"><article v-for="service in services" :key="service.id" class="card"><h3>{{service.title}}</h3><p>{{t('duration')}}: {{service.duration_minutes}} {{t('minutes')}}</p><p>{{t('price')}}: {{money(service.price_irr)}}</p><p>{{t('deposit')}}: {{money(service.deposit_irr)}}</p><small class="muted">مبلغ نهایی مشاور پس از رزرو در جزئیات نوبت مشخص می‌شود.</small><NuxtLink class="btn" :to="{path:path('/appointment'),query:{counselor:props.counselorId,service:service.id}}">{{t('book')}}</NuxtLink></article></div><ApiNotice v-else>{{t('noServices')}}</ApiNotice></section></template>
