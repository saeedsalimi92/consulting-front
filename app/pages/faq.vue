<script setup lang="ts">
import {collectionItems,type CmsEntry} from '~/composables/useBackend'
useSeoMeta({title:'پرسش‌های متداول'})
const {data,error,pending}=await useBackend().content('faqs',{per_page:100})
const faqs=computed(()=>collectionItems<CmsEntry>(data.value))
const faqSchema=computed(()=>JSON.stringify({'@context':'https://schema.org','@type':'FAQPage',mainEntity:faqs.value.filter(item=>item.title&&item.body).map(item=>({'@type':'Question',name:item.title,acceptedAnswer:{'@type':'Answer',text:item.body}}))}).replace(/</g,'\\u003c'))
useHead({script:[{key:'faq-jsonld',type:'application/ld+json',innerHTML:faqSchema}]})
</script>
<template><div class="container section"><h1>پرسش‌های متداول</h1><p v-if="pending">در حال بارگذاری…</p><ApiNotice v-else-if="error">دریافت پرسش‌ها ناموفق بود.</ApiNotice><div v-else-if="faqs.length" class="faq-list"><details v-for="item in faqs" :key="item.id" class="card"><summary>{{item.title}}</summary><div class="preline">{{item.body}}</div></details></div><ApiNotice v-else>پرسشی برای نمایش وجود ندارد.</ApiNotice></div></template>
