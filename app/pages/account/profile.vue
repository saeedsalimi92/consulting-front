<script setup lang="ts">
import type {Client} from '~/types/booking'
import {todayInTehran} from '~/utils/jalaliDate.mjs'
const {t,path}=useSiteLocale(),api=useBookingApi(),toast=useAppToast(),{auth,ensure}=usePrivatePage(),route=useRoute()
const profile=ref<Partial<Client>>({}),busy=ref(false),loading=ref(true),error=ref(''),saved=ref(false)
useSeoMeta({title:()=>t('profile'),robots:'noindex,nofollow'})
function safeDestination(value:string){return value.startsWith('/')&&!value.startsWith('//')&&!/[\\\u0000-\u001f]/.test(value)?value:''}
onMounted(async()=>{if(!await ensure())return;try{const response=await api.authMe();profile.value={...response.data};auth.client.value=response.data}catch(e){error.value=bookingMessage(e,t)}finally{loading.value=false}})
async function refreshProfile(){const response=await api.authMe();profile.value={...response.data};auth.client.value=response.data;return response.data}
async function save(){
 if(busy.value)return
 busy.value=true;error.value='';saved.value=false
 try{
  await api.updateAuthProfile({first_name:profile.value.first_name?.trim()||'',last_name:profile.value.last_name?.trim()||'',birth_date:profile.value.birth_date||null,address:profile.value.address||null})
  const fresh=await refreshProfile();saved.value=true;toast.success('اطلاعات شما ذخیره شد.')
  const destination=safeDestination(String(route.query.redirect||''))
  if(fresh.profile_complete&&destination)await navigateTo(destination)
  else if(!fresh.profile_complete&&fresh.missing_profile_fields?.length)error.value=`اطلاعات تکمیل‌نشده: ${fresh.missing_profile_fields.map(field=>field==='first_name'?'نام':field==='last_name'?'نام خانوادگی':field==='mobile'?'تأیید شماره موبایل':field).join('، ')}`
 }catch(e){error.value=bookingMessage(e,t)}finally{busy.value=false}
}
function onMobileVerified(client:Client){profile.value={...profile.value,...client}}
</script>
<template>
 <section class="account-subpage account-profile-page">
  <header class="profile-page-heading"><div><h1>{{t('profile')}}</h1><p>اطلاعات و وضعیت حساب کاربری</p></div><span v-if="profile.profile_complete" class="profile-completion-badge is-complete">اطلاعات تکمیل است</span><span v-else-if="!loading" class="profile-completion-badge">نیاز به تکمیل</span></header>
  <p v-if="loading">{{t('loading')}}</p>
  <template v-else>
   <form class="booking-form account-profile-form" @submit.prevent="save">
    <label>نام<input v-model.trim="profile.first_name" required autocomplete="given-name" maxlength="120"></label>
    <label>نام خانوادگی<input v-model.trim="profile.last_name" required autocomplete="family-name" maxlength="120"></label>
    <label>{{t('email')}}<input :value="profile.email||'—'" disabled type="email" autocomplete="email"></label>
    <label>شماره موبایل تأییدشده<input :value="profile.phone||'ثبت نشده'" disabled type="tel" dir="ltr"></label>
    <label>{{t('birthDate')}}<JalaliDatePicker :model-value="profile.birth_date || ''" @update:model-value="profile.birth_date = $event" :label="t('birthDate')" :max="todayInTehran()" /></label>
    <label class="profile-address-field">{{t('address')}}<textarea v-model.trim="profile.address" rows="2"></textarea></label>
    <div class="profile-account-status"><span><small>وضعیت شماره</small><strong :data-verified="Boolean(profile.mobile_verified||profile.phone_verified_at)">{{profile.mobile_verified||profile.phone_verified_at?'تأییدشده':'تأییدنشده'}}</strong></span><span><small>رمز عبور</small><strong>{{profile.has_password?'تنظیم شده':'تنظیم نشده'}}</strong></span></div>
    <ApiNotice v-if="error" class="profile-form-notice">{{error}}</ApiNotice><ApiNotice v-if="saved" class="profile-form-notice">اطلاعات ذخیره شد.</ApiNotice>
    <button class="btn profile-save-button" :disabled="busy">{{busy?t('loading'):t('save')}}</button>
   </form>
   <MobileVerification @verified="onMobileVerified" />
   <NuxtLink class="profile-back-link" :to="path('/account/appointments')">{{t('dashboard')}}</NuxtLink>
  </template>
 </section>
</template>
