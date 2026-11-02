# Public Website Completion Tracker

| Module | Status | Validation |
|---|---|---|
| Public layout, Persian RTL, mobile navigation, core pages | IMPLEMENTED | STATIC_CHECKED |
| CMS homepage, banners, sections, FAQs, services information | PARTIAL | STATIC_CHECKED |
| Counselor discovery and public profiles | PARTIAL | STATIC_CHECKED |
| Service and specialty discovery | PARTIAL | STATIC_CHECKED |
| Real availability and reservation flow | PARTIAL | STATIC_CHECKED |
| Fake Bank redirect and verified return status | IMPLEMENTED | STATIC_CHECKED |
| Zarinpal | BLOCKED_EXTERNAL | NOT_TESTED |
| SnappPay | BLOCKED_EXTERNAL | NOT_TESTED |
| Unified mobile login, password recovery, profile | IMPLEMENTED | STATIC_CHECKED; UNIT_TESTED |
| Deprecated public registration removed | IMPLEMENTED | STATIC_CHECKED; UNIT_TESTED |
| OTP request/verify/resend and auth state | PARTIAL: real routes and CAPTCHA flow integrated; provider currently unavailable | STATIC_CHECKED; UNIT_TESTED; PROVIDER_NOT_TESTED |
| reCAPTCHA v3 lazy loader and per-action tokens | IMPLEMENTED | STATIC_CHECKED; LIVE_CONFIG_NOT_TESTED |
| Global Toast and normalized API errors | IMPLEMENTED | UNIT_TESTED (utility); UI_RUNTIME_NOT_TESTED |
| OTP password setup and profile completion | IMPLEMENTED | STATIC_CHECKED; PROVIDER_NOT_TESTED |
| Mobile change verification | PARTIAL: actual request/verify routes integrated; SMS provider currently unavailable | STATIC_CHECKED; PROVIDER_NOT_TESTED |
| Client password change and SMS consent preference | IMPLEMENTED | STATIC_CHECKED |
| Client dashboard, appointments, cancellation, rescheduling | PARTIAL | STATIC_CHECKED |
| Notifications and receipts | PARTIAL | STATIC_CHECKED |
| CMS pages, article search/category/pagination, gallery, FAQ | PARTIAL | STATIC_CHECKED |
| SEO metadata, canonical, robots, dynamic sitemap, FAQ/article schema | PARTIAL | STATIC_CHECKED |
| Accessibility, RTL responsive styles, Persian error states | PARTIAL | STATIC_CHECKED |
| Public API type reconciliation | PARTIAL | STATIC_CHECKED |
| Production build | IMPLEMENTED | STATIC_CHECKED; `npm run build` PASS (Node/cssnano warnings) |
| Nuxt/Vue typecheck | IMPLEMENTED | STATIC_CHECKED; `npm run typecheck` PASS (Node warning) |

Build completion is not evidence of successful provider, database, or browser integration. Those validations remain deferred.


`npm test` currently passes 8 utility/static contract checks. Component, browser E2E, real provider and visual QA remain unverified. Build/typecheck success is not end-to-end validation.
