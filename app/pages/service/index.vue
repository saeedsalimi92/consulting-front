<script setup lang="ts">
import { collectionItems, type CmsEntry } from '~/composables/useBackend'
import type { BookingService } from '~/types/booking'
useSeoMeta({ title: 'خدمات و تخصص‌ها', description: 'آشنایی با خدمات و حوزه‌های تخصصی مرکز مشاوره پرواز' })
const { data: specs, error: specError, pending: specPending } = await useBackend().specialties()
const { data: cmsServices, error: cmsError, pending: cmsPending } = await useBackend().content('services', { per_page: 50 })
const bookingApi = useBookingApi()
const { data: bookings, error: bookingError, pending: bookingPending } = await useAsyncData('public-booking-services', () => bookingApi.services())
const specialties = computed(() => collectionItems(specs.value))
const informational = computed(() => collectionItems<CmsEntry>(cmsServices.value))
const bookingServices = computed(() => collectionItems<BookingService>(bookings.value))
</script>

<template>
  <div class="services-page">
    <header class="services-masthead"><div class="container"><span class="eyebrow">خدمات مرکز</span><h1>خدمات و حوزه‌های تخصصی</h1><p>با خدمات مرکز و زمینه‌های کاری مشاوران آشنا شوید.</p></div></header>
    <div class="container services-content">
      <section class="service-extra services-explanations" aria-labelledby="service-explanations-title">
        <div class="section-heading"><div><span class="eyebrow">آشنایی با خدمات</span><h2 id="service-explanations-title">خدمات مشاوره</h2></div></div>
        <p v-if="cmsPending">در حال بارگذاری…</p>
        <ApiNotice v-else-if="cmsError">دریافت توضیحات خدمات ناموفق بود.</ApiNotice>
        <div v-else-if="informational.length" class="service-extra-grid"><article v-for="item in informational" :key="item.id" class="service-extra-card"><h3>{{ item.title }}</h3><p v-if="item.body" class="preline">{{ item.body }}</p><NuxtLink class="text-link" :to="`/service/${item.slug}`">اطلاعات بیشتر <ArrowIcon direction="back" /></NuxtLink></article></div>
        <ApiNotice v-else>توضیحات خدمات هنوز منتشر نشده است.</ApiNotice>
      </section>

      <section class="service-bookable"><div class="section-heading"><div><span class="eyebrow">رزرو جلسه</span><h2>جلسه‌های قابل رزرو</h2></div></div>
        <p v-if="bookingPending">در حال دریافت خدمات…</p><ApiNotice v-else-if="bookingError">دریافت خدمات نوبت‌دهی ناموفق بود.</ApiNotice>
        <div v-else-if="bookingServices.length" class="service-strip"><article v-for="item in bookingServices" :key="item.id" class="service-feature"><h3>{{ item.title }}</h3><NuxtLink class="btn" :to="{ path: '/appointment', query: { service: item.id } }">انتخاب خدمت</NuxtLink></article></div>
        <ApiNotice v-else>خدمت قابل رزرو ثبت نشده است.</ApiNotice>
      </section>

      <section class="service-specialties"><div class="section-heading"><div><span class="eyebrow">حوزه‌های تخصصی</span><h2>زمینه‌های کاری مشاوران</h2></div></div>
        <p v-if="specPending">در حال بارگذاری…</p><ApiNotice v-else-if="specError">دریافت تخصص‌ها ناموفق بود.</ApiNotice>
        <div v-else-if="specialties.length" class="specialty-grid"><NuxtLink v-for="(item, index) in specialties" :key="item.id" :to="`/service/${item.slug}`" class="specialty-tile" :class="`tone-${index % 6}`"><span class="specialty-icon-wrap"><SpecialtyIcon :name="item.title" :icon="item.extra?.icon" /></span><strong>{{ item.title }}</strong><span class="tile-arrow" aria-hidden="true"><ArrowIcon direction="external" /></span></NuxtLink></div>
        <ApiNotice v-else>حوزه تخصصی ثبت نشده است.</ApiNotice>
      </section>
    </div>
  </div>
</template>
