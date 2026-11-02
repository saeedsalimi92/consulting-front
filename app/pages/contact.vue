<script setup lang="ts">
import {collectionItems,type CmsEntry} from '~/composables/useBackend'
useSeoMeta({title:'تماس با ما',description:'اطلاعات تماس مرکز مشاوره'})
const {data,error,pending}=await useBackend().content('pages',{per_page:100})
const page=computed(()=>collectionItems<CmsEntry>(data.value).find(x=>x.slug==='contact'||x.slug.endsWith('-contact')))
</script>
<template><article class="container section"><h1>{{page?.title||'تماس با ما'}}</h1><p v-if="pending">در حال بارگذاری…</p><ApiNotice v-else-if="error">دریافت محتوای تماس ناموفق بود.</ApiNotice><div v-else-if="page" class="card"><div class="preline">{{page.body}}</div><p v-for="(value,key) in (page.extra||{})" :key="String(key)"><strong>{{key}}:</strong> {{value}}</p></div><ApiNotice v-else>اطلاعات تماس در CMS ثبت نشده است.</ApiNotice></article></template>
