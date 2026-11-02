export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const api = String(config.public.apiBase).replace(/\/$/, '')
  const origin = getRequestURL(event).origin
  const urls = new Set<string>([`${origin}/`, `${origin}/about`, `${origin}/contact`, `${origin}/service`, `${origin}/counselors`, `${origin}/blog`, `${origin}/faq`])
  const collect = (value: any): any[] => Array.isArray(value?.data) ? value.data : Array.isArray(value?.data?.data) ? value.data.data : []
  const fetchAll = async (path: string) => {
    const first: any = await $fetch(`${api}${path}`, { headers: { Accept: 'application/json' } })
    const rows = collect(first)
    const last = Math.min(20, Number(first?.meta?.last_page || first?.data?.last_page || 1))
    for (let page = 2; page <= last; page++) {
      try { rows.push(...collect(await $fetch(`${api}${path}`, { query: { page, per_page: 100 }, headers: { Accept: 'application/json' } }))) } catch { break }
    }
    return rows
  }
  try {
    const [people, specialties, articles, pages] = await Promise.all([
      fetchAll('/counselors?per_page=100'), fetchAll('/specialties?per_page=100'),
      fetchAll('/content/posts?per_page=100'), fetchAll('/content/pages?per_page=100'),
    ])
    for (const row of people) if (row?.slug) urls.add(`${origin}/counselors/${encodeURIComponent(row.slug)}`)
    for (const row of specialties) if (row?.slug) urls.add(`${origin}/service/${encodeURIComponent(row.slug)}`)
    for (const row of articles) if (row?.slug) urls.add(`${origin}/blog/${encodeURIComponent(row.slug)}`)
    for (const row of pages) if (row?.slug && !['home', 'about'].includes(row.slug)) urls.add(`${origin}/${encodeURIComponent(row.slug)}`)
  } catch { /* Public sitemap remains useful while the API is unavailable. */ }
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300, stale-while-revalidate=900')
  const entries = [...urls].map((loc) => `<url><loc>${loc.replaceAll('&', '&amp;')}</loc></url>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`
})
