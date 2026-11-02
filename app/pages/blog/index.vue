<script setup lang="ts">
import { collectionItems, useMediaUrl, type CmsEntry } from '~/composables/useBackend'
useSeoMeta({ title: 'مقالات و اخبار', description: 'مقالات و مطالب منتشرشده مرکز مشاوره' })
const route = useRoute()
const router = useRouter()
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const q = ref(String(route.query.q || ''))
const category = ref(String(route.query.category_slug || ''))
const { data, error, pending } = await useBackend().content('posts', computed(() => ({ page: page.value, per_page: 12, ...(route.query.q ? { q: String(route.query.q) } : {}), ...(route.query.category_slug ? { category_slug: String(route.query.category_slug) } : {}) })))
const { data: categoryData } = await useBackend().content('categories', { per_page: 100 })
const mediaUrl = useMediaUrl()
const posts = computed(() => collectionItems<CmsEntry>(data.value))
const meta = computed<any>(() => data.value?.meta || data.value)
const categories = computed(() => collectionItems<CmsEntry>(categoryData.value))
const displayDate = (post: CmsEntry) => {
  const value = post.extra?.published_at || post.created_at
  if (!value) return ''
  try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tehran' }).format(new Date(value)) } catch { return '' }
}
async function searchPosts() {
  await router.push({ query: { ...(q.value.trim() ? { q: q.value.trim() } : {}), ...(category.value ? { category_slug: category.value } : {}), page: 1 } })
}
</script>

<template>
  <div class="blog-page">
    <header class="blog-masthead">
      <div class="container">
        <span class="eyebrow">مجله پرواز</span>
        <h1>مقاله‌ها</h1>
        <p>مطالب منتشرشده‌ی مرکز را بر اساس موضوع پیدا کنید.</p>
        <form class="blog-search" role="search" @submit.prevent="searchPosts">
          <label class="sr-only" for="article-search">جست‌وجو در مقاله‌ها</label>
          <input id="article-search" v-model="q" type="search" placeholder="جست‌وجو در عنوان یا موضوع">
          <label class="sr-only" for="article-category">دسته‌بندی مقاله‌ها</label>
          <select id="article-category" v-model="category"><option value="">همه‌ی موضوع‌ها</option><option v-for="item in categories" :key="item.id" :value="item.slug">{{ item.title }}</option></select>
          <button class="btn" type="submit">جست‌وجو</button>
        </form>
        <nav v-if="categories.length" class="blog-category-chips" aria-label="موضوع‌های مقاله‌ها">
          <NuxtLink :to="{ query: { page: 1 } }" :aria-current="!route.query.category_slug ? 'page' : undefined">همه</NuxtLink>
          <NuxtLink v-for="item in categories.slice(0, 8)" :key="item.id" :to="{ query: { category_slug: item.slug, page: 1 } }" :aria-current="route.query.category_slug === item.slug ? 'page' : undefined">{{ item.title }}</NuxtLink>
        </nav>
      </div>
    </header>

    <main class="container blog-content">
      <div class="blog-results-heading"><h2>{{ route.query.q ? `نتایج جست‌وجو برای «${route.query.q}»` : route.query.category_slug ? 'مقاله‌های این موضوع' : 'تازه‌ترین نوشته‌ها' }}</h2><span v-if="meta?.total" class="muted">{{ meta.total }} مقاله</span></div>
      <p v-if="pending">در حال دریافت مقاله‌ها…</p>
      <ApiNotice v-else-if="error">دریافت مقاله‌ها ناموفق بود.</ApiNotice>
      <div v-else-if="posts.length" class="blog-grid">
        <NuxtLink v-for="post in posts" :key="post.id" class="blog-card" :to="`/blog/${post.slug}`">
          <div class="blog-card-image">
            <img v-if="post.image" :src="mediaUrl(post.image)" :alt="post.title" loading="lazy" decoding="async">
            <span v-else class="blog-image-empty" aria-hidden="true"><span>مجله پرواز</span></span>
            <span v-if="post.extra?.category_slug" class="blog-card-category">{{ categories.find(item => item.slug === post.extra?.category_slug)?.title || post.extra.category_slug }}</span>
          </div>
          <div class="blog-card-content">
            <time v-if="displayDate(post)">{{ displayDate(post) }}</time>
            <h2>{{ post.title }}</h2>
            <p class="preline">{{ post.body }}</p>
            <span class="text-link">خواندن مقاله <span aria-hidden="true"><ArrowIcon direction="back" /></span></span>
          </div>
        </NuxtLink>
      </div>
      <ApiNotice v-else>مقاله‌ای برای این جست‌وجو پیدا نشد.</ApiNotice>

      <nav v-if="Number(meta?.last_page) > 1" class="pager" aria-label="صفحه‌بندی مقاله‌ها">
        <NuxtLink v-if="page > 1" class="btn secondary" :to="{ query: { ...(route.query.q ? { q: route.query.q } : {}), ...(route.query.category_slug ? { category_slug: route.query.category_slug } : {}), page: page - 1 } }">قبلی</NuxtLink>
        <span>{{ page }} از {{ meta.last_page }}</span>
        <NuxtLink v-if="page < meta.last_page" class="btn secondary" :to="{ query: { ...(route.query.q ? { q: route.query.q } : {}), ...(route.query.category_slug ? { category_slug: route.query.category_slug } : {}), page: page + 1 } }">بعدی</NuxtLink>
      </nav>
    </main>
  </div>
</template>
