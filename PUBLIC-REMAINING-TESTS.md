# Public Remaining Tests

Production build passed. The direct typecheck is blocked by installed tooling (Nuxt CLI invokes TypeScript without a project and `vue-tsc` fails loading the `vue-router/volar/sfc-route-blocks` plugin). All runtime integration validations below remain `NOT_TESTED`.

- Run typecheck in a supported Node.js release and with compatible Nuxt/Vue language tooling.
- Verify the public site against a disposable/test backend database: auth lifecycle, profile changes, notification preferences, booking slot conflicts, reservation expiry, cancellation, reschedule and payment retries.
- Browser E2E the Fake Bank backend checkout and return flow; verify callback hints never cause a false success state.
- Verify Zarinpal and SnappPay only after provider sandbox contracts/credentials and backend adapters are available.
- Test SSR output, SEO metadata, canonical/hreflang policy, robots and sitemap with representative published, scheduled, unpublished and empty CMS content.
- Test Persian and English route behavior, narrow mobile/tablet/desktop breakpoints, keyboard-only booking, dialogs, screen-reader labels, contrast and reduced motion.
- Validate session connection URLs remain unavailable until authorized by backend and test appointment state refresh after payment.
- Run accessibility audit, load/performance checks and final visual QA.

No test data was written to the main database; no backend migrations were run.
