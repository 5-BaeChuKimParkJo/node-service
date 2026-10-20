# Winner checkout: Toss TEST only

Disabled by default. Configure `TOSS_PAYMENTS_ENABLED=true`,
`TOSS_CLIENT_KEY=test_gck_...`, and `TOSS_SECRET_KEY=test_gsk_...` only in the
auction service environment. Only the authorized CheckoutView exposes the public
client key. Live keys and the older `test_ck_`/`test_sk_` key family fail validation,
including when the feature is disabled. Never put the secret in the browser.
The customer uses Toss v2 `widgets({ customerKey })` and the order-page widgets;
its amount comes from the prepared purchase, never the URL or auction UI.

## Database preparation

The reviewed migration is
`src/prisma/schema/migrations/20261017130000_winner_test_payments/migration.sql`.
It adds the nullable auction checkout lock, one immutable purchase per auction,
and numbered payment attempts with unique provider/idempotency keys. SQL enforces
positive amounts. Prepare takes `SELECT ... FOR UPDATE` on the auction before
reading the winner and current bid, then saves the lock and purchase atomically.
The parent bid guards and seller-update guard must ship with this schema.
`soldAt` retains its historical trade-completion meaning.

Prisma generation does not apply a migration. From the repository root:

```powershell
node node_modules/prisma/build/index.js generate --schema apps/auction-service/src/prisma/schema/schema.prisma
node node_modules/vitest/vitest.mjs run apps/auction-service/src/payment
node node_modules/@nestjs/cli/bin/nest.js build auction-service
```

Apply the migration separately to an explicitly selected disposable local/test
database before enabling checkout. No migration, deployment, production request,
or financial API request was performed during implementation.

## HTTP contract

Nest prefix: `/api/v1`; Kong/customer prefix: `/auction-service/api/v1`.
Customer routes require the winning owner's verified Bearer access JWT:

| Method | Path | Body |
| --- | --- | --- |
| GET | `/auctions/:uuid/checkout` | none |
| POST | `/auctions/:uuid/checkout` | `{}` |
| POST | `/auctions/:uuid/checkout/confirm` | `{ "orderId": "...", "paymentKey": "...", "amount": "15000" }` |
| POST | `/auctions/:uuid/checkout/reconcile` | `{}` |

Internal routes require `x-admin-internal-token`. Mutation routes also require a
nonempty `x-admin-actor` (at most 200 characters):

| Method | Path | Body |
| --- | --- | --- |
| GET | `/internal/admin/auctions/:uuid/payment` | none |
| POST | `/internal/admin/auctions/:uuid/payment/cancel` | `{ "reason": "Customer requested" }` (5..500 trimmed characters) |
| POST | `/internal/admin/auctions/:uuid/payment/reconcile` | `{}` |

Every successful checkout/admin route returns the agreed CheckoutView directly
(POST status 200), with decimal-string money and ISO timestamps. GET is local and
read-only: no lock, preparation, provider query, or reconciliation. Admin views
always have `eligible:false` and `clientKey:null`. Nonwinning users, including on
auctions with no winner, receive 403. Missing auctions receive 404.

## Recovery and cancellation

Administrator order listing uses `GET /internal/admin/payments` with the same
internal-token guard. Optional filters are `query` (literal substring of frozen
order name or any attempt order ID), purchase `status`, and UTC creation-time
`from` (inclusive) / `to` (exclusive). Pagination pairs `createdAt` with
`purchaseUuid`, preserves PostgreSQL microseconds, and returns at most 20 items
with a `nextCursor`. The response includes the latest attempt only; it never
exposes payment/customer/idempotency keys and never calls Toss or mutates orders.

The optional `attention` filter is applied in SQL before pagination. Every item
also includes `reviewDueAt` and `attention`; the response echoes the effective
`policy` (`dueHours`, `soonHours`). This is an advisory operator deadline, not an
enforced customer payment cutoff:

- `PAYMENT_REVIEW_HOURS` defaults to 24; `PAYMENT_REVIEW_SOON_HOURS` defaults to 6.
  Both are integer hours from 1 to 168, and the warning window cannot exceed the
  deadline. Change the auction-service environment and restart to change policy.
- The deadline is the auction's `endAt` plus the configured hours, not the time
  the buyer first opened checkout. Classification uses server UTC time and keeps
  PostgreSQL microsecond precision. At the deadline it is `OVERDUE`; at the
  warning boundary (inclusive) it is `DUE_SOON`; otherwise it is `WAITING`.
- CANCELED purchases are `NONE`. A latest-attempt error or CONFIRMING, UNKNOWN,
  CANCELING or WAITING_FOR_DEPOSIT is `REVIEW_REQUIRED` before deadline checks,
  even when the purchase is PAID (for example, uncertain cancellation). Settled
  paid purchases without those conditions are `NONE`.
- With `includeUnstarted=true`, eligible ended auctions without a purchase are included as `NOT_STARTED`,
  with `purchaseUuid: null`, no attempt, the current winner/amount/title, and
  auction end time as `createdAt`. Hidden, canceled, deleted, sold, ongoing,
  self-winning, missing-winner and invalid-amount auctions are excluded from
  this additional projection. Existing purchases keep their frozen values
  and remain visible regardless of later auction visibility changes.
  Omitting the option or using `false` retains purchase-only results for legacy
  callers. The HTTP option accepts only the literal strings `true` and `false`.
- Date filters use purchase creation time for orders and auction end time for
  unstarted wins. Deadlines always use auction end time plus the server policy.
  Pages sort by that list timestamp and auction UUID (both descending), keeping
  microseconds. Existing `{createdAt,purchaseUuid}` cursors resolve the auction
  UUID; unstarted rows use `{createdAt,auctionUuid}`. Exactly one ID is required.
  A checkout creates a real purchase only in the customer workflow; refresh
  the mutable list to see a win that moved across a pagination boundary.
- This read path never reconciles, cancels, blocks a charge, changes financial
  state or schedules work. Changing the policy recomputes historical labels; it
  does not rewrite deadlines or payment attempts in the database. Use the existing
  explicit detail reconciliation for uncertain results before operator action.

Prepare reuses the existing attempt; only verified ABORTED/EXPIRED attempts may
be replaced. Hidden/deleted/canceled auctions are checked again on every prepare.
UNKNOWN, CONFIRMING, WAITING_FOR_DEPOSIT and CANCELING must not offer a new charge.
Only verified DONE with matching order, payment key, exact amount, KRW currency,
full balance, and a valid approval date marks PAID. Virtual accounts stay pending.
Provider response bodies and payment keys are not returned to clients or logged.

Owner/admin reconcile first queries the persisted payment key. Widget (`gsk`)
keys support `GET /v1/payments/{paymentKey}`, not order-number lookup. Until an
authenticated confirm request has persisted a payment key, reconcile is a local
read and webhooks do not obtain or trust a key from their payload. A READY order
without a key remains reusable; it must not become UNKNOWN after a provider query.
Following the agreed contract
extension, an explicit reconcile may also resume a previously persisted action:
confirm only after a missing/READY/IN_PROGRESS lookup; cancel only after a
DONE/WAITING_FOR_DEPOSIT lookup. Replay uses the exact stored payment key, amount,
reason and original idempotency key. A database lease serializes active replay;
a crashed operation becomes recoverable after 30 seconds. Webhooks query only
and never replay a financial action. Replays stop after 14 days (Toss retains
idempotency records for 15); unresolved orders then require provider review and
remain blocked. Full cancellations are terminal and ignore stale DONE events.
Partial cancellations require manual review and cannot replay confirmation.
Cancellation stores the original operator/reason; retries retain both.
The admin list projects the latest attempt's stored `cancelReason` verbatim,
including legacy free-form reasons. Preset labels remain plain reason strings;
no reason-code column or migration is required.

Allow at least 35 seconds for customer/admin mutation requests: provider calls
time out after 10 seconds and an uncertain action can need a follow-up query.
If a client times out or loses redirect parameters, use explicit reconcile; the
server retains the original action. A later refresh GET remains read-only.

## Webhook setup

For a separately authorized TEST integration, configure Toss payment status,
deposit and cancellation events to reach
`/auction-service/api/v1/payments/toss/webhook` (POST). Forward the JSON body.
General payment webhooks have no signature; this endpoint accepts a known
`data.orderId` (or top-level `orderId`) and queries Toss using server credentials.
Unknown orders are acknowledged without a provider call. Payload status, amount
and payment key are never authoritative. Keep internal-admin routes inaccessible
to public clients, and do not forward the admin token to a browser.

The provider base is fixed to `https://api.tosspayments.com/v1`, with Basic
secret-colon authentication, redirects disabled, and persisted POST
`Idempotency-Key`. No configurable host or automatic provider retries exist.

Official references:
[Core API](https://docs.tosspayments.com/reference),
[authentication and idempotency](https://docs.tosspayments.com/reference/using-api/authorization),
[v2 SDK](https://docs.tosspayments.com/sdk/v2/js).

Tests use a fake provider and Fastify injection. The repository boundary tests
verify parameterized row locking and transaction writes against a database double;
they do not replace a disposable PostgreSQL integration/concurrency test.

## Isolated PostgreSQL Verification

`npm run test:payment:integration` migrates and tests only `TEST_DATABASE_URL`.
It never falls back to `DB_URL`. The URL must use loopback PostgreSQL and a
database name ending in `_test`; no production or Tailscale address is allowed.
Create a disposable local database, then in PowerShell run:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/auction_test'
npm run test:payment:integration
```

The 23 database cases cover simultaneous prepares, checkout-versus-bid row
contention, order-list pagination, duplicate confirmations, expired leases,
rollback of bid/outbox writes, and advisory deadline boundaries with unresolved
payment precedence. Filtered pagination also covers 44 interleaved purchases
with tied creation timestamps, mixed unstarted/order pagination, winner eligibility,
checkout projection transitions, and the original reason after repeated cancellation.
Seven of these cases exercise the actual
HTTP controllers, authentication, application service and Prisma adapter:

- Concurrent confirmations and cancellations across independent app/database
  clients invoke the provider once and preserve the first cancellation metadata.
- Lost confirm/cancel responses recover by provider lookup after app/client
  recreation, without replaying an already completed action.
- Requests lost before the provider are retried with the persisted idempotency
  key and original cancellation reason after app/client recreation.
- Forged, duplicate and reordered webhooks use only the stored payment key;
  even a stale DONE provider read cannot revive a canceled purchase.

Only the external provider is replaced with a deterministic test double. These
tests never call Toss and do not prove provider-side idempotency or real network
failure behavior. Fixtures use unique auction IDs and delete only their own
rows. They also verify unified administrator history across source ties and
cancellation-result updates. Unit-only runs visibly skip all 23 cases without an
explicit test database.
Node Quality provisions PostgreSQL in CI and runs both suites before any service
image can be published.

## Operations Summary

`GET /api/v1/internal/admin/payments/summary` requires the existing internal
administrator token. It returns a single `asOf` UTC snapshot, `endingHours: 24`,
and decimal-string counts `endingSoon`, `notStarted`, `overdue`, `reviewRequired`.
One SQL statement counts all payment rows using the same projection and review
precedence as the list, without a page limit. Unstarted and overdue categories
can overlap; canceled purchases are not overdue or unresolved.

`endingSoon` counts active, visible, non-deleted, unsold auctions with start time
at or before the snapshot and end time in `(asOf, asOf + 24 hours]`. The auction
admin list accepts literal `endingSoon=true|false` and applies the same rolling
window before pagination. Counters may change between a snapshot and opening
its live list. Summary errors propagate rather than returning fabricated zeros.
The isolated tests verify totals beyond 20 rows and window boundaries under a
repeatable-read transaction, so concurrent test fixtures cannot skew assertions.

Payment state lives in `domain`; the application depends only on
`PaymentStorePort` and `PaymentProviderPort`. `PaymentPrismaAdapter` owns row
locking and persistence; `TossPaymentAdapter` owns HTTP/provider validation.
