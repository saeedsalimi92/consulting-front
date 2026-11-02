# Public SEO Checklist

| Item | Status | Notes |
|---|---|---|
| SSR for public content routes | IMPLEMENTED | Nuxt production build includes server rendering. |
| Dynamic page metadata | PARTIAL | Counselor, article, page title/description present; some static routes use generic metadata. |
| Canonical URL | IMPLEMENTED | Current request origin and route path, query omitted. |
| Open Graph/Twitter | PARTIAL | Article details have dynamic tags; not every public route is populated. |
| Robots rules | IMPLEMENTED | `robots.txt` blocks account and Fake Bank paths; account/payment pages use noindex. |
| Dynamic sitemap | PARTIAL | Includes public CMS pages, posts, specialties and counselors; depends on API and site origin. |
| Structured data | PARTIAL | CMS FAQ and article pages emit data-backed FAQPage/Article JSON-LD; organization/person data omitted where no verified public fields exist. |
| Hreflang alternate URLs | PARTIAL | English routes exist; reciprocal alternates are not generated consistently. |
| 404 and status handling | PARTIAL | CMS detail misses become 404; full route/status review remains. |
| Draft/scheduled content exclusion | IMPLEMENTED | Sitemap and pages consume public CMS endpoints, which filter publication state server-side. |
