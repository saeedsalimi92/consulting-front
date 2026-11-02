<script setup lang="ts">
const route=useRoute(),api=useBookingApi(),auth=useClientAuth(),toast=useAppToast(),{path}=useSiteLocale()
const menuOpen=ref(false)
const mobileDrawer=ref<HTMLDialogElement|null>(null)
const authDialog=ref<{open:(redirect?:string)=>void}|null>(null)
const logoutDialog=ref<HTMLDialogElement|null>(null),logoutConfirm=ref(false)
const authIntent=useState<string|null>('auth-dialog-request',()=>null)
const appHydrated=ref(false)
useHead({htmlAttrs:{lang:'fa',dir:'rtl'}})
const accountBase=path('/account')
const authRoutes=['/account/login','/account/forgot','/account/reset','/account/register'].map(path)
const normalizedRoutePath=computed(()=>route.path.replace(/\/+$/,'')||'/')
const isProtectedAccountRoute=computed(()=>
 (normalizedRoutePath.value===accountBase||normalizedRoutePath.value.startsWith(`${accountBase}/`))&&!authRoutes.includes(normalizedRoutePath.value)
)
const isAccount=computed(()=>isProtectedAccountRoute.value&&Boolean(auth.token.value)&&auth.validated.value&&Boolean(auth.client.value))
const accountNeedsValidation=computed(()=>!auth.validated.value||!auth.client.value)
const authGateLoading=ref(false),authGateError=ref('')
const clinicName='کلینیک پرواز', clinicSubtitle='مرکز مشاوره و روان‌شناختی پرواز'
const showMobileBook=computed(()=>!route.path.startsWith('/account')&&route.path!=='/appointment')
const mobileActive=(item:'home'|'counselors'|'booking'|'profile')=>{
 const current=normalizedRoutePath.value
 if(item==='home')return current==='/'
 if(item==='counselors')return current==='/counselors'||current.startsWith('/counselors/')
 if(item==='booking')return current==='/appointment'
 return current==='/account'||current.startsWith('/account/')
}
async function openMobileProfile(){
 if(auth.token.value){await navigateTo(path('/account/profile'));return}
 await openLogin()
}
async function validateAccountRoute(){
 auth.restore()
 if(!isProtectedAccountRoute.value)return
 if(!auth.token.value){await auth.redirectToLogin(route.fullPath);return}
 if(auth.validated.value&&auth.client.value)return
 authGateLoading.value=true;authGateError.value=''
 try{await auth.validateSession(()=>api.authMe())}
 catch(error){const status=Number((error as any)?.statusCode||(error as any)?.status||(error as any)?.response?.status||0);if(status===401){auth.clear();await auth.redirectToLogin(route.fullPath)}else authGateError.value='بررسی نشست انجام نشد. اتصال را بررسی و دوباره تلاش کنید.'}
 finally{authGateLoading.value=false}
}
onMounted(()=>{auth.restore();appHydrated.value=true;void validateAccountRoute()})
watch(()=>route.fullPath,()=>{menuOpen.value=false;void validateAccountRoute()})
watch(menuOpen,async open=>{if(!import.meta.client)return;await nextTick();if(open&&!mobileDrawer.value?.open)mobileDrawer.value?.showModal();else if(!open&&mobileDrawer.value?.open)mobileDrawer.value.close()})
watch(authIntent,async destination=>{if(!destination)return;await nextTick();authDialog.value?.open(destination);authIntent.value=null})
watch(logoutConfirm,async open=>{await nextTick();if(open&&!logoutDialog.value?.open)logoutDialog.value?.showModal();else if(!open&&logoutDialog.value?.open)logoutDialog.value.close()})
async function logout(){let revoked=!auth.token.value;try{if(auth.token.value){await api.logout();revoked=true}}catch{revoked=false}finally{auth.clear();await navigateTo('/')}if(!revoked)toast.warning('در این دستگاه خارج شدید، اما لغو نشست در سرور تأیید نشد.')}
function requestLogout(){logoutConfirm.value=true}
function cancelLogout(){logoutConfirm.value=false}
async function confirmLogout(){logoutConfirm.value=false;await nextTick();await logout()}
async function openLogin(){menuOpen.value=false;if(mobileDrawer.value?.open)mobileDrawer.value.close();await nextTick();if(route.path==='/account/login'){document.querySelector<HTMLInputElement>('#main-content input[autocomplete="tel"]')?.focus();return}authDialog.value?.open(route.path==='/appointment'?route.fullPath:'/account/appointments')}
</script>
<template><div class="site-shell" :data-app-hydrated="appHydrated ? 'true' : undefined"><a class="skip-link" href="#main-content">رفتن به محتوای اصلی</a>
 <header class="site-header"><div class="container nav">
  <NuxtLink to="/" class="brand" :aria-label="`صفحه اصلی ${clinicName}`"><img src="/images/logo.png" alt="" width="50" height="50"/><span class="brand-copy"><strong>{{clinicName}}</strong><small>{{clinicSubtitle}}</small></span></NuxtLink>
  <button class="mobile-menu-toggle" type="button" aria-haspopup="dialog" :aria-expanded="menuOpen" aria-controls="mobile-navigation" aria-label="باز کردن منو" @click="menuOpen=true"><span aria-hidden="true">☰</span></button>
  <nav id="site-navigation" class="main-nav" aria-label="ناوبری اصلی">
   <NuxtLink to="/">خانه</NuxtLink><ServicesMenu/><NuxtLink to="/counselors">مشاوران</NuxtLink><NuxtLink to="/blog">مقالات</NuxtLink><NuxtLink to="/about">درباره ما</NuxtLink><NuxtLink to="/contact">تماس</NuxtLink>
  </nav>
  <div class="header-actions"><button v-if="!auth.token.value" class="nav-account" type="button" aria-label="ورود / حساب کاربری" title="ورود / حساب کاربری" @click="openLogin"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg></button><NuxtLink v-else class="nav-account" to="/account" aria-label="حساب کاربری" title="حساب کاربری"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg></NuxtLink><ThemeToggle/><NuxtLink class="nav-book-link" to="/appointment">دریافت نوبت <span aria-hidden="true"><ArrowIcon direction="back" /></span></NuxtLink><button v-if="auth.token.value" class="nav-button nav-logout" type="button" aria-label="خروج از حساب" title="خروج از حساب" @click="requestLogout"><LogoutIcon/></button></div>
 </div></header>
 <dialog id="mobile-navigation" ref="mobileDrawer" class="mobile-drawer" aria-label="ناوبری اصلی" @click.self="menuOpen=false" @cancel="menuOpen=false" @close="menuOpen=false">
  <div class="mobile-drawer-head"><NuxtLink to="/" class="brand" @click="menuOpen=false"><img src="/images/logo.png" alt="" width="42" height="42"/><span class="brand-copy"><strong>{{clinicName}}</strong><small>{{clinicSubtitle}}</small></span></NuxtLink><button class="drawer-close" type="button" aria-label="بستن منو" @click="menuOpen=false"><CloseIcon /></button></div>
  <nav class="mobile-drawer-links" aria-label="ناوبری تلفن همراه"><NuxtLink to="/" @click="menuOpen=false">خانه</NuxtLink><ServicesMenu mobile/><NuxtLink to="/counselors" @click="menuOpen=false">مشاوران</NuxtLink><NuxtLink to="/blog" @click="menuOpen=false">مقالات</NuxtLink><NuxtLink to="/about" @click="menuOpen=false">درباره ما</NuxtLink><NuxtLink to="/contact" @click="menuOpen=false">تماس</NuxtLink></nav>
  <div class="mobile-drawer-actions"><ThemeToggle/><button v-if="!auth.token.value" class="nav-account" type="button" @click="menuOpen=false;openLogin()">ورود</button><NuxtLink v-else class="nav-account" to="/account" @click="menuOpen=false">حساب من</NuxtLink><NuxtLink class="nav-book-link" to="/appointment" @click="menuOpen=false">دریافت نوبت</NuxtLink></div>
 </dialog>
 <nav class="mobile-bottom-nav" aria-label="ناوبری اصلی موبایل">
  <NuxtLink :to="path('/')" :aria-current="mobileActive('home')?'page':undefined" :class="{'is-active':mobileActive('home')}">
   <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg><span>خانه</span>
  </NuxtLink>
  <button type="button" :aria-current="mobileActive('profile')?'page':undefined" :class="{'is-active':mobileActive('profile')}" aria-label="پروفایل" @click="openMobileProfile">
   <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/></svg><span>پروفایل</span>
  </button>
  <NuxtLink :to="path('/appointment')" :aria-current="mobileActive('booking')?'page':undefined" :class="{'is-active':mobileActive('booking')}">
   <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17M8 13h2m4 0h2m-8 4h2m4 0h2"/></svg><span>دریافت نوبت</span>
  </NuxtLink>
  <NuxtLink :to="path('/counselors')" :aria-current="mobileActive('counselors')?'page':undefined" :class="{'is-active':mobileActive('counselors')}">
   <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0m2-9a3 3 0 1 0 0-6m1 9a5 5 0 0 1 3 4.5"/></svg><span>مشاوران</span>
  </NuxtLink>
 </nav>
 <main id="main-content" tabindex="-1"><section v-if="isProtectedAccountRoute&&accountNeedsValidation" class="account-auth-gate" role="status" aria-live="polite"><p v-if="authGateLoading">در حال بررسی نشست حساب کاربری…</p><template v-else><p>{{authGateError||'برای ادامه، ورود به حساب لازم است.'}}</p><button v-if="authGateError" class="btn secondary" type="button" @click="validateAccountRoute">تلاش دوباره</button></template></section><template v-else><div v-if="isAccount" class="container section account-layout"><aside class="account-nav" aria-label="ناوبری حساب"><NuxtLink to="/account">نمای کلی</NuxtLink><NuxtLink to="/account/profile">اطلاعات من</NuxtLink><NuxtLink to="/account/appointments">نوبت‌های من</NuxtLink><NuxtLink to="/account/payments">پرداخت‌ها</NuxtLink><NuxtLink to="/account/notifications">اعلان‌ها</NuxtLink><NuxtLink to="/account/settings">تنظیمات</NuxtLink><button class="nav-button account-logout" type="button" @click="requestLogout"><LogoutIcon/><span>خروج</span></button></aside><div class="account-content"><NuxtPage/></div></div><NuxtPage v-else/></template></main>
 <dialog ref="logoutDialog" class="confirm-dialog logout-confirm-dialog" aria-labelledby="logout-dialog-title" aria-describedby="logout-dialog-description" @click.self="cancelLogout" @cancel.prevent="cancelLogout"><h2 id="logout-dialog-title">از حساب خارج می‌شوید؟</h2><p id="logout-dialog-description">برای ادامه، خروج از حساب را تأیید کنید.</p><div class="actions"><button class="btn secondary" type="button" @click="cancelLogout">بازگشت</button><button class="btn" type="button" @click="confirmLogout">خروج از حساب</button></div></dialog>
 <NuxtLink v-if="showMobileBook" class="mobile-book-cta" to="/appointment">انتخاب زمان نوبت <span aria-hidden="true"><ArrowIcon direction="back" /></span></NuxtLink>
 <footer class="site-footer"><div class="container footer-columns"><div class="footer-brand"><NuxtLink to="/" class="brand"><img src="/images/logo.png" alt="" width="54" height="54"/><span class="brand-copy"><strong>{{clinicName}}</strong><small>{{clinicSubtitle}}</small></span></NuxtLink><p>برای آشنایی با خدمات و مشاوران مرکز و بررسی زمان‌های قابل رزرو.</p><ThemeToggle/></div><nav class="footer-column" aria-label="خدمات مرکز"><h2>مرکز</h2><NuxtLink to="/about">درباره ما</NuxtLink><NuxtLink to="/service">خدمات و تخصص‌ها</NuxtLink><NuxtLink to="/counselors">مشاوران</NuxtLink><NuxtLink to="/gallery">گالری تصاویر</NuxtLink></nav><nav class="footer-column" aria-label="راهنما و مطالعه"><h2>راهنما و مطالعه</h2><NuxtLink to="/faq">پرسش‌های متداول</NuxtLink><NuxtLink to="/blog">مقاله‌ها</NuxtLink><NuxtLink to="/appointment">نوبت‌دهی</NuxtLink><NuxtLink to="/contact">تماس با مرکز</NuxtLink></nav><div class="footer-contact"><h2>برای شروع</h2><p>فهرست مشاوران و خدمات را ببینید یا مستقیماً به نوبت‌دهی بروید.</p><NuxtLink class="btn" to="/appointment">درخواست نوبت</NuxtLink><NuxtLink class="footer-contact-link" to="/contact">راه‌های ارتباطی مرکز <ArrowIcon direction="back" /></NuxtLink></div></div><div class="container footer-bottom"><span>{{clinicName}} · {{clinicSubtitle}}</span><span>اطلاعات خدمات و زمان‌ها از سامانه دریافت می‌شود.</span></div></footer>
 <AuthDialog ref="authDialog"/>
 <RecaptchaBadgeHost/>
 <AppToastHost/>
</div></template>
