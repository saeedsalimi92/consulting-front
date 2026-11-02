<script setup lang="ts">
import type { CmsEntry } from '~/composables/useBackend'
import type { BookingService } from '~/types/booking'
import type { Counselor } from '~/types/api'
const props=defineProps<{slides:CmsEntry[]; title:string; body:string; image?:string|null; mediaUrl:(path:string)=>string; services:BookingService[]; counselors:Counselor[]}>()
type Slide=Pick<CmsEntry,'id'|'title'|'body'|'image'|'extra'>
const index=ref(0),serviceId=ref(''),counselorId=ref(''),failed=ref(false)
const items=computed<Slide[]>(()=>props.slides.length?props.slides:[{id:0,title:props.title,body:props.body,image:props.image||null,extra:{}}])
const active=computed<Slide>(()=>items.value[index.value]||items.value[0]!)
const imageSrc=computed(()=>failed.value?'/images/04.jpeg':active.value.image?props.mediaUrl(active.value.image):props.image?props.mediaUrl(props.image):'/images/04.jpeg')
const bookingTo=computed(()=>({path:'/appointment',query:{...(serviceId.value?{service:serviceId.value}:{}),...(counselorId.value?{counselor:counselorId.value}:{})}}))
let timer:ReturnType<typeof setInterval>|undefined
function go(to:number){failed.value=false;index.value=(to+items.value.length)%items.value.length}
function pause(){if(timer){clearInterval(timer);timer=undefined}}
function resume(){pause();if(import.meta.client&&items.value.length>1&&!matchMedia('(prefers-reduced-motion: reduce)').matches)timer=setInterval(()=>go(index.value+1),9000)}
function onImageError(){if(imageSrc.value!=='/images/04.jpeg')failed.value=true}
onMounted(resume);onBeforeUnmount(pause);watch(()=>items.value.length,resume)
</script>
<template>
 <section class="home-hero" aria-label="معرفی مرکز" @mouseenter="pause" @mouseleave="resume" @focusin="pause" @focusout="resume">
  <img class="home-hero-image" :src="imageSrc" :alt="active.image||image?active.title||'تصویر معرفی مرکز':'فضای واقعی مرکز مشاوره'" fetchpriority="high" @error="onImageError">
  <div class="home-hero-shade"></div>
  <div class="home-hero-content">
   <div class="home-hero-copy" aria-live="off"><span v-if="active.extra?.eyebrow" class="hero-kicker">{{active.extra.eyebrow}}</span><h1>{{active.title||title}}</h1><p>{{active.body||body}}</p><div class="actions"><NuxtLink class="btn hero-primary" :to="bookingTo">شروع رزرو نوبت</NuxtLink><NuxtLink class="hero-secondary" to="/counselors">مشاهده مشاوران</NuxtLink></div></div>
   <form class="hero-quick-book" @submit.prevent="navigateTo(bookingTo)"><label><span>خدمت موردنظر</span><select v-model="serviceId"><option value="">انتخاب خدمت</option><option v-for="service in services" :key="service.id" :value="String(service.id)">{{service.title}}</option></select></label><label><span>مشاور</span><select v-model="counselorId"><option value="">هر مشاور در دسترس</option><option v-for="person in counselors" :key="person.id" :value="String(person.id)">{{person.name}}</option></select></label><button class="btn" type="submit">جست‌وجوی زمان</button>
   </form>
   <div v-if="items.length>1" class="hero-slide-controls" role="group" aria-label="اسلایدهای معرفی"><button type="button" aria-label="اسلاید قبلی" @click="go(index-1)"><ArrowIcon direction="back" /></button><button v-for="(_,i) in items" :key="i" type="button" :aria-label="`رفتن به اسلاید ${i+1}`" :aria-current="i===index?'true':undefined" @click="go(i)"></button><button type="button" aria-label="اسلاید بعدی" @click="go(index+1)"><ArrowIcon direction="forward" /></button></div>
  </div>
 </section>
</template>
