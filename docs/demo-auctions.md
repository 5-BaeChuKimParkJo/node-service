# Manual Demo Auction Creation

`POST /api/v1/internal/admin/auctions/demo` creates one new portfolio auction.
It requires the existing internal administrator token, an `x-admin-actor` header,
and an empty JSON object. Browser authentication/CSRF belongs to the admin BFF;
the internal credential is never exposed to the browser.

Configure `DEMO_AUCTION_TEMPLATE_UUID` with a trusted existing demo auction.
An absent/invalid setting fails closed with 503. A non-demo, hidden, cancelled,
or deleted template fails with 409 (or 404 when the repository cannot find it).
The UUID is an explicit server-side allowlist; a title prefix alone never lets
the caller choose a different template or seller.

The template's product metadata, owned image keys and seller are reused, not its
UUID, bids, winner, views, payments or dates. Creation delegates to the normal
`CreateAuctionUseCase`, including taxonomy/owned-image checks and the existing
transactional auction/outbox insert. No schema change or new storage is needed.
The source auction is read only. The title is labelled `[DEMO]`, and the public
description explicitly states that no real delivery or trade is provided.

The minimum bid is 1,000 KRW. The schedule starts at the current UTC hour and
ends 24 hours later, respecting the existing whole-hour domain rule. Therefore
23 to 24 hours remain at creation time. A successful response is HTTP 201:

```json
{
  "auctionUuid": "10000000-0000-4000-8000-000000000001",
  "title": "[DEMO] Example",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-21T09:00:00.000Z"
}
```

Every deliberate POST creates a new auction. There are no automatic retries,
scheduled replenishment, artificial bids, ranking boosts, or deletion/reset of
existing auctions. After an ambiguous network failure, inspect the admin list
before submitting another request. Successful creation logs the authenticated
operator and new auction UUID without adding those details to the public item.
