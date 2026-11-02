# Public Payment Flow

1. Client creates an authenticated reservation through `POST /booking/reservations`.
2. The frontend uses the backend-calculated `required_irr` and submits an idempotency key to `POST /booking/my-reservations/{booking}/payments`.
3. If already verified, the frontend refreshes the appointment. Otherwise it redirects to the backend-provided checkout `url`; the browser does not implement provider checkout itself.
4. Fake Bank is only available in local/testing. Its backend page handles success/failure and returns to the configured frontend URL with `payment_id` and a display-only `status` hint.
5. The frontend restores the signed-in client session, loads that client's own paginated reservations/payment attempts, finds the matching ID, and reads the persisted payment, booking and receipt. Query-string success is never trusted.
6. `verified` from the client-scoped payment API is the only success state. `failed` shows failure; all other statuses remain pending. The appointment detail page refreshes backend state and offers retry when allowed.

Zarinpal and SnappPay remain external blockers. The client UI does not expose provider credentials, claim activation, or invent installment terms. Backend provider activation is required before those flows can work.
