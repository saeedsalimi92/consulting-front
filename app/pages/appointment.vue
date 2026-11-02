<script setup lang="ts">
import type { Booking, BookingService, BookingSlot } from '~/types/booking'
import {addGregorianMonths, parseGregorianDateKey, todayInTehran} from '~/utils/jalaliDate.mjs'

const route = useRoute()
const router = useRouter()
const api = useBookingApi()
const runtimeConfig = useRuntimeConfig()
const toast = useAppToast()
const auth = useClientAuth()
const { t, path, formatDate, money } = useSiteLocale()
const authIntent = useState<string | null>('auth-dialog-request', () => null)
const { data: counselors, error: counselorError, pending: counselorPending } = await useBackend().counselors({ per_page: 100 })

const services = ref<BookingService[]>([])
const slots = ref<BookingSlot[]>([])
const counselorId = ref(Number(route.query.counselor) || 0)
const serviceId = ref(Number(route.query.service) || 0)
const counselorQuery = ref('')
const promoCode = ref(String(route.query.promo_code || ''))
const paymentOption = ref<'full' | 'deposit' | ''>(route.query.payment === 'deposit' ? 'deposit' : route.query.payment === 'full' ? 'full' : '')
const sessionMode = ref<'in_person' | 'meet' | 'voice_call'>(route.query.session_mode === 'voice_call' ? 'voice_call' : route.query.mode === 'in_person' ? 'in_person' : 'meet')
const mode = computed<'online' | 'in_person'>(() => sessionMode.value === 'in_person' ? 'in_person' : 'online')
const start = ref('')
const selectedStarts = ref<string[]>([])
const busy = ref(false)
const loadingServices = ref(false)
const loadingSlots = ref(false)
const error = ref('')
const step = ref(1)
const createdBookingIds = ref<number[]>([])
const reservedStarts = ref<string[]>([])
const createdBookings = ref<Booking[]>([])
const pendingPaymentBooking = ref<Booking | null>(null)
const paymentBusy = ref(false)
const paymentError = ref('')
const gatewayUrl = ref('')
const paymentIdempotencyKeys = new Map<number, string>()
const suppressSlotWatch = ref(true)
const resumeInProgress = ref(false)

const today = todayInTehran()
const maxDay = addGregorianMonths(today, 3)
const requestedDate = typeof route.query.date === 'string' ? route.query.date : ''
const date = ref(parseGregorianDateKey(requestedDate) && requestedDate >= today && requestedDate <= maxDay ? requestedDate : today)
const service = computed(() => services.value.find(item => item.id === serviceId.value))
const counselor = computed(() => counselors.value?.data?.find(item => item.id === counselorId.value))
const profileCounselorSelected = computed(() => counselorId.value > 0 && counselorId.value === Number(route.query.counselor))
const freeSlots = computed(() => slots.value.filter(item => item.available && new Date(item.starts_at).getTime() > Date.now()))
const orderedSelectedStarts = computed(() => [...selectedStarts.value].sort((a, b) => new Date(a).getTime() - new Date(b).getTime()))
const visibleCounselors = computed(() => {
  const query = counselorQuery.value.trim().toLocaleLowerCase('fa-IR')
  const list = counselors.value?.data || []
  return query ? list.filter(person => `${person.name} ${person.degree || ''} ${(person.specialties || []).map(item => item.title).join(' ')}`.toLocaleLowerCase('fa-IR').includes(query)) : list.slice(0, 9)
})
const stepDigits = ['۱', '۲', '۳', '۴', '۵']
const steps = [
  { title: 'خدمت و مشاور', short: 'انتخاب' },
  { title: 'تاریخ و زمان', short: 'زمان' },
  { title: 'نوع جلسه و پرداخت', short: 'جلسه و پرداخت' },
  { title: 'مرور و ثبت نوبت', short: 'مرور' },
  { title: 'نتیجه رزرو', short: 'نتیجه' },
]

useSeoMeta({ title: () => t('book') })

async function loadServices() {
  services.value = []
  slots.value = []
  serviceId.value = 0
  start.value = ''
  selectedStarts.value = []
  if (!counselorId.value) return
  loadingServices.value = true
  error.value = ''
  try {
    const response = await api.counselorServices(counselorId.value)
    services.value = (response.data || []).map(item => ({ ...item, id: item.service_id }))
    const requested = Number(route.query.service)
    if (services.value.some(item => item.id === requested)) serviceId.value = requested
  } catch (cause) {
    error.value = bookingMessage(cause, t)
  } finally {
    loadingServices.value = false
  }
}
async function loadSlots() {
  slots.value = []
  start.value = ''
  selectedStarts.value = []
  if (!counselorId.value || !serviceId.value || !date.value) return
  loadingSlots.value = true
  error.value = ''
  try {
    slots.value = (await api.availability(counselorId.value, serviceId.value, date.value)).slots
    const requestedQuery = route.query.starts
    const requested = [String(route.query.start || ''), ...(Array.isArray(requestedQuery) ? requestedQuery.map(String) : String(requestedQuery || '').split(','))].filter(Boolean)
    selectedStarts.value = [...new Set(requested)].filter(value => slots.value.some(item => item.starts_at === value && item.available))
    start.value = orderedSelectedStarts.value[0] || ''
  } catch (cause) {
    error.value = bookingMessage(cause, t)
  } finally {
    loadingSlots.value = false
  }
}
onMounted(async () => {
  if (counselorId.value) {
    await loadServices()
    suppressSlotWatch.value = false
    if (serviceId.value) {
      step.value = 2
      await loadSlots()
    }
  } else {
    suppressSlotWatch.value = false
  }
  if (route.query.resume_payment === '1') await resumePendingBooking()
})
watch(counselorId, async () => {
  suppressSlotWatch.value = true
  paymentOption.value = ''
  await loadServices()
  step.value = 1
  suppressSlotWatch.value = false
  if (serviceId.value) await loadSlots()
})
watch(serviceId, (value, previous) => {
  if (suppressSlotWatch.value) return
  if (previous && value !== previous) paymentOption.value = ''
  start.value = ''; selectedStarts.value = []
  if (value) loadSlots()
})
watch(date, () => { if (!suppressSlotWatch.value) loadSlots() })
function canChooseTime() { return !!(counselorId.value && service.value && !loadingSlots.value) }
function canContinueTime() { return !!(canChooseTime() && selectedStarts.value.length) }
function canContinuePayment() { return paymentOption.value === 'full' || (paymentOption.value === 'deposit' && (service.value?.deposit_irr || 0) > 0) }
function toggleSlot(startsAt: string) {
  error.value = ''
  if (selectedStarts.value.includes(startsAt)) {
    selectedStarts.value = selectedStarts.value.filter(value => value !== startsAt)
  } else {
    const candidateStart = new Date(startsAt).getTime()
    const candidateEnd = candidateStart + (service.value?.duration_minutes || 0) * 60_000
    const overlaps = selectedStarts.value.some(value => {
      const selectedStart = new Date(value).getTime()
      const selectedEnd = selectedStart + (service.value?.duration_minutes || 0) * 60_000
      return candidateStart < selectedEnd && selectedStart < candidateEnd
    })
    if (overlaps) { error.value = 'این زمان با یکی از نوبت‌های انتخاب‌شده هم‌پوشانی دارد.'; return }
    selectedStarts.value = [...selectedStarts.value, startsAt]
  }
  start.value = orderedSelectedStarts.value[0] || ''
}
function bookingDestination() {
  const query = {
    counselor: String(counselorId.value), service: String(serviceId.value), date: date.value,
    start: start.value, starts: selectedStarts.value.join(','), mode: mode.value, session_mode: sessionMode.value,
    payment: paymentOption.value,
    ...(promoCode.value.trim() ? { promo_code: promoCode.value.trim() } : {}),
  }
  return `${path('/appointment')}?${new URLSearchParams(query)}`
}
function resumeDestination() {
  const destination = bookingDestination()
  const separator = destination.includes('?') ? '&' : '?'
  return `${destination}${separator}resume_payment=1`
}
function goToLogin() {
  authIntent.value = resumeDestination()
}
async function goToProfileCompletion(){
  await navigateTo({path:path('/account/profile'),query:{redirect:resumeDestination()}})
}

function safeGatewayUrl(value: string) {
  const destination = new URL(value, String(runtimeConfig.public.apiBase || window.location.origin))
  const localHttp = destination.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(destination.hostname)
  if ((destination.protocol !== 'https:' && !localHttp) || destination.username || destination.password) {
    throw new Error('درگاه پرداخت نشانی امنی برنگرداند.')
  }
  return destination.href
}

async function startPayment(booking: Booking) {
  if (paymentBusy.value) return
  pendingPaymentBooking.value = booking
  const amountIrr = Math.min(booking.remaining_irr, Math.max(0, booking.required_irr - booking.paid_irr))
  if (!Number.isSafeInteger(amountIrr) || amountIrr < 1) {
    paymentError.value = 'مبلغ قابل پرداخت برای این رزرو در دسترس نیست.'
    return
  }
  paymentBusy.value = true
  paymentError.value = ''
  gatewayUrl.value = ''
  const idempotencyKey = paymentIdempotencyKeys.get(booking.id) || crypto.randomUUID()
  paymentIdempotencyKeys.set(booking.id, idempotencyKey)
  try {
    const response = await api.initiate(booking.id, amountIrr, idempotencyKey)
    const payment = response.data
    if (payment.status === 'verified' && payment.payment_id) {
      await navigateTo({path: path('/fake-bank'), query: {payment_id: String(payment.payment_id)}})
      return
    }
    if (!payment.url) {
      paymentError.value = 'درگاه پرداخت فعلاً در دسترس نیست. می‌توانید برای همین رزرو دوباره تلاش کنید.'
      return
    }
    gatewayUrl.value = safeGatewayUrl(payment.url)
    await navigateTo(gatewayUrl.value, {external: true})
  } catch (cause) {
    paymentError.value = bookingMessage(cause, t)
  } finally {
    paymentBusy.value = false
  }
}

async function payCreatedBooking(index = 0) {
  const booking = createdBookings.value[index]
  if (!booking) return
  step.value = 5
  pendingPaymentBooking.value = booking
  await startPayment(booking)
}

function paymentRecoveryUrl(booking: Booking) {
  return path(`/account/appointments/${booking.id}`)
}

async function resumePendingBooking() {
  if (resumeInProgress.value) return
  resumeInProgress.value = true
  const query = {...route.query}
  delete query.resume_payment
  await router.replace({query})
  if (!counselorId.value || !service.value || !selectedStarts.value.length || !canContinuePayment()) {
    error.value = 'انتخاب نوبت بازیابی نشد. لطفاً زمان را دوباره بررسی کنید.'
    resumeInProgress.value = false
    return
  }
  step.value = 4
  await reserve()
  resumeInProgress.value = false
}

async function reserve() {
  if (busy.value || paymentBusy.value || !canContinuePayment() || !canContinueTime()) return
  busy.value = true
  error.value = ''
  auth.restore()
  if (!auth.token.value) {
    busy.value = false
    goToLogin()
    return
  }
  try {
    const currentProfile=await api.authMe()
    auth.client.value=currentProfile.data
    if(currentProfile.data.profile_complete===false){await goToProfileCompletion();return}
    const requestedStarts = orderedSelectedStarts.value
    for (let index = 0; index < requestedStarts.length; index++) {
      const startsAt = requestedStarts[index]
      if (!startsAt) continue
      const refreshed = await api.availability(counselorId.value, serviceId.value, date.value)
      slots.value = refreshed.slots
      const isAvailable = refreshed.slots.some(item => item.starts_at === startsAt && item.available && new Date(item.starts_at).getTime() > Date.now())
      if (!isAvailable) {
        selectedStarts.value = requestedStarts.slice(index + 1)
        start.value = orderedSelectedStarts.value[0] || ''
        if (createdBookings.value.length) {
          error.value = `این ساعت دیگر آزاد نیست. رزرو قبلی حفظ شده و پرداخت آن را ادامه دهید. ${t('conflict')}`
          await payCreatedBooking()
        } else {
          step.value = 2
          error.value = t('conflict')
        }
        return
      }
      try {
      const response = await api.reserve({
          counselor_id: counselorId.value,
          service_id: serviceId.value,
          starts_at: startsAt,
          mode: mode.value,
          session_mode: sessionMode.value,
          payment_option: paymentOption.value,
          ...(promoCode.value.trim() ? { promo_code: promoCode.value.trim() } : {}),
      })
      createdBookingIds.value = [...createdBookingIds.value, response.data.id]
      reservedStarts.value = [...reservedStarts.value, startsAt]
      createdBookings.value = [...createdBookings.value, response.data]
      } catch (cause) {
        if((cause as any)?.data?.code==='PROFILE_INCOMPLETE'){await goToProfileCompletion();return}
        selectedStarts.value = requestedStarts.slice(index)
        start.value = orderedSelectedStarts.value[0] || ''
        const message = bookingMessage(cause, t)
        if (createdBookingIds.value.length) {
          error.value = `ثبت یکی از زمان‌ها کامل نشد؛ رزرو قبلی حفظ شده است. ${message}`
          await payCreatedBooking()
          return
        }
        if ([409, 422].includes((cause as any)?.statusCode)) step.value = 2
        error.value = message
        return
      }
    }
    selectedStarts.value = []
    start.value = ''
    step.value = 5
    pendingPaymentBooking.value = createdBookings.value[0] || null
    if (pendingPaymentBooking.value) {
      toast.info('رزرو موقت ثبت شد؛ در حال انتقال به درگاه پرداخت.')
      await startPayment(pendingPaymentBooking.value)
    }
    if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (cause) {
    if((cause as any)?.data?.code==='PROFILE_INCOMPLETE'){await goToProfileCompletion();return}
    const message = bookingMessage(cause, t)
    if (createdBookingIds.value.length) {
      selectedStarts.value = selectedStarts.value.filter(value => !reservedStarts.value.includes(value))
      start.value = orderedSelectedStarts.value[0] || ''
      error.value = `رزرو قبلی حفظ شده است؛ پرداخت آن را ادامه دهید. ${message}`
      await payCreatedBooking()
      return
    }
    if ([409, 422].includes((cause as any)?.statusCode)) { step.value = 2; await loadSlots() }
    error.value = message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="booking-experience">
    <header class="booking-heading">
      <div>
        <span class="eyebrow">رزرو جلسه مشاوره</span>
        <h1>رزرو نوبت</h1>
        <p>مشاور، زمان و شیوه‌ی مناسب جلسه‌تان را انتخاب کنید.</p>
      </div>
      <NuxtLink class="booking-help-link" to="/faq">راهنمای رزرو</NuxtLink>
    </header>

    <ol class="booking-progress" aria-label="مراحل رزرو">
      <li v-for="(item, index) in steps" :key="item.title" :class="{ active: step === index + 1, done: step > index + 1 }" :aria-current="step === index + 1 ? 'step' : undefined">
        <span>{{ stepDigits[index] }}</span>
        <div><strong>{{ item.title }}</strong><small>{{ item.short }}</small></div>
      </li>
    </ol>

    <ApiNotice v-if="error">{{ error }}</ApiNotice>
    <ApiNotice v-if="counselorError">فهرست مشاوران فعلاً در دسترس نیست. لطفاً کمی بعد دوباره تلاش کنید.</ApiNotice>
    <p v-else-if="counselorPending">در حال دریافت فهرست مشاوران…</p>

    <div class="booking-layout">
      <div class="booking-main">
        <section v-if="step === 1" class="booking-step-card">
          <div class="booking-step-title"><span>گام ۱ از ۵</span><h2>{{ profileCounselorSelected ? 'انتخاب خدمت' : 'خدمت و مشاور' }}</h2><p>{{ profileCounselorSelected ? 'برای ادامه، یکی از خدمات قابل رزرو این مشاور را انتخاب کنید.' : 'خدمت موردنظرتان را انتخاب کنید و مشاور را برگزینید.' }}</p></div>
          <div v-if="profileCounselorSelected" class="booking-profile-counselor">
            <CounselorAvatar v-if="counselor" :src="counselor.avatar_url" :name="counselor.name" size="choice" decorative />
            <span v-else class="booking-person-initial">م</span>
            <span><strong>{{ counselor?.name || 'مشاور انتخاب‌شده' }}</strong><small>{{ counselor?.degree || 'مشاور شما در این نوبت' }}</small></span>
            <button class="booking-change-counselor" type="button" @click="counselorId = 0; serviceId = 0">تغییر مشاور</button>
          </div>
          <template v-else>
          <div class="booking-section-label"><strong>مشاوران مرکز</strong><NuxtLink to="/counselors">دیدن همه مشاوران <ArrowIcon direction="back" /></NuxtLink></div>
          <label class="booking-search-counselor"><span class="sr-only">جست‌وجوی مشاور</span><input v-model="counselorQuery" type="search" placeholder="جست‌وجو بر اساس نام یا تخصص"></label>
          <div class="booking-counselor-choices">
            <button v-if="counselorId && !counselor" class="booking-person-choice selected" type="button"><span class="booking-person-initial">م</span><span>مشاور انتخاب‌شده</span></button>
            <button v-for="person in visibleCounselors" :key="person.id" class="booking-person-choice" :class="{ selected: counselorId === person.id }" type="button" :aria-pressed="counselorId === person.id" @click="counselorId = person.id">
              <CounselorAvatar :src="person.avatar_url" :name="person.name" size="choice" decorative/><span class="booking-person-name">{{ person.name }}</span><small>{{ person.degree || 'مشاور مرکز' }}</small><span class="choice-check" aria-hidden="true">✓</span>
            </button>
            <p v-if="!visibleCounselors.length" class="muted">مشاوری با این عبارت پیدا نشد.</p>
          </div>
          </template>
          <div v-if="loadingServices" class="booking-loading">در حال دریافت خدمات قابل رزرو…</div>
          <ApiNotice v-else-if="counselorId && !services.length">در حال حاضر برای این مشاور خدمتی برای رزرو در دسترس نیست.</ApiNotice>
          <template v-else-if="counselorId">
            <div class="booking-section-label"><strong>خدمت قابل رزرو</strong></div>
            <div class="booking-service-choices">
              <label v-for="item in services" :key="item.id" class="booking-service-choice" :class="{ selected: serviceId === item.id }">
                <input v-model.number="serviceId" type="radio" name="booking-service" :value="item.id"><span><strong>{{ item.title }}</strong><small>{{ item.duration_minutes }} دقیقه</small></span>
              </label>
            </div>
          </template>
          <div class="booking-action-row"><button class="btn" type="button" :disabled="!counselorId || !serviceId || loadingServices" @click="step = 2">ادامه به انتخاب زمان <span aria-hidden="true"><ArrowIcon direction="back" /></span></button></div>
        </section>

        <section v-else-if="step === 2" class="booking-step-card">
          <div class="booking-step-title"><span>گام ۲ از ۵</span><h2>تاریخ و زمان</h2><p>از زمان‌های در دسترس، یکی را انتخاب کنید.</p></div>
          <div class="booking-time-layout">
            <div class="booking-calendar"><JalaliDatePicker v-model="date" inline label="انتخاب تاریخ نوبت" :min="today" :max="maxDay" /></div>
          <div class="booking-time-slots"><div class="booking-section-label"><strong>ساعت‌های آزاد</strong><span>{{ formatDate(date + 'T12:00:00+03:30', { weekday: 'long', month: 'long', day: 'numeric' }) }}</span></div><p v-if="loadingSlots" class="booking-loading">در حال دریافت زمان‌ها…</p><div v-else-if="freeSlots.length" class="booking-slot-grid"><label v-for="slot in freeSlots" :key="slot.starts_at" class="booking-time-choice" :class="{selected:selectedStarts.includes(slot.starts_at)}"><input type="checkbox" :checked="selectedStarts.includes(slot.starts_at)" :value="slot.starts_at" @change="toggleSlot(slot.starts_at)"><span>{{ formatDate(slot.starts_at, { hour: '2-digit', minute: '2-digit' }) }}</span></label></div><ApiNotice v-else>برای این روز زمانی در دسترس نیست. روز دیگری را انتخاب کنید.</ApiNotice><p v-if="selectedStarts.length" class="booking-selected-count">{{ selectedStarts.length }} ساعت انتخاب شده؛ هر ساعت یک رزرو جداگانه خواهد بود.</p></div>
          </div>
          <div class="booking-action-row"><button class="btn secondary" type="button" :disabled="createdBookingIds.length > 0" @click="step = 1">بازگشت</button><button class="btn" type="button" :disabled="!canContinueTime()" @click="step = 3">ادامه <ArrowIcon direction="back" /></button></div>
        </section>

        <section v-else-if="step === 3" class="booking-step-card">
          <div class="booking-step-title"><span>گام ۳ از ۵</span><h2>نوع جلسه و پرداخت</h2><p>شیوه‌ی برگزاری و مبلغ پرداختی را انتخاب کنید.</p></div>
          <fieldset class="session-choice-fieldset booking-session-step"><legend class="sr-only">نوع جلسه</legend><div class="session-choice-grid">
            <label class="session-choice" :class="{ selected: sessionMode === 'meet' }"><input v-model="sessionMode" type="radio" value="meet"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg><span><strong>آنلاین تصویری</strong><small>جلسه به‌صورت تصویری</small></span></label>
            <label class="session-choice" :class="{ selected: sessionMode === 'voice_call' }"><input v-model="sessionMode" type="radio" value="voice_call"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 3a15 15 0 0 1-7-7l3-2-3-6Z"/></svg><span><strong>تلفنی</strong><small>گفت‌وگو از راه تماس</small></span></label>
            <label class="session-choice" :class="{ selected: sessionMode === 'in_person' }"><input v-model="sessionMode" type="radio" value="in_person"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V8l8-5 8 5v12M2 20h20M9 20v-6h6v6"/></svg><span><strong>حضوری</strong><small>مراجعه به مرکز</small></span></label>
          </div></fieldset>
          <div class="booking-payment-options">
          <div class="booking-section-label"><strong>میزان پرداخت</strong></div>
          <p v-if="selectedStarts.length > 1" class="booking-payment-per-appointment">این انتخاب برای هر نوبت جداگانه اعمال می‌شود.</p>
          <fieldset class="payment-choice-fieldset booking-payment-step"><legend class="sr-only">نحوه‌ی پرداخت</legend><div class="payment-choice-grid">
            <label class="payment-choice" :class="{ selected: paymentOption === 'full' }"><input v-model="paymentOption" type="radio" value="full"><span><strong>پرداخت کامل</strong><small>{{ service ? money(service.price_irr) : '' }}</small></span></label>
            <label v-if="service && service.deposit_irr > 0" class="payment-choice" :class="{ selected: paymentOption === 'deposit' }"><input v-model="paymentOption" type="radio" value="deposit"><span><strong>پرداخت بیعانه</strong><small>{{ money(service.deposit_irr) }}</small></span></label>
          </div></fieldset></div>
          <p class="booking-test-fee-note">در صورت نیاز به انجام آزمون، هزینه‌ی آن جداگانه و در جلسه محاسبه می‌شود.</p>
          <div class="booking-action-row"><button class="btn secondary" type="button" @click="step = 2">بازگشت</button><button class="btn" type="button" :disabled="!canContinuePayment()" @click="step = 4">ادامه به مرور <ArrowIcon direction="back" /></button></div>
        </section>

        <section v-else-if="step === 4" class="booking-step-card">
          <div class="booking-step-title"><span>گام ۴ از ۵</span><h2>مرور و ثبت نوبت</h2><p>اطلاعات نوبت را بررسی کنید و در صورت تأیید، آن را ثبت کنید.</p></div>
          <dl class="booking-review-list">
            <div><dt>مشاور</dt><dd>{{ counselor?.name || `مشاور #${counselorId}` }}</dd></div>
            <div><dt>خدمت</dt><dd>{{ service?.title }} · {{ service?.duration_minutes }} دقیقه</dd></div>
            <div><dt>زمان‌های انتخاب‌شده</dt><dd class="booking-review-times"><span v-for="startsAt in orderedSelectedStarts" :key="startsAt">{{ formatDate(startsAt) }}</span></dd></div>
            <div><dt>نوع جلسه</dt><dd>{{ sessionMode === 'in_person' ? 'حضوری' : sessionMode === 'meet' ? 'آنلاین تصویری' : 'تلفنی' }}</dd></div>
            <div><dt>میزان پرداخت</dt><dd>{{ paymentOption === 'full' ? 'پرداخت کامل' : 'پرداخت بیعانه' }}</dd></div>
            <div><dt>هزینه هر نوبت</dt><dd>{{ money(service?.price_irr || 0) }}</dd></div>
          </dl>
          <details class="booking-promo-disclosure" :open="!!promoCode"><summary>کد تخفیف دارید؟ <span>اختیاری</span></summary><div class="booking-coupon"><label for="booking-promo-code">کد تخفیف</label><input id="booking-promo-code" v-model.trim="promoCode" autocomplete="off" maxlength="64" placeholder="کد را وارد کنید"></div></details>
          <p class="booking-test-fee-note">در صورت نیاز به انجام آزمون، هزینه‌ی آن جداگانه و در جلسه محاسبه می‌شود.</p>
          <div class="booking-action-row"><button class="btn secondary" type="button" :disabled="busy || paymentBusy" @click="step = 3">بازگشت</button><button class="btn" type="button" :disabled="busy || paymentBusy || !canContinuePayment()" @click="reserve">{{ busy || paymentBusy ? 'در حال رزرو و پرداخت…' : 'رزرو و پرداخت' }}</button></div>
        </section>

        <section v-else class="booking-step-card booking-confirmation-step" aria-live="polite">
          <div class="booking-confirmation-mark" :class="{ 'is-pending': paymentBusy, 'has-error': paymentError }" aria-hidden="true"><svg viewBox="0 0 24 24"><path v-if="!paymentBusy && !paymentError" d="m5 12 4 4L19 6"/><path v-else d="M12 7v6m0 4h.01M4.8 19h14.4a1.5 1.5 0 0 0 1.3-2.2L13.3 4.6a1.5 1.5 0 0 0-2.6 0L3.5 16.8A1.5 1.5 0 0 0 4.8 19Z"/></svg></div>
          <div class="booking-step-title"><span>گام ۵ از ۵</span><h2>{{ paymentBusy ? 'در حال انتقال به درگاه' : paymentError ? 'رزرو موقت ثبت شد' : 'درخواست پرداخت آماده شد' }}</h2><p v-if="paymentBusy">درخواست پرداخت برای همین رزرو در حال انجام است.</p><p v-else-if="paymentError">رزرو شما ایجاد شده است، اما پرداخت شروع نشد. برای ادامه همین رزرو دوباره تلاش کنید.</p><p v-else>پس از بازگشت از درگاه، نتیجه پرداخت از سامانه بررسی می‌شود.</p></div>
          <ApiNotice v-if="paymentError">{{ paymentError }}</ApiNotice>
          <div v-if="pendingPaymentBooking" class="booking-created-list"><article><div><strong>{{ service?.title || 'نوبت مشاوره' }} · {{ formatDate(pendingPaymentBooking.starts_at) }}</strong><span>شماره رزرو <b dir="ltr">#{{ pendingPaymentBooking.id }}</b></span><span>وضعیت: پرداخت در انتظار انجام</span></div><div class="booking-payment-recovery-actions"><a v-if="gatewayUrl" class="btn secondary" :href="gatewayUrl">باز کردن درگاه پرداخت <ArrowIcon direction="back" /></a><button v-if="paymentError" class="btn" type="button" :disabled="paymentBusy" @click="startPayment(pendingPaymentBooking)">{{ paymentBusy ? 'در حال اتصال…' : 'تلاش دوباره برای پرداخت' }} <ArrowIcon direction="back" /></button><NuxtLink v-if="paymentError || !gatewayUrl" class="text-link" :to="paymentRecoveryUrl(pendingPaymentBooking)">مشاهده جزئیات نوبت</NuxtLink></div></article></div>
          <p v-if="createdBookings.length > 1" class="booking-payment-per-appointment">برای چند زمان انتخاب‌شده، هر رزرو جداگانه پرداخت می‌شود. رزروهای دیگر در فهرست نوبت‌های حساب شما در دسترس‌اند.</p>
          <div v-if="!paymentBusy" class="booking-action-row"><NuxtLink class="btn secondary" :to="path('/account/appointments')">نوبت‌های من</NuxtLink><NuxtLink v-if="pendingPaymentBooking" class="text-link" :to="paymentRecoveryUrl(pendingPaymentBooking)">جزئیات رزرو</NuxtLink></div>
        </section>
      </div>

      <aside v-if="step < 5" class="booking-aside"><div class="booking-aside-card"><span class="eyebrow">خلاصه انتخاب</span><h2>اطلاعات نوبت</h2><div v-if="counselor" class="booking-summary-person"><CounselorAvatar :src="counselor.avatar_url" :name="counselor.name" size="summary" decorative/><strong>{{ counselor.name }}</strong></div><div class="booking-summary-line"><span>خدمت</span><strong>{{ service?.title || 'انتخاب نشده' }}</strong></div><div class="booking-summary-line"><span>مدت جلسه</span><strong>{{ service ? `${service.duration_minutes} دقیقه` : '—' }}</strong></div><div class="booking-summary-line"><span>ساعت‌ها</span><strong v-if="orderedSelectedStarts.length" class="booking-summary-times"><span v-for="startsAt in orderedSelectedStarts" :key="startsAt">{{ formatDate(startsAt, { hour: '2-digit', minute: '2-digit' }) }}</span></strong><strong v-else>انتخاب نشده</strong></div><div class="booking-summary-line"><span>نوع جلسه</span><strong>{{ sessionMode === 'in_person' ? 'حضوری' : sessionMode === 'meet' ? 'آنلاین تصویری' : 'تلفنی' }}</strong></div><div v-if="start && service" class="booking-summary-total"><span>هزینه هر نوبت</span><strong>{{ money(service.price_irr) }}</strong></div><p v-if="start" class="booking-test-fee-note">در صورت نیاز به انجام آزمون، هزینه‌ی آن جداگانه و در جلسه محاسبه می‌شود.</p><NuxtLink class="text-link" to="/counselors">نیاز به انتخاب مشاور دارید؟</NuxtLink></div></aside>
    </div>
  </section>
</template>
