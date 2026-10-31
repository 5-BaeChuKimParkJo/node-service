# Waiting seller auction management

GET/PATCH `/auction-service/api/v1/auctions/:uuid/seller`, POST `.../seller/cancel`.
Verified JWT owner only; unknown/other owner/deleted404. Read has private/no-store,
editable fields/version/status and newest20 immutable seller actions. Mutation replies
`{ok:true}`. Public legacy PUT/DELETE are now admin-only; internal completion is unchanged.

PATCH requires version and exact title/description/minimumBid/startAt/endAt. Title5–100,
description≤1000, decimal-string money1000..9007199254740991, ISO timezone-qualified
whole hours, future start and at least1hour duration. Cancel requires version and
listing_error/item_unavailable/schedule_change/personal_reason/other. Only other accepts
required trimmed detail1–200. Cancel persists status=cancelled, never deletedAt.

The adapter locks the owned row; checks visible/not-deleted, version, future dates,
zero current bid/no bidder/no bid records (including deleted), no sold/checkout/purchase.
The conditional SQL UPDATE rechecks clock_timestamp and the original version. Audit
snapshots/reason and shared unchanged Outbox writes commit in that transaction. Update
publishes existing update event; cancel publishes existing deletion event for search.
No image/financial/ownership edits. Empty/stale/double writes do not bypass these checks.

Migration `20261031010000_seller_actions` adds one table with FK and history index.
Existing image entrypoint runs `prisma migrate deploy` before starting the server;
verify its successful log and readiness before releasing the frontend. No manual SQL
against the shared production database is part of testing.

Local unit451 pass, guarded DB/Kafka88 skip, checkers22/naming/architecture/format and
four Nest builds pass. The new18 isolated PG cases cover state/ownership, exact values,
concurrent versions, immutable history/cancel event, transactional rollback and actual
row-lock contention crossing start. They are in `scripts/run-payment-integration.mjs`
and must pass on disposable CI PostgreSQL before publication; a local skip is no pass.

No local Docker, production integration tests, real cancellations/bids/payments, new
dependencies or infrastructure services. Frontend: FE-Service `docs/seller-management.md`.
Publication/CI/runtime evidence is recorded after the release gates complete.
