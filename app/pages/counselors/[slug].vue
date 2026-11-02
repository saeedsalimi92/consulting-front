<script setup lang="ts">
import {collectionItems,resourceItem} from '~/composables/useBackend'
import type {Counselor,Comment} from '~/types/api'
const route=useRoute(),{path,t}=useSiteLocale(),api=useBackend(),slug=String(route.params.slug)
const {data,error,pending}=await api.counselor(slug)
const person=computed(()=>resourceItem<Counselor>(data.value))
const reviewData=ref<any>(null),reviewError=ref(false)
if(person.value?.id){try{const reviews=await api.comments({type:'counselor',id:person.value.id,per_page:20});reviewData.value=reviews.data.value}catch{reviewError.value=true}}
const comments=computed(()=>collectionItems<Comment>(reviewData.value).filter(item=>!item.parent_id))
useSeoMeta({title:()=>person.value?.meta_title||person.value?.name||'مشاور',description:()=>person.value?.meta_description||person.value?.bio||''})
</script>
<template>
  <div class="container section counselor-profile-page">
    <p v-if="pending">در حال دریافت معرفی مشاور…</p>
    <ApiNotice v-else-if="error||!person">اطلاعات این مشاور در سامانه پیدا نشد.</ApiNotice>
    <template v-else>
      <nav class="profile-breadcrumb"><NuxtLink to="/counselors">مشاوران</NuxtLink><span aria-hidden="true">/</span><span>{{person.name}}</span></nav>
      <article class="counselor-profile-hero">
        <div class="profile-identity">
          <div class="profile-photo-frame"><CounselorAvatar :src="person.avatar_url" :name="person.name" size="profile" decorative/></div>
          <div class="profile-identity-copy">
            <span class="eyebrow">پروفایل مشاور</span>
            <h1>{{person.name}}</h1>
            <p v-if="person.degree" class="profile-degree">{{person.degree}}</p>
            <div v-if="person.years_of_experience" class="profile-fact">{{person.years_of_experience}} سال سابقه حرفه‌ای</div>
          </div>
        </div>
        <div v-if="person.bio" class="profile-info-block">
          <h2>درباره مشاور</h2>
          <p class="preline profile-bio">{{person.bio}}</p>
        </div>
        <div v-if="person.specialties?.length" class="profile-specialties">
          <strong>حوزه‌های تخصصی</strong>
          <NuxtLink v-for="s in person.specialties" :key="s.id" :to="path(`/service/${s.slug}`)">{{s.title}}</NuxtLink>
        </div>
        <div v-if="person.about" class="profile-info-block">
          <h2>اطلاعات تکمیلی</h2>
          <p class="preline profile-about">{{person.about}}</p>
        </div>
        <NuxtLink class="btn secondary profile-book" :to="{path:path('/appointment'),query:{counselor:person.id}}">درخواست نوبت <ArrowIcon direction="back" /></NuxtLink>
      </article>
      <section v-if="reviewError||comments.length" class="profile-reviews"><div class="section-heading"><div><span class="eyebrow">بازخوردهای منتشرشده</span><h2>دیدگاه‌ها</h2></div></div><ApiNotice v-if="reviewError">دریافت دیدگاه‌ها موقتاً ناموفق بود.</ApiNotice><div v-else class="profile-review-grid"><article v-for="comment in comments" :key="comment.id" class="profile-review"><p class="preline">{{comment.body}}</p><small>{{new Intl.DateTimeFormat('fa-IR-u-ca-persian',{dateStyle:'medium',timeZone:'Asia/Tehran'}).format(new Date(comment.created_at))}}</small></article></div></section>
      <NuxtLink class="profile-mobile-cta" :to="{path:path('/appointment'),query:{counselor:person.id}}">درخواست نوبت <span aria-hidden="true"><ArrowIcon direction="back" /></span></NuxtLink>
    </template>
  </div>
</template>
