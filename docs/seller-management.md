# Waiting seller auction management

GET/PATCH `/auction-service/api/v1/auctions/:uuid/seller`, POST `.../seller/cancel`.
Verified JWT owner only; unknown/other owner/deleted404. Read has private/no-store,
editable fields/version/status and newest20 immutable seller actions. Mutation replies
`{ok:true}`. Public legacy PUT/DELETE are now admin-only; internal completion is unchanged.

PATCH requires version and exact title/description/minimumBid/startAt/endAt. Title5–100,
description≤1000, decimal-string money1000..2147483647 (search consumer int bound), ISO timezone-qualified
whole hours, future start and at least1hour duration. Cancel requires version and
listing_error/item_unavailable/schedule_change/personal_reason/other. Only other accepts
required trimmed detail1–200. Cancel persists status=cancelled, never deletedAt.

The adapter locks the owned row; checks visible/not-deleted, version, future dates,
zero current bid/no bidder/no bid records (including deleted), no sold/checkout/purchase.
The conditional SQL UPDATE rechecks clock_timestamp and the original version. Audit
snapshots/reason and shared unchanged Outbox writes commit in that transaction. Update
publishes existing update event; cancel publishes existing deletion event for search.
No image/financial/ownership edits. Empty/stale/double writes do not bypass these checks.
Legacy oversized prices require a normal correction before cancel, preserving truthful
events without widening/reindexing the search service. Kafka batch bids must reject
cancelled/hidden/deleted/sold/checkout states under the row lock with post-lock time
and an exclusive end boundary; otherwise an old queued bid could revive search data.

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

One final review found two Important integration defects, reproduced RED and fixed:
Kafka date-only bid admission for canceled rows, and a price bound exceeding search's
Java int/ES Integer mapping. Status/deletion/sold/checkout plus exclusive period checks
run after the batch row lock; both edit inputs cap2147483647. Legacy oversized prices
must be corrected before cancel to avoid untruthful or poison events. Cost: ceiling
and an extra correction step. Five isolated protected-bid cases and one oversized-price
recovery case were added (new seller19, total expected PG91; CI must actually prove it).
Final local unit459,94 guarded skips, four builds/checks; FE133 and production browser16
plus previous seller-list8 pass. Old fixtures missing required status or positioned at
the end boundary were corrected without weakening the protection.

Deferred Minor: protected FE rows omit current description/start-time display; API
still supplies both. Static review did not rerun checks. Author execution and CI/live
smoke gates are separate; no claim of load, full CDC/search recovery, comprehensive
accessibility, or unrelated authentication/admin/payment/internal completion correctness.
