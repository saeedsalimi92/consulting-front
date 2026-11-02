<script setup lang="ts">
import {normalizeAppError} from '~/composables/toastUtils.mjs'
const route=useRoute(),api=useBookingApi(),auth=useClientAuth(),otp=useOtpAuth(),toast=useAppToast(),{t,path}=useSiteLocale()
const action=computed(()=>String(route.params.action))
definePageMeta({middleware:[to=>to.params.action==='register'?navigateTo({path:'/account/login',query:to.query},{redirectCode:301}):undefined]})
if(!['login','forgot','reset'].includes(action.value))throw createError({statusCode:404,statusMessage:'صفحه پیدا نشد'})
const form=reactive({email:String(route.query.email||''),password:'',password_confirmation:'',token:String(route.query.token||'')})
const busy=ref(false),error=ref(''),showPassword=ref(false),showConfirmation=ref(false)
const loginSessionChecking=ref(action.value==='login'),loginSessionError=ref('')
const title=computed(()=>action.value==='forgot'?'بازیابی رمز عبور':action.value==='reset'?'تنظیم رمز تازه':'ورود به حساب کاربری')
useSeoMeta({title:()=>t(action.value==='forgot'?'forgot':action.value==='reset'?'reset':'login'),robots:'noindex,nofollow'})
const safeRedirect=(value:string)=>{
 const destinationPath=value.split(/[?#]/,1)[0]||''
 const authPaths=['/account/login','/account/forgot','/account/reset','/account/register'].map(path)
 return value.startsWith('/')&&!value.startsWith('//')&&!/[\\\u0000-\u001f]/.test(value)&&!authPaths.includes(destinationPath)?value:path('/account/appointments')
}
async function redirectAuthenticatedLogin(){
 if(action.value!=='login')return
 auth.restore()
 if(!auth.token.value){loginSessionChecking.value=false;loginSessionError.value='';return}
 loginSessionChecking.value=true;loginSessionError.value=''
 try{
  const current=await auth.validateSession(()=>api.authMe(),true)
  if(current)await navigateTo(safeRedirect(String(route.query.redirect||'/account/appointments')),{replace:true})
  else loginSessionChecking.value=false
 }catch(problem){
  const status=Number((problem as any)?.statusCode||(problem as any)?.status||(problem as any)?.response?.status||0)
  if(status===401){auth.clear();loginSessionChecking.value=false}
  else{loginSessionError.value='بررسی نشست انجام نشد. اتصال را بررسی و دوباره تلاش کنید.';loginSessionChecking.value=false}
 }
}
onMounted(()=>{void redirectAuthenticatedLogin()})
watch(action,current=>{loginSessionError.value='';loginSessionChecking.value=current==='login';if(current==='login')void redirectAuthenticatedLogin()})
async function submit(){
 if(busy.value)return
 busy.value=true;error.value=''
 try{
  if(action.value==='forgot'){
   await api.forgot(form.email,await otp.recaptchaToken('password_reset_request'))
   toast.info(t('resetSent'))
  }else{
   await api.reset({token:form.token,email:form.email,password:form.password,password_confirmation:form.password_confirmation})
   auth.clear();toast.success('رمز عبور با موفقیت تغییر کرد.')
   await navigateTo({path:path('/account/login'),query:route.query.redirect?{redirect:safeRedirect(String(route.query.redirect))}:{}})
  }
 }catch(problem){error.value=otpErrorMessage(problem);const normalized=normalizeAppError(problem);if(normalized.status===0||normalized.status>=500||normalized.code==='CAPTCHA_UNAVAILABLE'||normalized.code==='CAPTCHA_INVALID')toast.error(normalized.message)}finally{busy.value=false}
}
function accountRoute(target:string){return{path:path(target),query:route.query.redirect?{redirect:safeRedirect(String(route.query.redirect))}:{}}}
</script>
<template>
 <div class="auth-page auth-page-minimal"><section class="auth-card auth-card-minimal" :aria-labelledby="`auth-title-${action}`">
  <template v-if="action==='login'"><p v-if="loginSessionChecking" role="status">در حال بررسی نشست حساب کاربری…</p><div v-else-if="loginSessionError" class="account-auth-gate"><ApiNotice>{{loginSessionError}}</ApiNotice><button class="btn secondary" type="button" @click="redirectAuthenticatedLogin">تلاش دوباره</button></div><OtpLoginFlow v-else :redirect-to="safeRedirect(String(route.query.redirect||'/account/appointments'))"/></template>
  <template v-else>
   <NuxtLink to="/" class="brand auth-card-brand"><img src="/images/logo.png" alt="" width="42" height="42"><span class="brand-copy"><strong>کلینیک پرواز</strong><small>مرکز مشاوره و روان‌شناختی پرواز</small></span></NuxtLink>
   <header class="auth-page-heading"><h1 :id="`auth-title-${action}`">{{title}}</h1><p>{{action==='forgot'?'ایمیل حساب را وارد کنید تا درخواست بازیابی ثبت شود.':'رمز جدید را برای حساب خود تعیین کنید.'}}</p></header>
   <form class="auth-form unified-auth-form" @submit.prevent="submit">
    <label>ایمیل<input v-model.trim="form.email" type="email" inputmode="email" autocomplete="email" required></label>
    <label v-if="action==='reset'">توکن بازیابی<input v-model.trim="form.token" autocomplete="off" required></label>
    <label v-if="action==='reset'">رمز عبور جدید<span class="auth-password-wrap"><input v-model="form.password" :type="showPassword?'text':'password'" minlength="12" autocomplete="new-password" required><button class="password-visibility" type="button" :aria-label="showPassword?'پنهان کردن رمز':'نمایش رمز'" @mousedown.prevent @click="showPassword=!showPassword"><svg v-if="!showPassword" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg><svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.2A10.6 10.6 0 0 1 12 6c6.2 0 9.5 6 9.5 6a14 14 0 0 1-3 3.5M6.2 6.2C3.8 7.8 2.5 12 2.5 12s3.3 6 9.5 6c.8 0 1.5-.1 2.2-.3"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg></button></span></label>
    <label v-if="action==='reset'">تکرار رمز عبور<span class="auth-password-wrap"><input v-model="form.password_confirmation" :type="showConfirmation?'text':'password'" minlength="12" autocomplete="new-password" required><button class="password-visibility" type="button" :aria-label="showConfirmation?'پنهان کردن رمز':'نمایش رمز'" @mousedown.prevent @click="showConfirmation=!showConfirmation"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg></button></span></label>
    <ApiNotice v-if="error">{{error}}</ApiNotice><button class="auth-submit" type="submit" :disabled="busy">{{busy?'در حال انجام…':action==='forgot'?'ارسال درخواست':'تنظیم رمز عبور'}}</button>
   </form>
   <NuxtLink class="auth-text-action" :to="accountRoute('/account/login')">بازگشت به ورود</NuxtLink>
  </template>
 </section></div>
</template>
