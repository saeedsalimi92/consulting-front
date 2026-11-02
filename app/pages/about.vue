<script setup lang="ts">
import {collectionItems,useMediaUrl,type CmsEntry} from '~/composables/useBackend'
useSeoMeta({title:'درباره ما',description:'معرفی مرکز مشاوره'})
const {data,error,pending}=await useBackend().content('pages',{per_page:100})
const mediaUrl=useMediaUrl()
const page=computed(()=>collectionItems<CmsEntry>(data.value).find(x=>x.slug==='about'||x.slug.endsWith('-about')))
</script>
<template><article class="container section"><h1>{{page?.title||'درباره ما'}}</h1><p v-if="pending">در حال بارگذاری…</p><ApiNotice v-else-if="error">دریافت اطلاعات معرفی مرکز ناموفق بود.</ApiNotice><template v-else-if="page"><div class="feature"><img v-if="page.image" class="about-image" :src="mediaUrl(page.image)" :alt="page.title"/><div><h2 v-if="page.extra?.subtitle">{{page.extra.subtitle}}</h2><div class="preline">{{page.body}}</div><NuxtLink to="/appointment" class="btn">نوبت‌دهی</NuxtLink></div></div></template><ApiNotice v-else>محتوای معرفی مرکز در CMS ثبت نشده است.</ApiNotice><nav class="actions"><NuxtLink to="/faq">پرسش‌های متداول</NuxtLink><NuxtLink to="/contact">تماس با ما</NuxtLink></nav></article></template>
