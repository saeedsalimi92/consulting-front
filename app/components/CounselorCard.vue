<script setup lang="ts">
import type { Counselor } from '~/types/api'
const {path}=useSiteLocale(),props=defineProps<{person:Counselor}>()
const bookingPath=computed(()=>path(`/appointment?counselor=${encodeURIComponent(props.person.id)}`))
</script>
<template><article class="counselor-card"><NuxtLink class="counselor-card-photo" :to="path(`/counselors/${person.slug}`)" :aria-label="`درباره مشاور ${person.name}`"><CounselorAvatar :src="person.avatar_url" :name="person.name" decorative/></NuxtLink><div class="counselor-card-body"><div class="counselor-title"><h3>{{person.name}}</h3><p>{{person.degree||'مشاور مرکز'}}</p></div><div v-if="person.specialties?.length" class="counselor-specialties"><span v-for="specialty in person.specialties.slice(0,3)" :key="specialty.id">{{specialty.title}}</span></div><p v-if="person.years_of_experience" class="counselor-experience">{{person.years_of_experience}} سال سابقه</p><div class="counselor-card-actions"><NuxtLink class="btn secondary" :to="path(`/counselors/${person.slug}`)">اطلاعات بیشتر</NuxtLink><NuxtLink class="btn" :to="bookingPath">درخواست نوبت</NuxtLink></div></div></article></template>
