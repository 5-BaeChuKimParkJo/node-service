# Saved auctions

User delegated choosing and implementing the next feature. Agent choice: private,
server-persisted auction bookmarks, replacing the unconnected customer placeholder
with a useful detail toggle and personal list. Notifications remain deferred.

## Design and boundaries

Use PostgreSQL SavedAuction rows keyed by memberUuid+auctionUuid and a monotonic
savedId, createdAt and FK to Auctions. Additive migration only. Existing data,
events, financial state and auth contracts stay intact. A separate bookmark store
or browser-only storage would add infrastructure or fail cross-device persistence.

- JWT-verified identity exclusively; no caller-supplied member UUID. UUID params,
  empty mutation bodies and optional decimal bigint cursor are validated.
- GET /api/v1/auctions/saved returns 20 items+nextCursor ordered by savedId DESC.
  Cursor is a positive signed-bigint decimal string; filter owner/visibility before
  LIMIT. Both HTTP success and frontend reads are private/no-store.
- GET /api/v1/auctions/:uuid/saved returns {saved:boolean}; visible nondeleted
  auctions only. Unknown/hidden/cancelled/deleted targets return404 without details.
- PUT same path registers a bookmark atomically; unique conflict preserves original
  savedId/time. Returns {saved:true}. DELETE is idempotent {saved:false}, scopes
  only to the caller and also permits cleanup of unavailable auctions.
- Visible waiting/active/ended auctions may be saved. Hidden/cancelled/deleted
  auctions are excluded from lists; restore can make an old bookmark reappear.
- List uses current auction fields, decimal-string money and UTC timestamps, with
  waiting/active/ended derived using server time. No winner/payment claim or call.
- New application port/service + PostgreSQL adapter + web controller, wired in the
  existing AuctionModule. No Prisma/SDK imports in application values/ports.

Frontend: detail control, /mypage/saved-auctions, menu entry, next-page/first-page
links and refresh. Existing server action boundary owns credentials; client gets
only public display/state values. Anonymous save links to sign-in. Failed/unknown
state cannot be treated as unsaved or successful. Mutations update UI only after
verified response; retry after network uncertainty is safe through PUT/DELETE
idempotency. Pending buttons block repeated clicks; errors remain recoverable.
Lists distinguish empty/error and use fixed Korean messages with KST date labels.
Do not add per-card status requests or ranking/notification signals.

No new dependencies, local Docker, production bid/payment/forced outage tests.
Real DB integration runs only in guarded disposable loopback _test PostgreSQL.
Ship backend/migration before frontend. Existing checkout/main and standing
commit/push/deploy authorization apply. Live bookmark validation may use existing
demo identity and must restore its prior state; no credentials in logs/docs.
