<script setup lang="ts">
import { collectionItems, resourceItem, type CmsEntry } from '~/composables/useBackend'
import type { Counselor, Specialty } from '~/types/api'
const route = useRoute()
const slug = String(route.params.slug)
const api = useBackend()
const { path } = useSiteLocale()
const mediaUrl = useMediaUrl()
const [{ data: specs }, { data: serviceData }, { data: people, error }] = await Promise.all([api.specialties(), api.contentItem('services', slug), api.counselors({ per_page: 100 })])
const specialty = computed(() => collectionItems<Specialty>(specs.value).find(item => item.slug === slug))
const service = computed(() => resourceItem<CmsEntry>(serviceData.value))
const matches = computed(() => specialty.value ? collectionItems<Counselor>(people.value).filter(person => person.specialties?.some(item => item.id === specialty.value?.id)) : [])
useSeoMeta({ title: () => service.value?.extra?.seo_title || service.value?.title || specialty.value?.title || 'خدمات', description: () => service.value?.extra?.seo_description || service.value?.body || '' })
if (!specialty.value && !service.value) throw createError({ statusCode: 404, statusMessage: 'Service not found', fatal: true })
</script>

<template>
  <article class="container section service-detail-page">
    <template v-if="service">
      <img v-if="service.image" class="service-detail-image" :src="mediaUrl(service.image)" :alt="service.title" loading="lazy" decoding="async" />
      <span class="eyebrow">خدمات مرکز</span><h1>{{ service.title }}</h1>
      <div v-if="service.body" class="preline service-detail-body">{{ service.body }}</div>
      <NuxtLink class="btn" :to="path('/appointment')">مشاهده زمان‌های قابل رزرو</NuxtLink>
    </template>
    <template v-else-if="specialty">
      <span class="eyebrow">حوزه تخصصی</span><h1>{{ specialty.title }}</h1>
      <section class="service-counselors-section"><div class="section-heading"><div><span class="eyebrow">مشاوران</span><h2>مشاوران این حوزه</h2></div></div>
        <ApiNotice v-if="error">دریافت مشاوران ناموفق بود.</ApiNotice>
        <div v-else-if="matches.length" class="counselor-grid"><CounselorCard v-for="person in matches" :key="person.id" :person="person"/></div>
        <ApiNotice v-else>فعلاً مشاوری در این حوزه ثبت نشده است.</ApiNotice>
      </section>
    </template>
  </article>
</template>
