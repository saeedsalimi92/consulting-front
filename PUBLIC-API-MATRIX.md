# Public API Matrix

| Feature | Backend endpoint(s) | Frontend use | Status |
|---|---|---|---|
| Published CMS | `GET /content/{type}`, `GET /content/{type}/{slug}` | Homepage, about, contact, FAQ, banners, homepage sections, services, blog/categories, gallery, CMS pages | PARTIAL |
| Public counselors | `GET /counselors`, `GET /counselors/{counselor}` | Directory and profile; backend is responsible for active/public filtering | PARTIAL |
| Specialties | `GET /specialties` | Specialty listing and specialty detail derived from returned listing | PARTIAL |
| Booking catalog | `GET /booking/services`, `GET /booking/counselors/{counselor}/services` | Service listing and counselor-specific service selection/prices | IMPLEMENTED |
| Availability | `GET /booking/availability` | Date and slot selection; refresh before reservation | IMPLEMENTED |
| Reservation | `POST /booking/reservations` | Authenticated hold creation | IMPLEMENTED |
| Client auth | `POST /client/login`, `POST /client/logout`, `GET/PATCH /client/me`, `GET /auth/me` | Unified mobile login; password login uses `email` contract field with mobile value; no registration endpoint is called | IMPLEMENTED |
| OTP config and CAPTCHA | `GET /auth/config` | Public reCAPTCHA config; fresh v3 tokens per supported protected action, fail-closed if unavailable | IMPLEMENTED (live key/hostname not verified) |
| Client OTP | `POST /auth/otp/request`, `/auth/otp/resend`, `/auth/otp/verify` | Challenge UI, six-digit entry, cooldown, resend, backend errors, Sanctum token | PARTIAL (SMS provider blocked) |
| Password setup after OTP | `POST /auth/password/set`; authenticated `POST /auth/otp/step-up/request`, `/auth/otp/step-up/verify` | Optional immediate setup and safe account step-up before later setup; account state refreshed | IMPLEMENTED |
| Mandatory profile completion | `GET /auth/me`, `PUT /auth/profile`; booking can reject `PROFILE_INCOMPLETE` | Profile editor, authoritative completeness check, preserve booking destination and resume | IMPLEMENTED (runtime integration pending provider) |
| Mobile verification/change | `POST /auth/mobile/change/request`, `/auth/mobile/change/verify` | Authenticated mobile verification flow; number is not marked verified until backend confirms | PARTIAL (SMS provider blocked) |
| Deprecated registration | `POST /client/register` returns 410 `OTP_REGISTRATION_REQUIRED` | No client method or submit UI calls this route; legacy `/account/register` URL redirects to unified login | IMPLEMENTED |
| Password | `POST /client/password/forgot`, `POST /client/password/reset`, `PUT /client/password` | Recovery and password change | IMPLEMENTED |
| Client session | `GET /client/session` | No dedicated session details view | PARTIAL |
| Payments | `POST /booking/my-reservations/{booking}/payments`, `GET .../payments`, `GET .../receipts` | Initiation, redirect, authenticated status/receipt lookup | PARTIAL |
| Fake Bank | Backend checkout `url`; `GET /booking/my-reservations/{booking}/payments` after callback | Redirect to backend checkout and match return payment against client-owned payment records | IMPLEMENTED (static only) |
| Appointment management | `GET /booking/my-reservations`, `GET .../{booking}`, `PATCH .../reschedule`, `POST .../cancellation-request`, `GET .../notes` | Dashboard and appointment pages | PARTIAL |
| Notifications | `GET /client/notifications`, `POST /client/notifications/{notification}/read` | Inbox and read state | IMPLEMENTED |
| SMS consent | `GET/PATCH /client/notification-preferences` | Client SMS consent toggle | IMPLEMENTED |
| Zarinpal/SnappPay readiness | Server-configured gateway initiation/status | No browser credentials or fabricated offers | BLOCKED_EXTERNAL |
