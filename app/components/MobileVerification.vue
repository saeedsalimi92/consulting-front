<script setup lang="ts">
import type {Client} from '~/types/booking'
import {formatOtpCountdown,retryAfterSeconds} from '~/composables/otpAuthUtils.mjs'
const emit=defineEmits<{verified:[client:Client]}>()
const api=useBookingApi(),flow=useOtpAuth(),auth=useClientAuth(),toast=useAppToast(),mobile=ref(''),code=ref(''),busy=ref(false),error=ref(''),stage=ref<'mobile'|'code'>('mobile'),now=ref(Date.now())
let timer:number|undefined
const challenge=flow.challenge
const requestWait=computed(()=>{now.value;return flow.cooldownSeconds(mobile.value)})
const resendSeconds=computed(()=>Math.max(0,Math.ceil(((challenge.value?.resendAt||0)-now.value)/1000)))
const expiresSeconds=computed(()=>Math.max(0,Math.ceil(((challenge.value?.expiresAt||0)-now.value)/1000)))
onMounted(()=>{const stored=flow.restore();if(stored?.purpose==='mobile_change'){mobile.value=stored.mobile;stage.value='code'}timer=window.setInterval(()=>now.value=Date.now(),1000)})
onBeforeUnmount(()=>{if(timer)window.clearInterval(timer)})
async function requestCode(resend=false){
 if(busy.value)return
 busy.value=true;error.value=''
 try{await flow.request(mobile.value,'mobile_change',resend);mobile.value=challenge.value?.mobile||mobile.value;code.value='';stage.value='code'}
 catch(e){error.value=otpErrorMessage(e);const issue=e as {status?:number;statusCode?:number};if(issue.status===429||issue.statusCode===429){const wait=retryAfterSeconds(e);if(wait)flow.delayResend(wait,mobile.value,true)}else if(!issue.status||issue.status>=500||issue.statusCode===503)toast.error(otpErrorMessage(e))}
 finally{busy.value=false}
}
async function verify(){
 if(busy.value)return
 busy.value=true;error.value=''
 try{await flow.verify(code.value);flow.clear();const result=await api.authMe();auth.client.value=result.data;emit('verified',result.data);toast.success('شماره موبایل تأیید شد.')}
 catch(e){error.value=otpErrorMessage(e);const issue=e as {status?:number;statusCode?:number};if(!issue.status||issue.status>=500)toast.error(otpErrorMessage(e))}finally{busy.value=false}
}
function reset(){flow.clear();stage.value='mobile';code.value='';error.value=''}
</script>
<template>
 <section class="mobile-verify" aria-labelledby="mobile-verify-title">
  <h3 id="mobile-verify-title">{{stage==='mobile'?'تغییر شماره موبایل':'تأیید شماره جدید'}}</h3>
  <form v-if="stage==='mobile'" class="mobile-verify-form" @submit.prevent="requestCode()">
   <label>شماره موبایل جدید<input v-model.trim="mobile" type="tel" dir="ltr" inputmode="tel" autocomplete="tel" placeholder="۰۹۱۲۳۴۵۶۷۸۹" required></label>
   <button class="btn secondary" type="submit" :disabled="busy||requestWait>0">{{busy?'در حال ارسال…':requestWait?`ارسال کد پس از ${formatOtpCountdown(requestWait)}`:'ارسال کد تأیید'}}</button>
  </form>
  <form v-else class="mobile-verify-form" @submit.prevent="verify">
   <p>کد ارسال‌شده به <bdi dir="ltr">{{mobile}}</bdi> را وارد کنید.</p>
   <label>کد شش‌رقمی<input v-model.trim="code" type="text" dir="ltr" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="— — — — — —" required @input="code=normalizePersianDigits(code).replace(/\D/g,'').slice(0,6)"></label>
   <p class="otp-flow-timer">{{expiresSeconds?`اعتبار کد: ${Math.floor(expiresSeconds/60)}:${String(expiresSeconds%60).padStart(2,'0')}`:'مهلت کد پایان یافته است.'}}</p>
   <button class="btn" type="submit" :disabled="busy||expiresSeconds===0">{{busy?'در حال بررسی…':'تأیید شماره'}}</button>
   <button class="otp-resend" type="button" :disabled="busy||resendSeconds>0" @click="requestCode(true)">{{resendSeconds?`ارسال دوباره تا ${formatOtpCountdown(resendSeconds)}`:'ارسال دوباره کد'}}</button>
   <button class="otp-resend" type="button" :disabled="busy" @click="reset">تغییر شماره</button>
  </form>
  <ApiNotice v-if="error">{{error}}</ApiNotice>
 </section>
</template>
