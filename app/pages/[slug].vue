<script setup lang="ts">
import {resourceItem,useMediaUrl,type CmsEntry} from '~/composables/useBackend'
const slug=String(useRoute().params.slug)
const {data,error,pending}=await useBackend().contentItem('pages',slug)
const page=computed(()=>resourceItem<CmsEntry>(data.value)),mediaUrl=useMediaUrl()
useSeoMeta({title:()=>page.value?.extra?.seo_title||page.value?.title||'صفحه',description:()=>page.value?.extra?.seo_description||page.value?.body||'',robots:()=>page.value?'index,follow':'noindex,nofollow'})
if(error.value&&!pending.value)throw createError({statusCode:404,statusMessage:'Page not found',fatal:true})
</script>
<template><article class="container section"><p v-if="pending">در حال بارگذاری…</p><template v-else-if="page"><h1>{{page.title}}</h1><img v-if="page.image" class="article-image" :src="mediaUrl(page.image)" :alt="page.title"/><div class="preline article-body">{{page.body}}</div></template><ApiNotice v-else>این صفحه در دسترس نیست.</ApiNotice></article></template>
