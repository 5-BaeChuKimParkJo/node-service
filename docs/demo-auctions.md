# Portfolio Demo Auctions

`POST /api/v1/internal/admin/auctions/demo` creates one new portfolio auction.
It requires the existing internal administrator token, an `x-admin-actor` header,
and a JSON object. Optional `durationMinutes` accepts only numeric `5`, `30`, or
`1440`; other fields, strings, null durations and unsupported numbers fail with 400.
An empty object retains the legacy 24-hour schedule. Browser authentication/CSRF belongs to the admin BFF;
the internal credential is never exposed to the browser.

Configure `DEMO_AUCTION_TEMPLATE_UUID` with a trusted existing demo auction.
An absent/invalid setting fails closed with 503. A non-demo, hidden, cancelled,
or deleted template fails with 409 (or 404 when the repository cannot find it).
The UUID is an explicit server-side allowlist; a title prefix alone never lets
the caller choose a different template or seller.

The template's product metadata, owned image keys and seller are reused, not its
UUID, bids, winner, views, payments or dates. Creation delegates to the normal
`CreateAuctionUseCase`, including taxonomy/owned-image checks and the existing
transactional auction/outbox insert. A private nullable `demoTemplateUuid` column
tracks newly managed demos; it is never exposed in public HTTP or event payloads.
The source auction is read only. The title is labelled `[DEMO]`, and the public
description explicitly states that no real delivery or trade is provided.

The minimum bid is 1,000 KRW. For 5/30 minutes the schedule starts at the server
request time and ends exactly that duration later. The 1440/default schedule
starts at the current UTC hour and ends 24 hours later (23–24 hours remaining).
The trusted demo creation path alone permits short, minute-level schedules.
Ordinary creation still requires whole-hour timestamps and at least one hour;
ordinary date updates keep their whole-hour validation. A successful response is HTTP 201:

```json
{
  "auctionUuid": "10000000-0000-4000-8000-000000000001",
  "title": "[DEMO] Example",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-21T09:00:00.000Z"
}
```

Every deliberate POST creates a new auction, even if another active demo exists.
Manual and automatic creation share a nonblocking transaction advisory lock;
manual contention returns 409 without retry. After an ambiguous network failure, inspect the admin list
before submitting another request. Successful creation logs the authenticated
operator and new auction UUID without adding those details to the public item.

Public auction detail includes `isDemo`, derived from stored managed-demo
provenance. Title prefixes do not grant this label. The private template UUID
is excluded from public responses and Outbox payloads. The customer guide shows
the three stages and refreshes once at the scheduled boundary; actual checkout
eligibility is still enforced by the payment service for the authenticated winner.

## Optional scheduled replenishment

Set `DEMO_AUCTION_AUTO_ENABLED` to the exact string `true` to enable a check every
five minutes (at second zero). All other values, including an absent setting,
disable it. There is no startup catch-up and no UI toggle. A tick creates one
demo only when no eligible managed auction exists. An eligible auction is the
configured template or a child marked with that template UUID: visible, not
deleted, not sold, not locked for checkout, and `startAt <= now < endAt`.
Unmarked legacy copies are preserved and do not count; titles alone never prove
provenance. Deliberate manual extras are never removed or reset.

Image ownership/storage and domain validation run before the write transaction.
The transaction revalidates the template, acquires the shared lock and commits
the new auction, provenance and outbox together. Another Pod holding the lock
causes a skip; an existing eligible candidate also causes a skip. A failed tick
logs a sanitized warning and waits until the next scheduled tick without retries.
No artificial views, bids, ranking boosts or payment-provider calls are made.
Original auction history, bids, payment records and stored images are retained.

Deploy the new image with the flag disabled and confirm the additive migration
before enabling it in GitOps. To stop replenishment, remove the flag or set it to
`false` and roll out the deployment. Keep the nullable column and existing data
on rollback; disabling replenishment never performs financial or data cleanup.
