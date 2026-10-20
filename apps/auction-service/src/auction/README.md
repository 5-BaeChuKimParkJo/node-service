# Popular Auctions

`GET /api/v1/auctions/popular` is public. It returns up to ten currently active,
visible, non-deleted, unsold auctions with activity in the last 24 hours. The
score is distinct viewers plus five times distinct bidders in `[asOf - 24h, asOf)`.
Seller activity, soft-deleted bids and nonpositive bid amounts do not count.
Repeated views/bids by one identity contribute once per signal. Aggregate the
signals separately to avoid multiplying counts when joining them. Ties use
bidder count, viewer count, earlier ending time, then auction UUID.

The existing auction-service scheduler replaces a Redis score/ID snapshot every
five minutes. Cold or expired reads aggregate on demand, with one in-flight
aggregation per process. Each cache operation has a one-second wait limit.
Redis failures fall back to PostgreSQL; database failures
remain errors rather than fabricated rankings. Cached scores expire after five
minutes. Every response rechecks live eligibility and reads current title, price
and image, so closing or hiding a cached auction removes it immediately. The list
may temporarily contain fewer than ten entries until its next aggregation.
Money, counts and scores are decimal strings; rank is a number. `generatedAt`
is the score snapshot time, not the live listing lookup time. No activity returns
an empty ranking; the separate latest-auction section remains available.

`POST /api/v1/auctions/:auctionUuid/views` returns 204. A valid access token uses
its signed member UUID, not a body-supplied identity. Without authorization the
body must contain a UUID `visitorUuid`; the customer frontend creates it in an
HttpOnly browser cookie via a server action. Only active public auctions accept
view records, and seller views are ignored. The browser calls this after mounting
a successful detail page, not during server rendering or link prefetching. A
tracking error must not block reading or bidding. This endpoint appends raw view
records; ranking deduplication happens in SQL. Existing Kafka view records remain
compatible and replayed duplicates cannot inflate the distinct-viewer score.

Anonymous identity is approximate: clearing cookies or switching browsers creates
a new identity, and anonymous/login activity cannot be reliably merged. This is
not an anti-fraud system. The first version does not add bot filtering, device
fingerprinting, a separate ranking service or retention jobs. Recent-window
indexes are added by Prisma migration. The guarded PostgreSQL integration runner
also tests ranking windows, deduplication, eligibility, ties and exact money.

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
