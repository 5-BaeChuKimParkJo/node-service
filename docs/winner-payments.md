# Winner-Only Toss Test Payments

## Flow
1. Only the authenticated winning bidder can open checkout after auction end.
2. Explicit preparation locks the auction row and freezes buyer, seller, amount
   and title. One purchase exists per auction; subsequent bid writes are blocked.
3. The browser renders Toss v2 order-page widgets using a test client key.
4. The success redirect is untrusted. The server compares order/amount/owner,
   requests provider confirmation, and marks PAID only after a verified DONE.
5. Unknown results remain blocked. Explicit status reconciliation queries Toss
   and can resume the original pending request with the same persisted body and
   idempotency key. No second order is opened for an unresolved attempt.
6. Admin can inspect the snapshot and cancel the whole payment with an audited
   actor/reason. Cancellation state is independent of historical Auctions.soldAt.

No bidding deposit, automatic charge, seller payout, partial refund or live-mode
key support is included. An externally observed partial cancellation requires
manual provider review; it must not be treated as a fresh payment opportunity.

## Configuration
Auction Service only (not the browser or Admin Service):
```dotenv
TOSS_PAYMENTS_ENABLED=false
TOSS_CLIENT_KEY=
TOSS_SECRET_KEY=
```

Obtain a matching **test payment-widget** key pair from the Toss developer
console: client `test_gck_...`, secret `test_gsk_...`. This implementation
rejects live and legacy key formats. Supply keys through the deployment secret
mechanism, never source control or chat. Set enabled to true only after both are
configured. The browser receives only the public client key for an eligible user.

## Database and Release
Migration: `apps/auction-service/src/prisma/schema/migrations/20261017130000_winner_test_payments/migration.sql`.
It adds a nullable auction checkout lock plus purchase/attempt tables, constraints,
idempotency keys and recovery leases. It does not delete existing auction data.

From the node-service checkout, with DB_URL already securely configured:
```powershell
node node_modules/prisma/build/index.js generate --schema=apps/auction-service/src/prisma/schema/schema.prisma
node node_modules/prisma/build/index.js migrate deploy --schema=apps/auction-service/src/prisma/schema/schema.prisma
```
The second command changes the database; run it only as an approved release step.
The existing production Docker CMD also runs migrate deploy before startup.
Release the matching Auction Service before Admin Service/Admin Web and customer
FE. Merely setting enabled=false does not replace the required schema migration.

## Routes
Customer UI: `/auctions/{auctionUuid}/checkout`, `/success`, `/fail`.
Customer APIs use JWT ownership, not a freely supplied member UUID header:
- GET/POST `/api/v1/auctions/{auctionUuid}/checkout`
- POST `/api/v1/auctions/{auctionUuid}/checkout/confirm`
- POST `/api/v1/auctions/{auctionUuid}/checkout/reconcile`

Admin APIs require the internal token; mutations also require x-admin-actor:
- GET `/api/v1/internal/admin/auctions/{auctionUuid}/payment`
- POST `.../payment/cancel` with `{"reason":"Customer requested"}`
- POST `.../payment/reconcile`

Through existing Kong routing, prefix the above paths with `/auction-service`.
Do not expose internal-token credentials to the customer browser.

Optional provider webhook:
`/auction-service/api/v1/payments/toss/webhook`.
Toss must be able to reach its designated HTTPS endpoint; a Tailnet-only address
cannot receive public provider webhooks. Keep admin consoles private. Normal
payment events have no signature in this integration, so the handler trusts no
event status/amount and re-queries Toss for known orders. Unknown orders are
ignored. Webhook processing never replays a payment request.

No reconciliation cron is installed. Status changes are reconciled on explicit
user/admin status checks or known-order webhooks. Pending actions older than the
conservative 14-day replay window require provider review.

## Local Verification
No real financial requests or production database migrations were used.
State machine/transport tests use a fake provider; controller tests include real
JWT verification, internal-token guards and the global response interceptor.
Purchase locking has mocked Prisma boundary tests, not a live PostgreSQL
concurrency test. Perform a real test-key/provider and staging-DB smoke test
before enabling a deployment.

```powershell
node node_modules/vitest/vitest.mjs run apps/auction-service/src/payment apps/auction-service/src/auction/adapter/out/postgresql/auction-prisma.repository.checkout.spec.ts
node node_modules/@nestjs/cli/bin/nest.js build auction-service
```

Two existing Windows test suites import an unavailable Confluent Kafka native
binding. A broader run can exclude those known environment failures:
```powershell
node node_modules/vitest/vitest.mjs run --exclude '**/auction-etc.service.spec.ts' --exclude '**/my-bids.service.spec.ts'
```

References: [Toss widget integration](https://docs.tosspayments.com/guides/v2/payment-widget/integration),
[API reference](https://docs.tosspayments.com/reference),
[webhooks](https://docs.tosspayments.com/guides/v2/webhook).

