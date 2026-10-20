# Administrator History

`GET /api/v1/internal/admin/history` is a read-only, internal-token-protected
projection of existing `AuctionAdminActions` and cancellation-requested
`AuctionPaymentAttempt` rows. It creates no records and never contacts Toss.
No database migration or additional service is required.

Optional filters: `action` (`hide`, `restore`, `force-end`, `payment-cancel`),
exact `auctionUuid`, inclusive `from` and exclusive `to` UTC timestamps. Dates
and cursors preserve up to six fractional digits. `occurredAt` and `entryKey`
must be supplied together for continuation. Repeated or malformed scalar
parameters return 400 before querying the database.

Results contain 20 entries plus a nullable `nextCursor`. One SQL union applies
filters and descending ordering before pagination, by request/action timestamp
and a source-prefixed key (`auction:<audit UUID>` or `payment:<order ID>`) with
explicit C collation. Monetary values are decimal strings, never JS numbers.
The projection excludes payment keys, leases and idempotency credentials.

Auction actions are recorded only after successful transactions, so their
result is `SUCCEEDED`. A cancellation is one original request, not a complete
immutable provider-event ledger: `CANCELED` maps to `SUCCEEDED`, `CANCELING` to
`PENDING`, and other stored attempt statuses to `REVIEW_REQUIRED`. Subsequent
reconciliation updates its displayed result while retaining its identity and
original request time. Refresh to see newer results; pages are not a historical
snapshot across requests. No cancellation or reconciliation is triggered by reads.

Titles reflect current auction metadata, not historical title snapshots. Missing
metadata retains the audit entry with a null title. Hidden or soft-deleted
auctions remain inspectable. Legacy null actors and reasons remain null rather
than being attributed to the currently signed-in administrator.

The isolated payment integration suite also covers cross-source tied timestamps,
microsecond boundaries, retained metadata, exact amounts and cancellation result
updates. Use its guarded `TEST_DATABASE_URL` workflow, never production databases.
