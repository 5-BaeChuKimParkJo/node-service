# Winner checkout: Toss TEST only

Disabled by default. Configure `TOSS_PAYMENTS_ENABLED=true`,
`TOSS_CLIENT_KEY=test_gck_...`, and `TOSS_SECRET_KEY=test_gsk_...` only in the
auction service environment. Only the authorized CheckoutView exposes the public
client key. Live keys and the older test_ck_/test_sk_ key family fail validation,
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

The suite covers simultaneous prepares, checkout-versus-bid row contention,
duplicate confirmations, expired leases, and rollback of bid/outbox writes.
It uses a fake provider and never calls Toss. Unit-only runs visibly skip these
five tests without an explicit test database. Node Quality provisions PostgreSQL
in CI and runs the suite before any service image can be published.

Payment state lives in `domain`; the application depends only on
`PaymentStorePort` and `PaymentProviderPort`. `PaymentPrismaAdapter` owns row
locking and persistence; `TossPaymentAdapter` owns HTTP/provider validation.
